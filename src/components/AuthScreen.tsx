import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Moon, ShieldCheck, Sun, UserPlus } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { AuthSession, UserRole } from '../types';

interface AuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isDark,
  onToggleTheme,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('Clinical Diagnostics');
  const [role, setRole] = useState<UserRole>('clinician');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return { label: '', score: 0 };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'High entropy'];
    return { label: labels[score] ?? 'Fair', score };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'register') {
        const { data } = await api.register({
          fullName,
          email,
          password,
          institution,
          department,
          role,
        });
        onAuthenticated(data);
      } else {
        const { data } = await api.login({ email, password });
        onAuthenticated(data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach authentication service. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSandboxLaunch = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.launchSandbox();
      onAuthenticated(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to start sandbox session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-6 py-3.5">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            AegisMed
          </span>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span>Federated Disease Diagnosis</span>
            <span aria-hidden="true">·</span>
            <span>AES-256-GCM Storage</span>
            <span aria-hidden="true">·</span>
            <span>Differential Privacy</span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-[1160px] grid grid-cols-1 lg:grid-cols-12 items-stretch bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Form Column */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                Privacy-preserving federated clinical diagnostics
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-[54ch]">
                Authenticate your clinical node to run encrypted disease risk inference, contribute differentially private model gradients, and verify ledger integrity.
              </p>

              {/* Segmented Tab Switcher */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="mt-6 grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`min-h-[40px] px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`min-h-[40px] px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Register Node
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                {mode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="auth-fullname" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Clinician Full Name
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Maya Lin"
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="auth-institution" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Hospital / Research Node
                      </label>
                      <input
                        id="auth-institution"
                        type="text"
                        required
                        autoComplete="organization"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Zurich University Hospital"
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Institutional Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="clinician@hospital.org"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                {mode === 'register' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="auth-dept" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Clinical Department
                      </label>
                      <input
                        id="auth-dept"
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Cardiology & Diagnostics"
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="auth-role" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Node Role
                      </label>
                      <select
                        id="auth-role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        <option value="clinician">Clinician (Inference + Training)</option>
                        <option value="coordinator">Federation Coordinator</option>
                        <option value="auditor">Privacy & Integrity Auditor</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Passphrase
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your passphrase'}
                      className="w-full min-h-[44px] pl-3.5 pr-11 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === 'register' && password.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 flex-1 mr-3" aria-hidden="true">
                        {[1, 2, 3, 4].map((step) => (
                          <span
                            key={step}
                            className={`h-1 flex-1 rounded-xs ${
                              passwordStrength.score >= step
                                ? passwordStrength.score >= 3
                                  ? 'bg-emerald-600'
                                  : 'bg-amber-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono">{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {mode === 'register' ? (
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>
                      {submitting
                        ? 'Authenticating...'
                        : mode === 'register'
                        ? 'Create Encrypted Account'
                        : 'Sign In to Node'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSandboxLaunch}
                    className="min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Try Sandbox Clinician
                  </button>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-sky-400" aria-hidden="true" />
                Zero-PII Federation Protocol
              </span>
              <span aria-hidden="true">·</span>
              <span>scrypt Salted Passwords</span>
              <span aria-hidden="true">·</span>
              <span>AES-256-GCM Clinical Vault</span>
            </div>
          </div>

          {/* Visual Showcase Column */}
          <div className="lg:col-span-6 relative min-h-[280px] lg:min-h-[540px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col justify-end overflow-hidden">
            {!imgFailed ? (
              <img
                src="/src/assets/images/federated_clinical_mesh_1795208065417.jpg"
                alt="Isometric scientific diagram of federated clinical research nodes exchanging encrypted gradient waveforms"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center"
              >
                <ShieldCheck className="w-16 h-16 text-sky-400/50" />
              </div>
            )}

            <div className="relative z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent p-6 sm:p-8 text-white">
              <p className="font-mono text-xs tracking-wide text-sky-300">
                Cryptographic Privacy Architecture
              </p>
              <h2 className="mt-1.5 font-display text-xl font-semibold text-white [text-wrap:balance]">
                Patient records stay encrypted on your node
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed max-w-[52ch]">
                Only clipped, differentially private gradient updates bound to salted HMAC-SHA256 node pseudonyms participate in global FedAvg model rounds.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-300">
                <span>AES-256-GCM</span>
                <span aria-hidden="true">·</span>
                <span>Gaussian (ε, 1e-5)-DP</span>
                <span aria-hidden="true">·</span>
                <span>SHA-256 Hash Chain</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
