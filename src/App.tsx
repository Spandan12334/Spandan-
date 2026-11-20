import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Cpu, LayoutDashboard, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { DiagnosisStudio } from './components/DiagnosisStudio';
import { FederatedLab } from './components/FederatedLab';
import { OverviewDashboard } from './components/OverviewDashboard';
import { SecurityLedger } from './components/SecurityLedger';
import { api, ApiError } from './lib/api';
import type { AuthSession, DiseaseDomainId, FederatedOverviewResponse } from './types';

type ActiveTab = 'overview' | 'diagnosis' | 'federated' | 'security';

const DOMAIN_OPTIONS: Array<{ id: DiseaseDomainId; label: string }> = [
  { id: 'cardiovascular', label: 'Cardiovascular' },
  { id: 'pulmonary', label: 'Pulmonary' },
  { id: 'oncology', label: 'Oncology' },
  { id: 'neurological', label: 'Neurological' },
];

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [domainId, setDomainId] = useState<DiseaseDomainId>('cardiovascular');
  const [overview, setOverview] = useState<FederatedOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const loadOverview = useCallback(
    async (token: string, domain: DiseaseDomainId) => {
      setLoadingOverview(true);
      setFetchError(null);
      try {
        const { data } = await api.getFederatedOverview(token, domain);
        setOverview(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setSession(null);
        } else {
          setFetchError(err instanceof ApiError ? err.message : 'Unable to load federated telemetry.');
        }
      } finally {
        setLoadingOverview(false);
      }
    },
    []
  );

  useEffect(() => {
    if (session) {
      loadOverview(session.token, domainId);
    }
  }, [session, domainId, loadOverview]);

  const handleLogout = async () => {
    if (session) {
      try {
        await api.logout(session.token);
      } catch {
        // Session cleared in memory regardless
      }
    }
    setSession(null);
    setOverview(null);
    setActiveTab('overview');
  };

  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={(s) => setSession(s)}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />
    );
  }

  const navItems: Array<{ id: ActiveTab; label: string; Icon: React.FC<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'diagnosis', label: 'Diagnosis', Icon: Activity },
    { id: 'federated', label: 'Federated Lab', Icon: Cpu },
    { id: 'security', label: 'Security', Icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs px-4 sm:px-6 py-3">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 text-left"
          >
            AegisMed
          </button>

          <nav aria-label="Primary workspace navigation" className="hidden md:flex items-center gap-6">
            {navItems.map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    active
                      ? 'border-blue-600 dark:border-sky-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Context Bar (Domain Selector + Anonymized Node Identity + Theme Switch) */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 sm:px-6 py-3">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Disease Manifold
            </span>
            <div
              role="group"
              aria-label="Select disease diagnosis manifold"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {DOMAIN_OPTIONS.map((opt) => {
                const selected = domainId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDomainId(opt.id)}
                    aria-pressed={selected}
                    className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="truncate max-w-[220px]">{session.user.profile.institution}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-blue-700 dark:text-sky-400">
              {session.user.pseudonymId}
            </span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{session.user.role}</span>
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="ml-1 min-h-[36px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" aria-hidden="true" /> : <Moon className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {fetchError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          >
            {fetchError}
          </div>
        )}

        {activeTab === 'overview' && (
          <OverviewDashboard
            overview={overview}
            loading={loadingOverview}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'diagnosis' && (
          <DiagnosisStudio
            token={session.token}
            domainId={domainId}
            overview={overview}
            onRecordSaved={() => loadOverview(session.token, domainId)}
          />
        )}

        {activeTab === 'federated' && (
          <FederatedLab
            token={session.token}
            pseudonymId={session.user.pseudonymId}
            domainId={domainId}
            overview={overview}
            onRoundCommitted={() => loadOverview(session.token, domainId)}
          />
        )}

        {activeTab === 'security' && <SecurityLedger token={session.token} />}
      </main>

      {/* Mobile Bottom Navigation (< 15% mobile viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] grid grid-cols-4"
      >
        {navItems.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[56px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium px-1 ${
                active
                  ? 'text-blue-600 dark:text-sky-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate max-w-full">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
