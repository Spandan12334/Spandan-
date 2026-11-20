import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  IS_EPHEMERAL_ENCRYPTION_KEY,
  KEY_FINGERPRINT,
  derivePseudonymId,
  encryptJson,
  sha256Hex,
  signHmacHex,
} from './crypto';
import {
  DISEASE_DOMAINS,
  DiseaseDomainId,
  evaluateGlobalModel,
  executeFederatedRoundStep,
} from './federatedEngine';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'medfed.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS system_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    pseudonym_id TEXT NOT NULL UNIQUE,
    email_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('clinician', 'coordinator', 'auditor')),
    encrypted_profile TEXT NOT NULL,
    profile_iv TEXT NOT NULL,
    profile_tag TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS federated_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    global_accuracy REAL NOT NULL,
    global_loss REAL NOT NULL,
    auc_roc REAL NOT NULL,
    sensitivity REAL NOT NULL,
    specificity REAL NOT NULL,
    epsilon_budget REAL NOT NULL,
    delta_param REAL NOT NULL,
    clipping_norm REAL NOT NULL,
    participating_nodes INTEGER NOT NULL,
    model_weights_json TEXT NOT NULL,
    model_bias REAL NOT NULL,
    confusion_json TEXT NOT NULL,
    weights_sha256 TEXT NOT NULL,
    aggregator_signature TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(domain_id, round_number)
  );

  CREATE TABLE IF NOT EXISTS node_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    pseudonym_id TEXT NOT NULL,
    local_sample_count INTEGER NOT NULL,
    local_accuracy REAL NOT NULL,
    local_loss REAL NOT NULL,
    dp_noise_scale REAL NOT NULL,
    gradient_l2_norm REAL NOT NULL,
    encrypted_gradient_summary TEXT NOT NULL,
    gradient_iv TEXT NOT NULL,
    gradient_tag TEXT NOT NULL,
    update_sha256 TEXT NOT NULL,
    verified_status TEXT NOT NULL CHECK (verified_status IN ('verified', 'rejected_anomaly')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnosis_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pseudonym_id TEXT NOT NULL,
    domain_id TEXT NOT NULL,
    model_round_used INTEGER NOT NULL,
    prediction_label TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    encrypted_clinical_payload TEXT NOT NULL,
    payload_iv TEXT NOT NULL,
    payload_auth_tag TEXT NOT NULL,
    record_hmac TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    actor_pseudonym TEXT NOT NULL,
    domain_id TEXT,
    details TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function appendAuditEntry(params: {
  eventType: string;
  actorPseudonym: string;
  domainId?: string | null;
  details: string;
  createdAt?: string;
}): void {
  const lastRow = db
    .prepare('SELECT entry_hash FROM audit_ledger ORDER BY id DESC LIMIT 1')
    .get() as { entry_hash: string } | undefined;

  const prevHash = lastRow ? lastRow.entry_hash : '0'.repeat(64);
  const createdAt = params.createdAt ?? new Date().toISOString();
  const payloadStr = `${prevHash}|${params.eventType}|${params.actorPseudonym}|${params.domainId ?? ''}|${params.details}|${createdAt}`;
  const entryHash = sha256Hex(payloadStr);

  db.prepare(
    `INSERT INTO audit_ledger (event_type, actor_pseudonym, domain_id, details, prev_hash, entry_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.eventType,
    params.actorPseudonym,
    params.domainId ?? null,
    params.details,
    prevHash,
    entryHash,
    createdAt
  );
}

function seedFederatedBaselines(): void {
  const existingRoundCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM federated_rounds').get() as { cnt: number }
  ).cnt;

  if (existingRoundCount > 0) {
    return;
  }

  const peerSeeds = [
    'zurich-cardio-node-01',
    'toronto-general-node-02',
    'osaka-biomed-node-03',
    'boston-clinical-node-04',
    'stockholm-research-node-05',
  ];
  const peerPseudonyms = peerSeeds.map((s) => derivePseudonymId(s));

  const domainIds = Object.keys(DISEASE_DOMAINS) as DiseaseDomainId[];

  const insertRound = db.prepare(`
    INSERT INTO federated_rounds (
      domain_id, round_number, global_accuracy, global_loss, auc_roc, sensitivity, specificity,
      epsilon_budget, delta_param, clipping_norm, participating_nodes,
      model_weights_json, model_bias, confusion_json, weights_sha256, aggregator_signature, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUpdate = db.prepare(`
    INSERT INTO node_updates (
      domain_id, round_number, pseudonym_id, local_sample_count, local_accuracy, local_loss,
      dp_noise_scale, gradient_l2_norm, encrypted_gradient_summary, gradient_iv, gradient_tag,
      update_sha256, verified_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const baseTime = Date.now() - 1000 * 60 * 60 * 12;

  for (const domainId of domainIds) {
    const spec = DISEASE_DOMAINS[domainId];
    let weights = [...spec.initialWeights];
    let bias = spec.initialBias;

    const initialMetrics = evaluateGlobalModel(domainId, weights, bias);
    const r1Time = new Date(baseTime).toISOString();
    const wJson1 = JSON.stringify(weights);
    const wSha1 = sha256Hex(`${domainId}|1|${wJson1}|${bias}`);
    const sig1 = signHmacHex(wSha1);

    insertRound.run(
      domainId,
      1,
      initialMetrics.accuracy,
      initialMetrics.loss,
      initialMetrics.aucRoc,
      initialMetrics.sensitivity,
      initialMetrics.specificity,
      1.2,
      1e-5,
      1.5,
      4,
      wJson1,
      bias,
      JSON.stringify(initialMetrics.confusionMatrix),
      wSha1,
      sig1,
      r1Time
    );

    for (let r = 2; r <= 10; r++) {
      const epsilon = Number((1.2 + (r - 1) * 0.14).toFixed(2));
      const nodes = 4 + (r % 2);
      const step = executeFederatedRoundStep({
        domainId,
        currentWeights: weights,
        currentBias: bias,
        participatingNodes: nodes,
        localSamples: 240 + r * 20,
        learningRate: 0.24,
        epsilon,
        clippingNorm: 1.5,
      });

      weights = step.newWeights;
      bias = step.newBias;
      const roundTime = new Date(baseTime + r * 1000 * 60 * 45).toISOString();
      const wJson = JSON.stringify(weights);
      const wSha = sha256Hex(`${domainId}|${r}|${wJson}|${bias}`);
      const sig = signHmacHex(wSha);

      insertRound.run(
        domainId,
        r,
        step.metrics.accuracy,
        step.metrics.loss,
        step.metrics.aucRoc,
        step.metrics.sensitivity,
        step.metrics.specificity,
        epsilon,
        1e-5,
        1.5,
        nodes,
        wJson,
        bias,
        JSON.stringify(step.metrics.confusionMatrix),
        wSha,
        sig,
        roundTime
      );

      const actorPseudo = peerPseudonyms[(r + domainIds.indexOf(domainId)) % peerPseudonyms.length];
      const encGrad = encryptJson({
        deltaSummary: step.deltaSummary,
        clippedNorm: step.clippedNorm,
        epsilon,
      });
      const updateSha = sha256Hex(`${actorPseudo}|${domainId}|${r}|${encGrad.ciphertext}`);

      insertUpdate.run(
        domainId,
        r,
        actorPseudo,
        240 + r * 20,
        step.localAccuracy,
        step.localLoss,
        step.dpNoiseScale,
        step.gradientL2Norm,
        encGrad.ciphertext,
        encGrad.iv,
        encGrad.authTag,
        updateSha,
        'verified',
        roundTime
      );
    }
  }

  appendAuditEntry({
    eventType: 'SYSTEM_GENESIS',
    actorPseudonym: 'aggregator-core',
    domainId: null,
    details: 'Initialized AES-256-GCM storage, HMAC-SHA256 pseudonymization, and 4 baseline federated disease manifolds.',
    createdAt: new Date(baseTime).toISOString(),
  });

  appendAuditEntry({
    eventType: 'FEDAVG_ROUND_VERIFIED',
    actorPseudonym: peerPseudonyms[0],
    domainId: 'cardiovascular',
    details: 'Aggregated Round 10 cardiovascular update with (2.46, 1e-5)-DP guarantee and SHA-256 digest verification.',
    createdAt: new Date(baseTime + 10 * 1000 * 60 * 45).toISOString(),
  });
}

function syncKeyEpoch(): void {
  const row = db
    .prepare("SELECT value FROM system_meta WHERE key = 'key_fingerprint'")
    .get() as { value: string } | undefined;

  if (!row) {
    db.prepare("INSERT INTO system_meta (key, value) VALUES ('key_fingerprint', ?)").run(KEY_FINGERPRINT);
    return;
  }

  if (row.value !== KEY_FINGERPRINT && IS_EPHEMERAL_ENCRYPTION_KEY) {
    // Ephemeral preview key rotated across server restart: cleanly reset ephemeral ciphertexts
    // and re-verify baseline rounds under the new session key.
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM diagnosis_records;
      DELETE FROM users;
      DELETE FROM node_updates;
      DELETE FROM federated_rounds;
      DELETE FROM audit_ledger;
    `);
    db.prepare("UPDATE system_meta SET value = ? WHERE key = 'key_fingerprint'").run(KEY_FINGERPRINT);
  }
}

export function initDatabase(): void {
  syncKeyEpoch();
  seedFederatedBaselines();
}
