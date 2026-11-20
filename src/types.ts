export type DiseaseDomainId = 'cardiovascular' | 'pulmonary' | 'oncology' | 'neurological';

export type UserRole = 'clinician' | 'coordinator' | 'auditor';

export interface UserProfile {
  fullName: string;
  email: string;
  institution: string;
  department: string;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: {
    pseudonymId: string;
    role: UserRole;
    profile: UserProfile;
    createdAt: string;
  };
}

export interface BiomarkerSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  mean: number;
  std: number;
  normalRange: string;
  defaultElevated: number;
  defaultHealthy: number;
}

export interface DomainSummary {
  id: DiseaseDomainId;
  name: string;
  shortName: string;
  clinicalTarget: string;
  latestRound: number;
  accuracy: number;
  aucRoc: number;
  epsilon: number;
}

export interface FederatedRoundPoint {
  roundNumber: number;
  globalAccuracy: number;
  globalLoss: number;
  aucRoc: number;
  sensitivity: number;
  specificity: number;
  epsilonBudget: number;
  participatingNodes: number;
  weightsSha256: string;
  createdAt: string;
}

export interface NodeUpdateRow {
  id: number;
  round_number: number;
  pseudonym_id: string;
  local_sample_count: number;
  local_accuracy: number;
  local_loss: number;
  dp_noise_scale: number;
  gradient_l2_norm: number;
  update_sha256: string;
  verified_status: 'verified' | 'rejected_anomaly';
  created_at: string;
}

export interface FederatedOverviewResponse {
  domain: {
    id: DiseaseDomainId;
    name: string;
    shortName: string;
    clinicalTarget: string;
    cohortDescription: string;
    biomarkers: BiomarkerSpec[];
  };
  domainSummaries: DomainSummary[];
  latestRound: {
    roundNumber: number;
    globalAccuracy: number;
    globalLoss: number;
    aucRoc: number;
    sensitivity: number;
    specificity: number;
    epsilonBudget: number;
    deltaParam: number;
    clippingNorm: number;
    participatingNodes: number;
    weights: number[];
    bias: number;
    confusionMatrix: { tp: number; fp: number; fn: number; tn: number };
    weightsSha256: string;
    signatureValid: boolean;
    createdAt: string;
  } | null;
  rounds: FederatedRoundPoint[];
  recentUpdates: NodeUpdateRow[];
}

export interface FeatureAttribution {
  key: string;
  label: string;
  value: number;
  unit: string;
  contribution: number;
  direction: 'risk-increasing' | 'protective';
}

export interface DiagnosisResultResponse {
  recordId: string;
  domainId: DiseaseDomainId;
  modelRoundUsed: number;
  patientAlias: string;
  prediction: {
    probability: number;
    riskLabel: 'Low Risk' | 'Moderate Risk' | 'High Risk';
    confidenceScore: number;
    logit: number;
    attributions: FeatureAttribution[];
  };
  encryption: {
    cipher: string;
    ivPreview: string;
    hmacPreview: string;
  };
  createdAt: string;
}

export interface DiagnosisHistoryItem {
  id: string;
  domainId: DiseaseDomainId;
  domainName: string;
  modelRoundUsed: number;
  predictionLabel: 'Low Risk' | 'Moderate Risk' | 'High Risk';
  confidenceScore: number;
  probability: number;
  patientAlias: string;
  biomarkers: Record<string, number>;
  attributions: FeatureAttribution[];
  integrityVerified: boolean;
  cipherIvPreview: string;
  createdAt: string;
}

export interface AuditLedgerEntry {
  id: number;
  event_type: string;
  actor_pseudonym: string;
  domain_id: string | null;
  details: string;
  prev_hash: string;
  entry_hash: string;
  created_at: string;
}

export interface LedgerVerificationResult {
  chainValid: boolean;
  signaturesValid: boolean;
  totalLedgerEntries: number;
  totalVerifiedRounds: number;
  brokenAtId: number | null;
  latestHash: string;
  checkedAt: string;
}

export interface SecurityLedgerResponse {
  entries: AuditLedgerEntry[];
  verification: LedgerVerificationResult;
  protocols: {
    encryptionAtRest: string;
    passwordHashing: string;
    anonymityLayer: string;
    differentialPrivacy: string;
    integrityLedger: string;
    keyFingerprint: string;
  };
}
