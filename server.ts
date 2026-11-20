import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  IS_EPHEMERAL_ENCRYPTION_KEY,
  KEY_FINGERPRINT,
  decryptJson,
  derivePseudonymId,
  encryptJson,
  hashEmailLookup,
  hashPassword,
  sha256Hex,
  signHmacHex,
  signSessionToken,
  verifyHmacHex,
  verifyPassword,
  verifySessionToken,
} from './server/crypto';
import { appendAuditEntry, db, initDatabase } from './server/db';
import {
  DISEASE_DOMAINS,
  DiseaseDomainId,
  executeFederatedRoundStep,
  runDiagnosticInference,
} from './server/federatedEngine';

initDatabase();

interface AuthenticatedUser {
  userId: string;
  sid: string;
  pseudonymId: string;
  role: 'clinician' | 'coordinator' | 'auditor';
}

interface RequestWithUser extends Request {
  authUser?: AuthenticatedUser;
}

interface DecryptedUserProfile {
  fullName: string;
  email: string;
  institution: string;
  department: string;
}

const VALID_ROLES = new Set(['clinician', 'coordinator', 'auditor']);
const VALID_DOMAINS = new Set<DiseaseDomainId>([
  'cardiovascular',
  'pulmonary',
  'oncology',
  'neurological',
]);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
}

function createSessionForUser(user: {
  id: string;
  pseudonym_id: string;
  role: 'clinician' | 'coordinator' | 'auditor';
}): { token: string; expiresAt: number } {
  const sid = crypto.randomUUID();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12; // 12 hours
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO sessions (sid, user_id, expires_at, revoked, created_at)
     VALUES (?, ?, ?, 0, ?)`
  ).run(sid, user.id, expiresAt, createdAt);

  const token = signSessionToken({
    sub: user.id,
    sid,
    pseudonymId: user.pseudonym_id,
    role: user.role,
    exp: expiresAt,
  });

  return { token, expiresAt };
}

function requireAuth(req: RequestWithUser, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid signature.' });
    return;
  }

  const sessionRow = db
    .prepare('SELECT sid, user_id, expires_at, revoked FROM sessions WHERE sid = ? AND user_id = ?')
    .get(payload.sid, payload.sub) as
    | { sid: string; user_id: string; expires_at: number; revoked: number }
    | undefined;

  if (!sessionRow || sessionRow.revoked === 1 || Date.now() > sessionRow.expires_at) {
    res.status(401).json({ error: 'Session has been revoked or expired.' });
    return;
  }

  req.authUser = {
    userId: payload.sub,
    sid: payload.sid,
    pseudonymId: payload.pseudonymId,
    role: payload.role,
  };
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      cipher: 'AES-256-GCM',
      kdf: 'scrypt',
      keyFingerprint: KEY_FINGERPRINT,
      ephemeralKeyMode: IS_EPHEMERAL_ENCRYPTION_KEY,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const fullName = sanitizeText(req.body?.fullName, 100);
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const institution = sanitizeText(req.body?.institution, 120);
    const department = sanitizeText(req.body?.department, 100) || 'Clinical Diagnostics';
    const rawRole = typeof req.body?.role === 'string' ? req.body.role.trim() : 'clinician';
    const role = (VALID_ROLES.has(rawRole) ? rawRole : 'clinician') as
      | 'clinician'
      | 'coordinator'
      | 'auditor';

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid institutional email address.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }
    if (institution.length < 2) {
      res.status(400).json({ error: 'Institution or clinical node name is required.' });
      return;
    }

    const emailHash = hashEmailLookup(email);
    const existing = db.prepare('SELECT id FROM users WHERE email_hash = ?').get(emailHash);
    if (existing) {
      res.status(409).json({ error: 'An account with this email is already registered.' });
      return;
    }

    const userId = crypto.randomUUID();
    const pseudonymId = derivePseudonymId(`${email}:${userId}`);
    const passwordHash = hashPassword(password);
    const profilePayload: DecryptedUserProfile = {
      fullName,
      email,
      institution,
      department,
    };
    const encryptedProfile = encryptJson(profilePayload);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO users (
        id, pseudonym_id, email_hash, role, encrypted_profile, profile_iv, profile_tag,
        password_hash, created_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      pseudonymId,
      emailHash,
      role,
      encryptedProfile.ciphertext,
      encryptedProfile.iv,
      encryptedProfile.authTag,
      passwordHash,
      now,
      now
    );

    appendAuditEntry({
      eventType: 'NODE_REGISTERED',
      actorPseudonym: pseudonymId,
      domainId: null,
      details: `Registered encrypted ${role} identity with AES-256-GCM PII isolation.`,
      createdAt: now,
    });

    const { token, expiresAt } = createSessionForUser({
      id: userId,
      pseudonym_id: pseudonymId,
      role,
    });

    res.status(201).json({
      token,
      expiresAt,
      user: {
        pseudonymId,
        role,
        profile: profilePayload,
        createdAt: now,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || password.length === 0) {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const emailHash = hashEmailLookup(email);
    const userRow = db
      .prepare(
        `SELECT id, pseudonym_id, role, encrypted_profile, profile_iv, profile_tag, password_hash, created_at
         FROM users WHERE email_hash = ?`
      )
      .get(emailHash) as
      | {
          id: string;
          pseudonym_id: string;
          role: 'clinician' | 'coordinator' | 'auditor';
          encrypted_profile: string;
          profile_iv: string;
          profile_tag: string;
          password_hash: string;
          created_at: string;
        }
      | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    let profile: DecryptedUserProfile;
    try {
      profile = decryptJson<DecryptedUserProfile>(
        userRow.encrypted_profile,
        userRow.profile_iv,
        userRow.profile_tag
      );
    } catch {
      res.status(500).json({ error: 'Failed to decrypt encrypted user profile.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userRow.id);

    appendAuditEntry({
      eventType: 'NODE_AUTHENTICATED',
      actorPseudonym: userRow.pseudonym_id,
      domainId: null,
      details: `Authenticated ${userRow.role} session via scrypt + HMAC-SHA256 Bearer token.`,
      createdAt: now,
    });

    const { token, expiresAt } = createSessionForUser({
      id: userRow.id,
      pseudonym_id: userRow.pseudonym_id,
      role: userRow.role,
    });

    res.json({
      token,
      expiresAt,
      user: {
        pseudonymId: userRow.pseudonym_id,
        role: userRow.role,
        profile,
        createdAt: userRow.created_at,
      },
    });
  });

  app.post('/api/auth/sandbox', (_req, res) => {
    const sandboxSuffix = crypto.randomBytes(4).toString('hex');
    const userId = crypto.randomUUID();
    const email = `clinician.${sandboxSuffix}@sandbox-node.med`;
    const pseudonymId = derivePseudonymId(`${email}:${userId}`);
    const passwordHash = hashPassword(crypto.randomBytes(24).toString('hex'));
    const profile: DecryptedUserProfile = {
      fullName: 'Dr. Elena Rostova',
      email,
      institution: 'Nordic Clinical Research Node',
      department: 'Federated Diagnostics',
    };
    const encryptedProfile = encryptJson(profile);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO users (
        id, pseudonym_id, email_hash, role, encrypted_profile, profile_iv, profile_tag,
        password_hash, created_at, last_login_at
      ) VALUES (?, ?, ?, 'clinician', ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      pseudonymId,
      hashEmailLookup(email),
      encryptedProfile.ciphertext,
      encryptedProfile.iv,
      encryptedProfile.authTag,
      passwordHash,
      now,
      now
    );

    appendAuditEntry({
      eventType: 'SANDBOX_NODE_PROVISIONED',
      actorPseudonym: pseudonymId,
      domainId: null,
      details: 'Provisioned ephemeral clinician sandbox session with full AES-256-GCM encryption.',
      createdAt: now,
    });

    const { token, expiresAt } = createSessionForUser({
      id: userId,
      pseudonym_id: pseudonymId,
      role: 'clinician',
    });

    res.status(201).json({
      token,
      expiresAt,
      user: {
        pseudonymId,
        role: 'clinician',
        profile,
        createdAt: now,
      },
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    db.prepare('UPDATE sessions SET revoked = 1 WHERE sid = ? AND user_id = ?').run(
      authUser.sid,
      authUser.userId
    );
    appendAuditEntry({
      eventType: 'SESSION_REVOKED',
      actorPseudonym: authUser.pseudonymId,
      domainId: null,
      details: 'Signed out and revoked server-side session token.',
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const userRow = db
      .prepare(
        `SELECT pseudonym_id, role, encrypted_profile, profile_iv, profile_tag, created_at, last_login_at
         FROM users WHERE id = ?`
      )
      .get(authUser.userId) as
      | {
          pseudonym_id: string;
          role: 'clinician' | 'coordinator' | 'auditor';
          encrypted_profile: string;
          profile_iv: string;
          profile_tag: string;
          created_at: string;
          last_login_at: string;
        }
      | undefined;

    if (!userRow) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const profile = decryptJson<DecryptedUserProfile>(
      userRow.encrypted_profile,
      userRow.profile_iv,
      userRow.profile_tag
    );

    res.json({
      pseudonymId: userRow.pseudonym_id,
      role: userRow.role,
      profile,
      createdAt: userRow.created_at,
      lastLoginAt: userRow.last_login_at,
      protocols: {
        storageCipher: 'AES-256-GCM',
        passwordKdf: 'scrypt (N=16384, r=8, p=1)',
        anonymization: 'HMAC-SHA256 Salted Pseudonyms',
        modelIntegrity: 'SHA-256 + HMAC-SHA256 Signatures',
        keyFingerprint: KEY_FINGERPRINT,
      },
    });
  });

  app.get('/api/federated/overview', requireAuth, (req: RequestWithUser, res) => {
    const rawDomain = typeof req.query.domain === 'string' ? req.query.domain : 'cardiovascular';
    const domainId: DiseaseDomainId = VALID_DOMAINS.has(rawDomain as DiseaseDomainId)
      ? (rawDomain as DiseaseDomainId)
      : 'cardiovascular';

    const spec = DISEASE_DOMAINS[domainId];

    const rounds = db
      .prepare(
        `SELECT round_number, global_accuracy, global_loss, auc_roc, sensitivity, specificity,
                epsilon_budget, delta_param, clipping_norm, participating_nodes,
                model_weights_json, model_bias, confusion_json, weights_sha256, aggregator_signature, created_at
         FROM federated_rounds
         WHERE domain_id = ?
         ORDER BY round_number ASC`
      )
      .all(domainId) as Array<{
      round_number: number;
      global_accuracy: number;
      global_loss: number;
      auc_roc: number;
      sensitivity: number;
      specificity: number;
      epsilon_budget: number;
      delta_param: number;
      clipping_norm: number;
      participating_nodes: number;
      model_weights_json: string;
      model_bias: number;
      confusion_json: string;
      weights_sha256: string;
      aggregator_signature: string;
      created_at: string;
    }>;

    const latestRound = rounds[rounds.length - 1];

    const recentUpdates = db
      .prepare(
        `SELECT id, round_number, pseudonym_id, local_sample_count, local_accuracy, local_loss,
                dp_noise_scale, gradient_l2_norm, update_sha256, verified_status, created_at
         FROM node_updates
         WHERE domain_id = ?
         ORDER BY id DESC
         LIMIT 20`
      )
      .all(domainId) as Array<{
      id: number;
      round_number: number;
      pseudonym_id: string;
      local_sample_count: number;
      local_accuracy: number;
      local_loss: number;
      dp_noise_scale: number;
      gradient_l2_norm: number;
      update_sha256: string;
      verified_status: string;
      created_at: string;
    }>;

    const domainSummaries = (Object.keys(DISEASE_DOMAINS) as DiseaseDomainId[]).map((id) => {
      const latest = db
        .prepare(
          `SELECT round_number, global_accuracy, auc_roc, epsilon_budget, participating_nodes
           FROM federated_rounds WHERE domain_id = ? ORDER BY round_number DESC LIMIT 1`
        )
        .get(id) as
        | {
            round_number: number;
            global_accuracy: number;
            auc_roc: number;
            epsilon_budget: number;
            participating_nodes: number;
          }
        | undefined;
      return {
        id,
        name: DISEASE_DOMAINS[id].name,
        shortName: DISEASE_DOMAINS[id].shortName,
        clinicalTarget: DISEASE_DOMAINS[id].clinicalTarget,
        latestRound: latest?.round_number ?? 1,
        accuracy: latest?.global_accuracy ?? 0,
        aucRoc: latest?.auc_roc ?? 0,
        epsilon: latest?.epsilon_budget ?? 1.2,
      };
    });

    res.json({
      domain: {
        id: spec.id,
        name: spec.name,
        shortName: spec.shortName,
        clinicalTarget: spec.clinicalTarget,
        cohortDescription: spec.cohortDescription,
        biomarkers: spec.biomarkers,
      },
      domainSummaries,
      latestRound: latestRound
        ? {
            roundNumber: latestRound.round_number,
            globalAccuracy: latestRound.global_accuracy,
            globalLoss: latestRound.global_loss,
            aucRoc: latestRound.auc_roc,
            sensitivity: latestRound.sensitivity,
            specificity: latestRound.specificity,
            epsilonBudget: latestRound.epsilon_budget,
            deltaParam: latestRound.delta_param,
            clippingNorm: latestRound.clipping_norm,
            participatingNodes: latestRound.participating_nodes,
            weights: JSON.parse(latestRound.model_weights_json) as number[],
            bias: latestRound.model_bias,
            confusionMatrix: JSON.parse(latestRound.confusion_json) as {
              tp: number;
              fp: number;
              fn: number;
              tn: number;
            },
            weightsSha256: latestRound.weights_sha256,
            signatureValid: verifyHmacHex(latestRound.weights_sha256, latestRound.aggregator_signature),
            createdAt: latestRound.created_at,
          }
        : null,
      rounds: rounds.map((r) => ({
        roundNumber: r.round_number,
        globalAccuracy: r.global_accuracy,
        globalLoss: r.global_loss,
        aucRoc: r.auc_roc,
        sensitivity: r.sensitivity,
        specificity: r.specificity,
        epsilonBudget: r.epsilon_budget,
        participatingNodes: r.participating_nodes,
        weightsSha256: r.weights_sha256,
        createdAt: r.created_at,
      })),
      recentUpdates,
    });
  });

  app.post('/api/federated/contribute', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const rawDomain = typeof req.body?.domainId === 'string' ? req.body.domainId : '';
    if (!VALID_DOMAINS.has(rawDomain as DiseaseDomainId)) {
      res.status(400).json({ error: 'Invalid disease domain identifier.' });
      return;
    }
    const domainId = rawDomain as DiseaseDomainId;

    const localSamples = Number(req.body?.localSamples);
    const learningRate = Number(req.body?.learningRate);
    const epsilon = Number(req.body?.epsilon);
    const clippingNorm = Number(req.body?.clippingNorm);

    if (
      !Number.isFinite(localSamples) ||
      localSamples < 32 ||
      localSamples > 5000 ||
      !Number.isFinite(learningRate) ||
      learningRate < 0.01 ||
      learningRate > 1.0 ||
      !Number.isFinite(epsilon) ||
      epsilon < 0.2 ||
      epsilon > 10.0 ||
      !Number.isFinite(clippingNorm) ||
      clippingNorm < 0.2 ||
      clippingNorm > 5.0
    ) {
      res.status(400).json({
        error:
          'Hyperparameters out of calibrated range: samples [32..5000], lr [0.01..1.0], epsilon [0.2..10.0], clipping [0.2..5.0].',
      });
      return;
    }

    const latest = db
      .prepare(
        `SELECT round_number, participating_nodes, model_weights_json, model_bias
         FROM federated_rounds WHERE domain_id = ? ORDER BY round_number DESC LIMIT 1`
      )
      .get(domainId) as
      | {
          round_number: number;
          participating_nodes: number;
          model_weights_json: string;
          model_bias: number;
        }
      | undefined;

    if (!latest) {
      res.status(404).json({ error: 'Baseline federated round not found.' });
      return;
    }

    const currentWeights = JSON.parse(latest.model_weights_json) as number[];
    const nextRoundNumber = latest.round_number + 1;
    const participatingNodes = Math.min(16, latest.participating_nodes + 1);

    const step = executeFederatedRoundStep({
      domainId,
      currentWeights,
      currentBias: latest.model_bias,
      participatingNodes,
      localSamples: Math.round(localSamples),
      learningRate,
      epsilon,
      clippingNorm,
    });

    const now = new Date().toISOString();
    const encGrad = encryptJson({
      deltaSummary: step.deltaSummary,
      clippedNorm: step.clippedNorm,
      epsilon,
      learningRate,
    });
    const updateSha = sha256Hex(
      `${authUser.pseudonymId}|${domainId}|${nextRoundNumber}|${encGrad.ciphertext}`
    );

    const status = step.byzantinePassed ? 'verified' : 'rejected_anomaly';

    db.prepare(
      `INSERT INTO node_updates (
        domain_id, round_number, pseudonym_id, local_sample_count, local_accuracy, local_loss,
        dp_noise_scale, gradient_l2_norm, encrypted_gradient_summary, gradient_iv, gradient_tag,
        update_sha256, verified_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      domainId,
      nextRoundNumber,
      authUser.pseudonymId,
      Math.round(localSamples),
      step.localAccuracy,
      step.localLoss,
      step.dpNoiseScale,
      step.gradientL2Norm,
      encGrad.ciphertext,
      encGrad.iv,
      encGrad.authTag,
      updateSha,
      status,
      now
    );

    const weightsToCommit = step.byzantinePassed ? step.newWeights : currentWeights;
    const biasToCommit = step.byzantinePassed ? step.newBias : latest.model_bias;
    const wJson = JSON.stringify(weightsToCommit);
    const wSha = sha256Hex(`${domainId}|${nextRoundNumber}|${wJson}|${biasToCommit}`);
    const sig = signHmacHex(wSha);

    db.prepare(
      `INSERT INTO federated_rounds (
        domain_id, round_number, global_accuracy, global_loss, auc_roc, sensitivity, specificity,
        epsilon_budget, delta_param, clipping_norm, participating_nodes,
        model_weights_json, model_bias, confusion_json, weights_sha256, aggregator_signature, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      domainId,
      nextRoundNumber,
      step.metrics.accuracy,
      step.metrics.loss,
      step.metrics.aucRoc,
      step.metrics.sensitivity,
      step.metrics.specificity,
      epsilon,
      1e-5,
      clippingNorm,
      participatingNodes,
      wJson,
      biasToCommit,
      JSON.stringify(step.metrics.confusionMatrix),
      wSha,
      sig,
      now
    );

    appendAuditEntry({
      eventType: 'FEDAVG_ROUND_VERIFIED',
      actorPseudonym: authUser.pseudonymId,
      domainId,
      details: `Round ${nextRoundNumber} committed (${Math.round(localSamples)} local samples, epsilon=${epsilon.toFixed(2)}, sigma=${step.dpNoiseScale}).`,
      createdAt: now,
    });

    res.status(201).json({
      roundNumber: nextRoundNumber,
      globalAccuracy: step.metrics.accuracy,
      globalLoss: step.metrics.loss,
      aucRoc: step.metrics.aucRoc,
      dpNoiseScale: step.dpNoiseScale,
      weightsSha256: wSha,
      updateSha256: updateSha,
      verifiedStatus: status,
    });
  });

  app.post('/api/diagnosis/predict', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const rawDomain = typeof req.body?.domainId === 'string' ? req.body.domainId : '';
    if (!VALID_DOMAINS.has(rawDomain as DiseaseDomainId)) {
      res.status(400).json({ error: 'Invalid disease domain.' });
      return;
    }
    const domainId = rawDomain as DiseaseDomainId;
    const spec = DISEASE_DOMAINS[domainId];
    const patientAlias = sanitizeText(req.body?.patientAlias, 48) || `CASE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const rawBiomarkers = req.body?.biomarkers;
    if (!rawBiomarkers || typeof rawBiomarkers !== 'object') {
      res.status(400).json({ error: 'Biomarker input object is required.' });
      return;
    }

    const validatedInputs: Record<string, number> = {};
    for (const bm of spec.biomarkers) {
      const val = Number((rawBiomarkers as Record<string, unknown>)[bm.key]);
      if (!Number.isFinite(val) || val < bm.min || val > bm.max) {
        res.status(400).json({
          error: `${bm.label} must be between ${bm.min} and ${bm.max} ${bm.unit}.`,
        });
        return;
      }
      validatedInputs[bm.key] = val;
    }

    const latest = db
      .prepare(
        `SELECT round_number, model_weights_json, model_bias
         FROM federated_rounds WHERE domain_id = ? ORDER BY round_number DESC LIMIT 1`
      )
      .get(domainId) as
      | { round_number: number; model_weights_json: string; model_bias: number }
      | undefined;

    if (!latest) {
      res.status(404).json({ error: 'Federated model round unavailable.' });
      return;
    }

    const weights = JSON.parse(latest.model_weights_json) as number[];
    const prediction = runDiagnosticInference(domainId, validatedInputs, weights, latest.model_bias);

    const recordId = crypto.randomUUID();
    const now = new Date().toISOString();
    const clinicalPayload = {
      patientAlias,
      biomarkers: validatedInputs,
      probability: prediction.probability,
      logit: prediction.logit,
      attributions: prediction.attributions,
    };
    const encrypted = encryptJson(clinicalPayload);
    const recordHmac = signHmacHex(
      `${recordId}|${authUser.pseudonymId}|${domainId}|${latest.round_number}|${encrypted.ciphertext}`
    );

    db.prepare(
      `INSERT INTO diagnosis_records (
        id, user_id, pseudonym_id, domain_id, model_round_used, prediction_label,
        confidence_score, encrypted_clinical_payload, payload_iv, payload_auth_tag,
        record_hmac, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recordId,
      authUser.userId,
      authUser.pseudonymId,
      domainId,
      latest.round_number,
      prediction.riskLabel,
      prediction.confidenceScore,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      recordHmac,
      now
    );

    appendAuditEntry({
      eventType: 'ENCRYPTED_DIAGNOSIS_STORED',
      actorPseudonym: authUser.pseudonymId,
      domainId,
      details: `Encrypted diagnosis ${recordId.slice(0, 8)} stored with AES-256-GCM (Global Round ${latest.round_number}).`,
      createdAt: now,
    });

    res.status(201).json({
      recordId,
      domainId,
      modelRoundUsed: latest.round_number,
      patientAlias,
      prediction,
      encryption: {
        cipher: 'AES-256-GCM',
        ivPreview: encrypted.iv.slice(0, 12),
        hmacPreview: recordHmac.slice(0, 16),
      },
      createdAt: now,
    });
  });

  app.get('/api/diagnosis/history', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const rows = db
      .prepare(
        `SELECT id, pseudonym_id, domain_id, model_round_used, prediction_label, confidence_score,
                encrypted_clinical_payload, payload_iv, payload_auth_tag, record_hmac, created_at
         FROM diagnosis_records
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .all(authUser.userId) as Array<{
      id: string;
      pseudonym_id: string;
      domain_id: DiseaseDomainId;
      model_round_used: number;
      prediction_label: string;
      confidence_score: number;
      encrypted_clinical_payload: string;
      payload_iv: string;
      payload_auth_tag: string;
      record_hmac: string;
      created_at: string;
    }>;

    const records = rows.map((row) => {
      const expectedInput = `${row.id}|${row.pseudonym_id}|${row.domain_id}|${row.model_round_used}|${row.encrypted_clinical_payload}`;
      const integrityVerified = verifyHmacHex(expectedInput, row.record_hmac);
      const decrypted = decryptJson<{
        patientAlias: string;
        biomarkers: Record<string, number>;
        probability: number;
        attributions: Array<{
          key: string;
          label: string;
          value: number;
          unit: string;
          contribution: number;
          direction: string;
        }>;
      }>(row.encrypted_clinical_payload, row.payload_iv, row.payload_auth_tag);

      return {
        id: row.id,
        domainId: row.domain_id,
        domainName: DISEASE_DOMAINS[row.domain_id]?.shortName ?? row.domain_id,
        modelRoundUsed: row.model_round_used,
        predictionLabel: row.prediction_label,
        confidenceScore: row.confidence_score,
        probability: decrypted.probability,
        patientAlias: decrypted.patientAlias,
        biomarkers: decrypted.biomarkers,
        attributions: decrypted.attributions,
        integrityVerified,
        cipherIvPreview: row.payload_iv.slice(0, 12),
        createdAt: row.created_at,
      };
    });

    res.json({ records });
  });

  app.delete('/api/diagnosis/history/:id', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const recordId = sanitizeText(req.params.id, 64);
    const result = db
      .prepare('DELETE FROM diagnosis_records WHERE id = ? AND user_id = ?')
      .run(recordId, authUser.userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Diagnosis record not found or access denied.' });
      return;
    }

    appendAuditEntry({
      eventType: 'ENCRYPTED_DIAGNOSIS_PURGED',
      actorPseudonym: authUser.pseudonymId,
      domainId: null,
      details: `Purged encrypted diagnosis record ${recordId.slice(0, 8)} per owner request.`,
    });

    res.json({ ok: true });
  });

  function verifyAuditAndModelChains() {
    const ledgerRows = db
      .prepare(
        `SELECT id, event_type, actor_pseudonym, domain_id, details, prev_hash, entry_hash, created_at
         FROM audit_ledger ORDER BY id ASC`
      )
      .all() as Array<{
      id: number;
      event_type: string;
      actor_pseudonym: string;
      domain_id: string | null;
      details: string;
      prev_hash: string;
      entry_hash: string;
      created_at: string;
    }>;

    let chainValid = true;
    let expectedPrev = '0'.repeat(64);
    let brokenAtId: number | null = null;

    for (const row of ledgerRows) {
      const payloadStr = `${row.prev_hash}|${row.event_type}|${row.actor_pseudonym}|${row.domain_id ?? ''}|${row.details}|${row.created_at}`;
      const recomputed = sha256Hex(payloadStr);
      if (row.prev_hash !== expectedPrev || row.entry_hash !== recomputed) {
        chainValid = false;
        brokenAtId = row.id;
        break;
      }
      expectedPrev = row.entry_hash;
    }

    const roundRows = db
      .prepare('SELECT id, weights_sha256, aggregator_signature FROM federated_rounds')
      .all() as Array<{ id: number; weights_sha256: string; aggregator_signature: string }>;

    let signaturesValid = true;
    for (const r of roundRows) {
      if (!verifyHmacHex(r.weights_sha256, r.aggregator_signature)) {
        signaturesValid = false;
        break;
      }
    }

    return {
      chainValid,
      signaturesValid,
      totalLedgerEntries: ledgerRows.length,
      totalVerifiedRounds: roundRows.length,
      brokenAtId,
      latestHash: expectedPrev,
      checkedAt: new Date().toISOString(),
    };
  }

  app.get('/api/security/ledger', requireAuth, (_req: RequestWithUser, res) => {
    const entries = db
      .prepare(
        `SELECT id, event_type, actor_pseudonym, domain_id, details, prev_hash, entry_hash, created_at
         FROM audit_ledger ORDER BY id DESC LIMIT 40`
      )
      .all();

    const verification = verifyAuditAndModelChains();

    res.json({
      entries,
      verification,
      protocols: {
        encryptionAtRest: 'AES-256-GCM (96-bit random IV per record)',
        passwordHashing: 'scrypt (16-byte random salt, 64-byte key)',
        anonymityLayer: 'Salted HMAC-SHA256 Node Pseudonyms (Zero PII in FL)',
        differentialPrivacy: 'Gaussian Mechanism (epsilon, 1e-5)-DP + L2 Norm Clipping',
        integrityLedger: 'SHA-256 Hash-Chained Ledger + HMAC-SHA256 Round Signatures',
        keyFingerprint: KEY_FINGERPRINT,
      },
    });
  });

  app.post('/api/security/verify-ledger', requireAuth, (req: RequestWithUser, res) => {
    const authUser = req.authUser!;
    const verification = verifyAuditAndModelChains();
    appendAuditEntry({
      eventType: 'INTEGRITY_AUDIT_EXECUTED',
      actorPseudonym: authUser.pseudonymId,
      domainId: null,
      details: `Verified ${verification.totalLedgerEntries} hash-chained entries and ${verification.totalVerifiedRounds} signed model rounds.`,
    });
    res.json({ verification });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`AegisMed Federated Diagnostics server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
