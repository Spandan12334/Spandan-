import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type {
  DiagnosisHistoryItem,
  DiagnosisResultResponse,
  DiseaseDomainId,
  FederatedOverviewResponse,
} from '../types';

interface DiagnosisStudioProps {
  token: string;
  domainId: DiseaseDomainId;
  overview: FederatedOverviewResponse | null;
  onRecordSaved: () => void;
}

export const DiagnosisStudio: React.FC<DiagnosisStudioProps> = ({
  token,
  domainId,
  overview,
  onRecordSaved,
}) => {
  const biomarkers = overview?.domain.biomarkers ?? [];

  const [patientAlias, setPatientAlias] = useState('CASE-ANON-104');
  const [values, setValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<DiagnosisResultResponse | null>(null);
  const [history, setHistory] = useState<DiagnosisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    const defaults: Record<string, number> = {};
    for (const bm of biomarkers) {
      defaults[bm.key] = bm.defaultHealthy;
    }
    setValues(defaults);
    setLatestResult(null);
    setError(null);
  }, [domainId, biomarkers.length]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await api.getDiagnosisHistory(token);
      setHistory(data.records);
    } catch {
      // handled silently on initial fetch if empty
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [token]);

  const applyPreset = (preset: 'healthy' | 'elevated') => {
    const next: Record<string, number> = {};
    for (const bm of biomarkers) {
      next[bm.key] = preset === 'healthy' ? bm.defaultHealthy : bm.defaultElevated;
    }
    setValues(next);
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, latencyMs: ms } = await api.runDiagnosis(token, {
        domainId,
        patientAlias,
        biomarkers: values,
      });
      setLatestResult(data);
      setLatencyMs(ms);
      await loadHistory();
      onRecordSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to execute encrypted inference.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDiagnosisRecord(token, id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to purge record.');
    }
  };

  const riskBadgeStyle = (label: string) => {
    if (label === 'High Risk') {
      return {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
        bar: 'bg-rose-600',
        Icon: ShieldAlert,
      };
    }
    if (label === 'Moderate Risk') {
      return {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
        bar: 'bg-amber-500',
        Icon: AlertTriangle,
      };
    }
    return {
      text: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
      bar: 'bg-emerald-600',
      Icon: CheckCircle2,
    };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Intake Form */}
        <form
          onSubmit={handlePredict}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Encrypted Clinical Biomarker Inference
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {overview?.domain.name} · Round {overview?.latestRound?.roundNumber ?? 1} global parameters
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('healthy')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Healthy Baseline
              </button>
              <button
                type="button"
                onClick={() => applyPreset('elevated')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Elevated Risk Case
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs text-rose-800 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="diag-alias" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              De-identified Case Reference (No Patient Name or SSN)
            </label>
            <input
              id="diag-alias"
              type="text"
              maxLength={48}
              value={patientAlias}
              onChange={(e) => setPatientAlias(e.target.value)}
              className="w-full min-h-[42px] px-3.5 py-2 font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {biomarkers.map((bm) => {
              const current = values[bm.key] ?? bm.defaultHealthy;
              return (
                <div
                  key={bm.key}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-900/40"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label
                      htmlFor={`bm-${bm.key}`}
                      className="text-xs font-medium text-slate-800 dark:text-slate-200"
                    >
                      {bm.label}
                    </label>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {bm.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id={`bm-${bm.key}-range`}
                      type="range"
                      min={bm.min}
                      max={bm.max}
                      step={bm.step}
                      value={current}
                      aria-label={`${bm.label} slider`}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [bm.key]: Number(e.target.value) }))
                      }
                      className="flex-1 accent-blue-600"
                    />
                    <input
                      id={`bm-${bm.key}`}
                      type="number"
                      min={bm.min}
                      max={bm.max}
                      step={bm.step}
                      value={current}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [bm.key]: Number(e.target.value) }))
                      }
                      className="w-22 min-h-[38px] px-2.5 py-1 text-right font-mono text-sm tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Reference: {bm.normalRange}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" aria-hidden="true" />
              <span>Payload encrypted with AES-256-GCM before SQLite persistence</span>
            </p>
            <button
              type="submit"
              disabled={submitting || biomarkers.length === 0}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {submitting ? 'Encrypting & Diagnosing...' : 'Run Encrypted Diagnosis'}
            </button>
          </div>
        </form>

        {/* Result Panel */}
        <div
          aria-live="polite"
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Diagnostic Inference & Attribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Per-biomarker log-odds attribution from global federated weights
            </p>
          </div>

          {!latestResult ? (
            <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg px-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Adjust clinical biomarkers on the left and run diagnosis to inspect risk probability, feature attributions, and encryption metadata.
              </p>
            </div>
          ) : (
            (() => {
              const badge = riskBadgeStyle(latestResult.prediction.riskLabel);
              const StatusIcon = badge.Icon;
              const pct = Math.round(latestResult.prediction.probability * 1000) / 10;
              return (
                <div className="space-y-4">
                  <div className={`rounded-lg border p-4 ${badge.bg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-2 text-sm font-semibold ${badge.text}`}>
                        <StatusIcon className="w-4 h-4" aria-hidden="true" />
                        <span>{latestResult.prediction.riskLabel}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        Round {latestResult.modelRoundUsed}
                        {latencyMs !== null ? ` · ${latencyMs} ms` : ''}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-3xl font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {pct.toFixed(1)}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1">
                          % risk probability
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        Conf {(latestResult.prediction.confidenceScore * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-2.5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${badge.bar} transition-all duration-200`}
                        style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Biomarker Risk Contributions
                    </h3>
                    <div className="space-y-2">
                      {latestResult.prediction.attributions.map((attr) => {
                        const widthPct = Math.min(100, Math.abs(attr.contribution) * 45);
                        const isRisk = attr.contribution >= 0;
                        return (
                          <div key={attr.key} className="text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-slate-700 dark:text-slate-300 truncate">
                                {attr.label}{' '}
                                <span className="font-mono text-slate-500 dark:text-slate-400">
                                  ({attr.value} {attr.unit})
                                </span>
                              </span>
                              <span
                                className={`font-mono tabular-nums shrink-0 ${
                                  isRisk
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {isRisk ? '+' : ''}
                                {attr.contribution.toFixed(2)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-xs overflow-hidden">
                              <div
                                className={`h-full ${isRisk ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.max(4, widthPct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
                    <div>
                      Vault Cipher: {latestResult.encryption.cipher} · IV {latestResult.encryption.ivPreview}...
                    </div>
                    <div>Integrity HMAC: {latestResult.encryption.hmacPreview}...</div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Encrypted Diagnosis History Vault */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Encrypted Diagnosis Vault
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Decrypted dynamically for your authenticated node only · HMAC-SHA256 tamper verification
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {history.length} encrypted records
          </span>
        </div>

        {loadingHistory ? (
          <div className="p-6 text-xs text-slate-500 dark:text-slate-400">Decrypting owner vault...</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No encrypted diagnosis records stored for this clinician node yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4 font-medium">Case Alias</th>
                  <th className="py-2.5 px-4 font-medium">Domain</th>
                  <th className="py-2.5 px-4 font-medium">Risk Assessment</th>
                  <th className="py-2.5 px-4 font-medium text-right">Probability</th>
                  <th className="py-2.5 px-4 font-medium text-right">Model</th>
                  <th className="py-2.5 px-4 font-medium">HMAC Integrity</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-900 dark:text-slate-100">
                      {rec.patientAlias}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {rec.domainName}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium">
                      <span
                        className={
                          rec.predictionLabel === 'High Risk'
                            ? 'text-rose-700 dark:text-rose-400'
                            : rec.predictionLabel === 'Moderate Risk'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {rec.predictionLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                      {(rec.probability * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
                      R{rec.modelRoundUsed}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono">
                      {rec.integrityVerified ? (
                        <span className="text-emerald-700 dark:text-emerald-400">● Valid</span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400">✖ Tampered</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(rec.id)}
                        aria-label={`Purge encrypted record ${rec.patientAlias}`}
                        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
