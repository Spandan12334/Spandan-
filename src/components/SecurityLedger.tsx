import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { SecurityLedgerResponse } from '../types';

interface SecurityLedgerProps {
  token: string;
}

export const SecurityLedger: React.FC<SecurityLedgerProps> = ({ token }) => {
  const [data, setData] = useState<SecurityLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.getSecurityLedger(token);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to fetch security ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [token]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setError(null);
    try {
      await api.verifySecurityLedger(token);
      await loadLedger();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const filteredEntries = (data?.entries ?? []).filter((entry) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.event_type.toLowerCase().includes(q) ||
      entry.actor_pseudonym.toLowerCase().includes(q) ||
      entry.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Cryptographic Protocols & Integrity Proof */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Active Cryptographic & Anonymity Protocols
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Enforced server-side across SQLite persistence, Bearer authentication, and FedAvg rounds
          </p>

          {data ? (
            <dl className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Storage Encryption</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                  {data.protocols.encryptionAtRest}
                </dd>
              </div>
              <div className="py-2.5 flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Credential KDF</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                  {data.protocols.passwordHashing}
                </dd>
              </div>
              <div className="py-2.5 flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">User Anonymity</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                  {data.protocols.anonymityLayer}
                </dd>
              </div>
              <div className="py-2.5 flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Differential Privacy</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                  {data.protocols.differentialPrivacy}
                </dd>
              </div>
              <div className="py-2.5 flex flex-wrap justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Key Epoch Fingerprint</dt>
                <dd className="font-mono text-xs text-slate-900 dark:text-slate-100">
                  {data.protocols.keyFingerprint}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="h-44 animate-pulse bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                System Integrity Verification
              </h2>
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-sky-400" aria-hidden="true" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Recomputes every SHA-256 hash link and HMAC-SHA256 round signature in SQLite
            </p>

            {data?.verification && (
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">
                    {data.verification.chainValid && data.verification.signaturesValid
                      ? `All ${data.verification.totalLedgerEntries} ledger links and ${data.verification.totalVerifiedRounds} model signatures verified`
                      : 'Integrity discrepancy detected'}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
                  Chain Head: {data.verification.latestHash}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={verifying || loading}
            onClick={handleVerifyChain}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{verifying ? 'Auditing Hash Chain...' : 'Verify Full Hash Chain'}</span>
          </button>
        </div>
      </div>

      {/* Tamper-Evident Audit Ledger Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Tamper-Evident Audit Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zero PII stored · Actors represented solely by salted HMAC-SHA256 node pseudonyms
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pseudonym or event..."
              aria-label="Filter audit ledger entries"
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4 font-medium">Event</th>
                <th className="py-2.5 px-4 font-medium">Actor Pseudonym</th>
                <th className="py-2.5 px-4 font-medium">Details</th>
                <th className="py-2.5 px-4 font-medium">Entry SHA-256</th>
                <th className="py-2.5 px-4 font-medium text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {entry.event_type}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-blue-700 dark:text-sky-400 whitespace-nowrap">
                    {entry.actor_pseudonym}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300 max-w-md">
                    {entry.details}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {entry.entry_hash.slice(0, 14)}...
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
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
