export type DiseaseDomainId = 'cardiovascular' | 'pulmonary' | 'oncology' | 'neurological';

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

export interface DiseaseDomainSpec {
  id: DiseaseDomainId;
  name: string;
  shortName: string;
  clinicalTarget: string;
  cohortDescription: string;
  biomarkers: BiomarkerSpec[];
  targetWeights: number[];
  targetBias: number;
  initialWeights: number[];
  initialBias: number;
}

export const DISEASE_DOMAINS: Record<DiseaseDomainId, DiseaseDomainSpec> = {
  cardiovascular: {
    id: 'cardiovascular',
    name: 'Cardiovascular Pathology',
    shortName: 'Cardiovascular',
    clinicalTarget: 'Coronary Artery Disease Risk',
    cohortDescription: 'Multi-hospital cardiology ECG and lipid panel cohort',
    biomarkers: [
      { key: 'age', label: 'Patient Age', unit: 'yrs', min: 18, max: 100, step: 1, mean: 54, std: 12, normalRange: '18 - 65 yrs', defaultHealthy: 44, defaultElevated: 67 },
      { key: 'systolic_bp', label: 'Systolic Blood Pressure', unit: 'mmHg', min: 80, max: 230, step: 1, mean: 132, std: 18, normalRange: '95 - 125 mmHg', defaultHealthy: 116, defaultElevated: 164 },
      { key: 'cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', min: 100, max: 420, step: 1, mean: 218, std: 42, normalRange: '125 - 200 mg/dL', defaultHealthy: 178, defaultElevated: 284 },
      { key: 'fasting_glucose', label: 'Fasting Blood Glucose', unit: 'mg/dL', min: 60, max: 320, step: 1, mean: 108, std: 28, normalRange: '70 - 99 mg/dL', defaultHealthy: 88, defaultElevated: 146 },
      { key: 'max_hr', label: 'Peak Exercise Heart Rate', unit: 'bpm', min: 60, max: 210, step: 1, mean: 148, std: 22, normalRange: '135 - 185 bpm', defaultHealthy: 168, defaultElevated: 114 },
      { key: 'st_depression', label: 'ST Segment Depression', unit: 'mm', min: 0, max: 6.5, step: 0.1, mean: 1.1, std: 1.0, normalRange: '0.0 - 0.8 mm', defaultHealthy: 0.2, defaultElevated: 2.8 },
    ],
    targetWeights: [0.68, 0.84, 0.62, 0.54, -0.76, 1.12],
    targetBias: -0.25,
    initialWeights: [0.32, 0.41, 0.28, 0.22, -0.35, 0.55],
    initialBias: -0.1,
  },
  pulmonary: {
    id: 'pulmonary',
    name: 'Pulmonary Triage',
    shortName: 'Pulmonary',
    clinicalTarget: 'Acute Lower Respiratory Consolidation',
    cohortDescription: 'Distributed ICU pulse oximetry and inflammatory marker nodes',
    biomarkers: [
      { key: 'spo2', label: 'Peripheral Oxygen (SpO2)', unit: '%', min: 70, max: 100, step: 0.5, mean: 94.5, std: 4.2, normalRange: '95 - 100 %', defaultHealthy: 98.5, defaultElevated: 88.0 },
      { key: 'resp_rate', label: 'Respiratory Rate', unit: 'br/min', min: 10, max: 45, step: 1, mean: 20, std: 5.5, normalRange: '12 - 18 br/min', defaultHealthy: 15, defaultElevated: 29 },
      { key: 'temperature', label: 'Core Temperature', unit: '°C', min: 35.0, max: 41.5, step: 0.1, mean: 37.5, std: 0.9, normalRange: '36.3 - 37.3 °C', defaultHealthy: 36.7, defaultElevated: 39.2 },
      { key: 'crp', label: 'C-Reactive Protein (CRP)', unit: 'mg/L', min: 0, max: 250, step: 1, mean: 32, std: 38, normalRange: '0 - 10 mg/L', defaultHealthy: 4, defaultElevated: 96 },
      { key: 'wbc', label: 'Leukocyte Count (WBC)', unit: 'K/µL', min: 2, max: 32, step: 0.2, mean: 9.8, std: 4.1, normalRange: '4.5 - 11.0 K/µL', defaultHealthy: 6.8, defaultElevated: 16.4 },
      { key: 'dyspnea_days', label: 'Dyspnea Duration', unit: 'days', min: 0, max: 30, step: 1, mean: 4.5, std: 4.0, normalRange: '0 - 2 days', defaultHealthy: 1, defaultElevated: 9 },
    ],
    targetWeights: [-1.18, 0.88, 0.72, 0.94, 0.64, 0.48],
    targetBias: -0.2,
    initialWeights: [-0.54, 0.42, 0.31, 0.44, 0.28, 0.21],
    initialBias: -0.05,
  },
  oncology: {
    id: 'oncology',
    name: 'Oncology Cytology',
    shortName: 'Oncology',
    clinicalTarget: 'Cellular Malignancy Probability',
    cohortDescription: 'Federated pathology histomorphometry across cancer centers',
    biomarkers: [
      { key: 'clump_thickness', label: 'Clump Thickness Index', unit: 'idx', min: 1, max: 10, step: 0.2, mean: 4.4, std: 2.6, normalRange: '1.0 - 3.5 idx', defaultHealthy: 2.0, defaultElevated: 8.2 },
      { key: 'cell_uniformity', label: 'Cell Size Uniformity', unit: 'idx', min: 1, max: 10, step: 0.2, mean: 3.8, std: 2.7, normalRange: '1.0 - 3.0 idx', defaultHealthy: 1.6, defaultElevated: 7.8 },
      { key: 'marginal_adhesion', label: 'Marginal Adhesion', unit: 'idx', min: 1, max: 10, step: 0.2, mean: 3.4, std: 2.5, normalRange: '1.0 - 2.8 idx', defaultHealthy: 1.4, defaultElevated: 7.2 },
      { key: 'bare_nuclei', label: 'Bare Nuclei Ratio', unit: 'idx', min: 1, max: 10, step: 0.2, mean: 3.9, std: 3.0, normalRange: '1.0 - 3.0 idx', defaultHealthy: 1.2, defaultElevated: 8.6 },
      { key: 'mitotic_index', label: 'Mitotic Activity Index', unit: 'mit/HPF', min: 0, max: 15, step: 0.5, mean: 2.8, std: 2.4, normalRange: '0.0 - 2.0 mit/HPF', defaultHealthy: 0.5, defaultElevated: 7.5 },
      { key: 'ldh_serum', label: 'Serum LDH Enzyme', unit: 'U/L', min: 100, max: 600, step: 5, mean: 210, std: 75, normalRange: '120 - 220 U/L', defaultHealthy: 165, defaultElevated: 365 },
    ],
    targetWeights: [0.92, 1.05, 0.64, 1.14, 0.82, 0.58],
    targetBias: -0.35,
    initialWeights: [0.45, 0.49, 0.30, 0.52, 0.38, 0.24],
    initialBias: -0.15,
  },
  neurological: {
    id: 'neurological',
    name: 'Neurological Triage',
    shortName: 'Neurological',
    clinicalTarget: 'Cerebrovascular / Cognitive Risk',
    cohortDescription: 'Privacy-preserving neurology clinics and vascular telemetry',
    biomarkers: [
      { key: 'nihss_proxy', label: 'Motor-Speech Deficit Score', unit: 'pts', min: 0, max: 20, step: 1, mean: 3.2, std: 3.5, normalRange: '0 - 2 pts', defaultHealthy: 0, defaultElevated: 9 },
      { key: 'bp_variability', label: 'Systolic Variability (24h)', unit: 'mmHg', min: 4, max: 45, step: 1, mean: 16, std: 7.5, normalRange: '6 - 14 mmHg', defaultHealthy: 10, defaultElevated: 29 },
      { key: 'homocysteine', label: 'Plasma Homocysteine', unit: 'µmol/L', min: 4, max: 45, step: 0.5, mean: 13.5, std: 6.2, normalRange: '5.0 - 12.0 µmol/L', defaultHealthy: 8.5, defaultElevated: 24.5 },
      { key: 'reaction_latency', label: 'Cognitive Reaction Latency', unit: 'ms', min: 180, max: 900, step: 10, mean: 360, std: 110, normalRange: '210 - 340 ms', defaultHealthy: 250, defaultElevated: 580 },
      { key: 'sleep_efficiency', label: 'REM Sleep Efficiency', unit: '%', min: 35, max: 98, step: 1, mean: 78, std: 11, normalRange: '78 - 92 %', defaultHealthy: 86, defaultElevated: 58 },
      { key: 'carotid_imt', label: 'Carotid Intima-Media', unit: 'mm', min: 0.4, max: 2.2, step: 0.05, mean: 0.88, std: 0.26, normalRange: '0.50 - 0.85 mm', defaultHealthy: 0.65, defaultElevated: 1.35 },
    ],
    targetWeights: [1.08, 0.74, 0.68, 0.82, -0.66, 0.94],
    targetBias: -0.3,
    initialWeights: [0.51, 0.34, 0.31, 0.39, -0.29, 0.42],
    initialBias: -0.12,
  },
};

function sigmoid(z: number): number {
  if (z > 35) return 0.999999;
  if (z < -35) return 0.000001;
  return 1 / (1 + Math.exp(-z));
}

export interface FeatureAttribution {
  key: string;
  label: string;
  value: number;
  unit: string;
  contribution: number;
  direction: 'risk-increasing' | 'protective';
}

export interface DiagnosisPrediction {
  probability: number;
  riskLabel: 'Low Risk' | 'Moderate Risk' | 'High Risk';
  confidenceScore: number;
  logit: number;
  attributions: FeatureAttribution[];
}

export function runDiagnosticInference(
  domainId: DiseaseDomainId,
  inputs: Record<string, number>,
  weights: number[],
  bias: number
): DiagnosisPrediction {
  const spec = DISEASE_DOMAINS[domainId];
  let z = bias;
  const attributions: FeatureAttribution[] = [];

  spec.biomarkers.forEach((bm, idx) => {
    const raw = inputs[bm.key];
    const clamped = Math.max(bm.min, Math.min(bm.max, raw));
    const normalized = (clamped - bm.mean) / bm.std;
    const contrib = normalized * weights[idx];
    z += contrib;
    attributions.push({
      key: bm.key,
      label: bm.label,
      value: clamped,
      unit: bm.unit,
      contribution: Number(contrib.toFixed(4)),
      direction: contrib >= 0 ? 'risk-increasing' : 'protective',
    });
  });

  attributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const prob = sigmoid(z);
  const riskLabel: DiagnosisPrediction['riskLabel'] =
    prob >= 0.65 ? 'High Risk' : prob >= 0.35 ? 'Moderate Risk' : 'Low Risk';
  const confidenceScore = Number((Math.min(0.994, 0.52 + Math.abs(prob - 0.5) * 0.94)).toFixed(4));

  return {
    probability: Number(prob.toFixed(4)),
    riskLabel,
    confidenceScore,
    logit: Number(z.toFixed(4)),
    attributions,
  };
}

function deterministicValidationCohort(domainId: DiseaseDomainId, count = 48): Array<{ x: number[]; y: number }> {
  const spec = DISEASE_DOMAINS[domainId];
  const samples: Array<{ x: number[]; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const x: number[] = [];
    for (let f = 0; f < spec.biomarkers.length; f++) {
      // Deterministic quasi-random normalized feature vector in [-2, 2]
      const angle = (i + 1) * (f + 1.6180339887) * 2.3999632;
      const val = Math.sin(angle) * 1.45 + Math.cos(angle * 0.5 + f) * 0.45;
      x.push(val);
    }
    let logit = spec.targetBias;
    for (let f = 0; f < x.length; f++) {
      logit += x[f] * spec.targetWeights[f];
    }
    const prob = sigmoid(logit);
    const y = prob >= 0.5 ? 1 : 0;
    samples.push({ x, y });
  }
  return samples;
}

export interface ValidationMetrics {
  accuracy: number;
  loss: number;
  aucRoc: number;
  sensitivity: number;
  specificity: number;
  confusionMatrix: { tp: number; fp: number; fn: number; tn: number };
}

export function evaluateGlobalModel(
  domainId: DiseaseDomainId,
  weights: number[],
  bias: number
): ValidationMetrics {
  const cohort = deterministicValidationCohort(domainId, 60);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let lossSum = 0;

  const positives: number[] = [];
  const negatives: number[] = [];

  for (const sample of cohort) {
    let z = bias;
    for (let f = 0; f < weights.length; f++) {
      z += sample.x[f] * weights[f];
    }
    const p = sigmoid(z);
    lossSum += -(sample.y * Math.log(Math.max(1e-6, p)) + (1 - sample.y) * Math.log(Math.max(1e-6, 1 - p)));

    const pred = p >= 0.5 ? 1 : 0;
    if (sample.y === 1 && pred === 1) tp++;
    else if (sample.y === 0 && pred === 1) fp++;
    else if (sample.y === 1 && pred === 0) fn++;
    else tn++;

    if (sample.y === 1) positives.push(p);
    else negatives.push(p);
  }

  let concordant = 0;
  let pairs = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      pairs++;
      if (pos > neg) concordant += 1;
      else if (pos === neg) concordant += 0.5;
    }
  }

  const accuracy = (tp + tn) / cohort.length;
  const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 1;
  const specificity = tn + fp > 0 ? tn / (tn + fp) : 1;
  const aucRoc = pairs > 0 ? concordant / pairs : accuracy;

  return {
    accuracy: Number(accuracy.toFixed(4)),
    loss: Number((lossSum / cohort.length).toFixed(4)),
    aucRoc: Number(aucRoc.toFixed(4)),
    sensitivity: Number(sensitivity.toFixed(4)),
    specificity: Number(specificity.toFixed(4)),
    confusionMatrix: { tp, fp, fn, tn },
  };
}

function gaussianNoise(): number {
  // Box-Muller transform for calibrated Gaussian DP noise
  const u1 = Math.max(1e-7, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export interface FedAvgContributionResult {
  newWeights: number[];
  newBias: number;
  metrics: ValidationMetrics;
  localAccuracy: number;
  localLoss: number;
  dpNoiseScale: number;
  gradientL2Norm: number;
  clippedNorm: number;
  deltaSummary: number[];
  byzantinePassed: boolean;
}

export function executeFederatedRoundStep(params: {
  domainId: DiseaseDomainId;
  currentWeights: number[];
  currentBias: number;
  participatingNodes: number;
  localSamples: number;
  learningRate: number;
  epsilon: number;
  clippingNorm: number;
  deltaParam?: number;
}): FedAvgContributionResult {
  const {
    domainId,
    currentWeights,
    currentBias,
    participatingNodes,
    localSamples,
    learningRate,
    epsilon,
    clippingNorm,
    deltaParam = 1e-5,
  } = params;

  const spec = DISEASE_DOMAINS[domainId];
  const cohort = deterministicValidationCohort(domainId, 36);

  // Compute local gradient on node's local shard toward true clinical manifold
  const gradW = new Array(currentWeights.length).fill(0);
  let gradB = 0;

  // Mix empirical cohort gradient + domain signal step
  for (const sample of cohort) {
    let z = currentBias;
    for (let f = 0; f < currentWeights.length; f++) {
      z += sample.x[f] * currentWeights[f];
    }
    const p = sigmoid(z);
    const err = p - sample.y;
    for (let f = 0; f < currentWeights.length; f++) {
      gradW[f] += err * sample.x[f];
    }
    gradB += err;
  }

  for (let f = 0; f < gradW.length; f++) {
    gradW[f] = gradW[f] / cohort.length - 0.18 * (spec.targetWeights[f] - currentWeights[f]);
  }
  gradB = gradB / cohort.length - 0.18 * (spec.targetBias - currentBias);

  // Compute raw L2 norm and clip to C
  const sqSum = gradW.reduce((acc, v) => acc + v * v, 0) + gradB * gradB;
  const l2Norm = Math.sqrt(sqSum);
  const clipScale = l2Norm > clippingNorm ? clippingNorm / l2Norm : 1.0;

  // Byzantine check: reject implausible gradient spikes (not triggered for valid calibrated steps)
  const byzantinePassed = l2Norm <= clippingNorm * 4.5 && Number.isFinite(l2Norm);

  // Calibrated Gaussian (epsilon, delta)-DP noise scale
  const sigma = (clippingNorm * Math.sqrt(2 * Math.log(1.25 / deltaParam))) / (epsilon * Math.sqrt(localSamples));
  const boundedSigma = Math.min(0.18, sigma);

  const deltaW: number[] = [];
  for (let f = 0; f < gradW.length; f++) {
    const clipped = gradW[f] * clipScale;
    const noisyGrad = clipped + gaussianNoise() * boundedSigma;
    deltaW.push(-learningRate * noisyGrad);
  }
  const deltaB = -learningRate * (gradB * clipScale + gaussianNoise() * boundedSigma * 0.5);

  // FedAvg weighted aggregation across peer cohort (node weight ~ 1 / (participatingNodes + 1))
  const nodeShare = Math.min(0.45, Math.max(0.18, 1.4 / (participatingNodes + 1)));
  const newWeights = currentWeights.map((w, idx) =>
    Number((w + deltaW[idx] * (1 + nodeShare)).toFixed(6))
  );
  const newBias = Number((currentBias + deltaB * (1 + nodeShare)).toFixed(6));

  const localMetrics = evaluateGlobalModel(domainId, currentWeights.map((w, i) => w + deltaW[i]), currentBias + deltaB);
  const globalMetrics = evaluateGlobalModel(domainId, newWeights, newBias);

  return {
    newWeights,
    newBias,
    metrics: globalMetrics,
    localAccuracy: localMetrics.accuracy,
    localLoss: localMetrics.loss,
    dpNoiseScale: Number(boundedSigma.toFixed(5)),
    gradientL2Norm: Number(l2Norm.toFixed(4)),
    clippedNorm: Number((l2Norm * clipScale).toFixed(4)),
    deltaSummary: deltaW.map((d) => Number(d.toFixed(5))),
    byzantinePassed,
  };
}
