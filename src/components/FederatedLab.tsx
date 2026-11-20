import React, { useState } from 'react';
import { Cpu, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { DiseaseDomainId, FederatedOverviewResponse } from '../types';

interface FederatedLabProps {
  token: string;
  pseudonymId: string;
  domainId: DiseaseDomainId;
  overview: FederatedOverviewResponse | null;
  onRoundCommitted: () => Promise<void>;
}

export const FederatedLab: React.FC<FederatedLabProps> = ({
  token,
  pseudonymId,
  domainId,
  overview,
  onRoundCommitted,
}) => {
  const [localSamples, setLocalSamples] = useState(320);
  const [learningRate, setLearningRate] = useState(0.25);
  const [epsilon, setEpsilon] = useState(1.8);
  const [clippingNorm, setClippingNorm] = useState(1.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    roundNumber: number;
    globalAccuracy: number;
    globalLoss: number;
    dpNoiseScale: number;
    weightsSha256: string;
    updateSha256: string;
    latencyMs: number;
  } | null>(null);

  const delta = 1e-5;
  const estimatedSigma = Math.min(
    0.18,
    (clippingNorm * Math.sqrt(2 * Math.log(1.25 / delta))) / (epsilon * Math.sqrt(localSamples))
  );

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, latencyMs } = await api.contributeRound(token, {
        domainId,
        localSamples,
        learningRate,
        epsilon,
        clippingNorm,
      });
      setReceipt({
        roundNumber: data.roundNumber,
        globalAccuracy: data.globalAccuracy,
        globalLoss: data.globalLoss,
        dpNoiseScale: data.dpNoiseScale,
        weightsSha256: data.weightsSha256,
        updateSha256: data.updateSha256,
        latencyMs,
      });
      await onRoundCommitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to commit federated update.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleContribute}
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Local Node Training & FedAvg Aggregation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Train on your local clinical shard · Gradients are L2-clipped, noised with (ε, δ)-DP, and submitted under pseudonym{' '}
              <span className="font-mono text-slate-700 dark:text-slate-300">{pseudonymId}</span>
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs text-rose-800 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="fl-samples" className="font-medium text-slate-700 dark:text-slate-300">
                  Local Cohort Sample Count (n)
                </label>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {localSamples} records
                </span>
              </div>
              <input
                id="fl-samples"
                type="range"
                min={64}
                max={2000}
                step={16}
                value={localSamples}
                onChange={(e) => setLocalSamples(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="fl-lr" className="font-medium text-slate-700 dark:text-slate-300">
                  Local SGD Learning Rate (η)
                </label>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {learningRate.toFixed(2)}
                </span>
              </div>
              <input
                id="fl-lr"
                type="range"
                min={0.05}
                max={0.6}
                step={0.05}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="fl-eps" className="font-medium text-slate-700 dark:text-slate-300">
                  Differential Privacy Budget (ε)
                </label>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  ε = {epsilon.toFixed(2)} (Lower = stronger privacy)
                </span>
              </div>
              <input
                id="fl-eps"
                type="range"
                min={0.4}
                max={6.0}
                step={0.2}
                value={epsilon}
                onChange={(e) => setEpsilon(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="fl-clip" className="font-medium text-slate-700 dark:text-slate-300">
                  L2 Gradient Clipping Norm (C)
                </label>
                <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {clippingNorm.toFixed(2)}
                </span>
              </div>
              <input
                id="fl-clip"
                type="range"
                min={0.5}
                max={3.5}
                step={0.1}
                value={clippingNorm}
                onChange={(e) => setClippingNorm(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Calibrated Gaussian Noise Scale (σ)</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {estimatedSigma.toFixed(5)}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            <Cpu className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Computing DP Gradients & Aggregating...'
                : 'Train Local Cohort & Submit Update'}
            </span>
          </button>
        </form>

        {/* Live Aggregation Receipt & Weight Inspector */}
        <div className="lg:col-span-6 space-y-6">
          <div
            aria-live="polite"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Federated Aggregation Receipt
            </h2>
            {!receipt ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Submit a local training step to inspect the newly signed global model digest, Byzantine norm validation, and updated validation accuracy.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>
                    Global Round {receipt.roundNumber} committed and HMAC-signed in {receipt.latencyMs} ms
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">New Accuracy</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                      {(receipt.globalAccuracy * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">Global Loss</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                      {receipt.globalLoss.toFixed(4)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <span className="text-slate-500 dark:text-slate-400 block">Applied σ</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                      {receipt.dpNoiseScale.toFixed(4)}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="truncate">Global Weights SHA-256: {receipt.weightsSha256}</div>
                  <div className="truncate">Encrypted Update SHA-256: {receipt.updateSha256}</div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Active Global Model Weight Vector
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
              {overview?.domain.name} · Round {overview?.latestRound?.roundNumber ?? 1} normalized coefficients
            </p>
            <div className="space-y-2.5">
              {overview?.domain.biomarkers.map((bm, i) => {
                const w = overview.latestRound?.weights[i] ?? 0;
                const pct = Math.min(100, Math.abs(w) * 70);
                return (
                  <div key={bm.key} className="text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-700 dark:text-slate-300">{bm.label}</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {w >= 0 ? '+' : ''}
                        {w.toFixed(4)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className={`h-full ${w >= 0 ? 'bg-blue-600 dark:bg-sky-400' : 'bg-cyan-600 dark:bg-teal-400'}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
