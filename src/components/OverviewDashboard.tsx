import React from 'react';
import {
  CalibrationRadarChart,
  ConfusionHeatmap,
  ConvergenceChart,
  PrivacyUtilityChart,
} from './Charts';
import type { FederatedOverviewResponse } from '../types';

interface OverviewDashboardProps {
  overview: FederatedOverviewResponse | null;
  loading: boolean;
  onNavigateTab: (tab: 'diagnosis' | 'federated' | 'security') => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  overview,
  loading,
  onNavigateTab,
}) => {
  if (loading && !overview) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading federated overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
      </div>
    );
  }

  if (!overview || !overview.latestRound) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No federated round telemetry available for this disease manifold yet.
        </p>
      </div>
    );
  }

  const { latestRound, rounds, recentUpdates, domain } = overview;
  const firstRound = rounds[0];
  const accDelta = firstRound
    ? ((latestRound.globalAccuracy - firstRound.globalAccuracy) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section aria-label="Key federated model metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Global Diagnostic Accuracy
          </p>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {(latestRound.globalAccuracy * 100).toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">%</span>
          </div>
          <p className="mt-1.5 text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            +{accDelta}% since Round 1
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            AUC-ROC Calibration
          </p>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {latestRound.aucRoc.toFixed(3)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">idx</span>
          </div>
          <p className="mt-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            Sens {(latestRound.sensitivity * 100).toFixed(1)}% · Spec{' '}
            {(latestRound.specificity * 100).toFixed(1)}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Differential Privacy Budget
          </p>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {latestRound.epsilonBudget.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">ε</span>
          </div>
          <p className="mt-1.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            δ = {latestRound.deltaParam.toExponential(0)} · Clip C = {latestRound.clippingNorm.toFixed(1)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Anonymized Cohort
          </p>
          <div className="mt-2 flex items-baseline">
            <span className="text-2xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {latestRound.participatingNodes}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
              nodes · R{latestRound.roundNumber}
            </span>
          </div>
          <p className="mt-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400">
            {latestRound.signatureValid ? '● HMAC Signature Verified' : '✖ Signature Mismatch'}
          </p>
        </div>
      </section>

      {/* Primary Charts Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                FedAvg Model Convergence
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {domain.clinicalTarget} · Hover or tab across round nodes for exact telemetry
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('federated')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Contribute Round
            </button>
          </div>
          <ConvergenceChart rounds={rounds} />
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Multi-Axis Clinical Calibration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Round {latestRound.roundNumber} balanced against Round 1 baseline
            </p>
          </div>
          <CalibrationRadarChart latest={latestRound} baseline={firstRound} />
        </div>
      </section>

      {/* Secondary Row: Privacy-Utility Curve + Confusion Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Differential Privacy-Utility Envelope
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theoretical Gaussian (ε, δ)-DP utility bound vs active model operating point
            </p>
          </div>
          <PrivacyUtilityChart
            currentEpsilon={latestRound.epsilonBudget}
            currentAccuracy={latestRound.globalAccuracy}
          />
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Validation Confusion Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Held-out validation cohort (n = 60) · Round {latestRound.roundNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('diagnosis')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              Run Diagnosis
            </button>
          </div>
          <ConfusionHeatmap matrix={latestRound.confusionMatrix} />
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono truncate max-w-full">
              SHA-256 Digest: {latestRound.weightsSha256.slice(0, 24)}...
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('security')}
              className="text-blue-600 dark:text-sky-400 hover:underline font-medium whitespace-nowrap"
            >
              Inspect Audit Chain
            </button>
          </div>
        </div>
      </section>

      {/* Anonymized Node Contribution Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Recent Anonymized Node Contributions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identities decoupled via salted HMAC-SHA256 pseudonyms · Gradient deltas encrypted at rest
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 font-medium">Pseudonym Node</th>
                <th className="py-2.5 px-4 font-medium text-right">Round</th>
                <th className="py-2.5 px-4 font-medium text-right">Samples</th>
                <th className="py-2.5 px-4 font-medium text-right">Local Acc</th>
                <th className="py-2.5 px-4 font-medium text-right">DP Noise (σ)</th>
                <th className="py-2.5 px-4 font-medium text-right">L2 Norm</th>
                <th className="py-2.5 px-4 font-medium">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentUpdates.slice(0, 6).map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {u.pseudonym_id}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                    R{u.round_number}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {u.local_sample_count}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {(u.local_accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {u.dp_noise_scale.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {u.gradient_l2_norm.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                    {u.verified_status === 'verified' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        ● Verified
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-400 font-medium">
                        ▲ Rejected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
