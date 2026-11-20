import type {
  AuthSession,
  DiagnosisHistoryItem,
  DiagnosisResultResponse,
  DiseaseDomainId,
  FederatedOverviewResponse,
  LedgerVerificationResult,
  SecurityLedgerResponse,
  UserRole,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<{ data: T; latencyMs: number }> {
  const start = performance.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const latencyMs = Math.round(performance.now() - start);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`,
      res.status
    );
  }

  return { data: json as T, latencyMs };
}

export const api = {
  register(payload: {
    fullName: string;
    email: string;
    password: string;
    institution: string;
    department: string;
    role: UserRole;
  }) {
    return request<AuthSession>('/api/auth/register', { method: 'POST', body: payload });
  },

  login(payload: { email: string; password: string }) {
    return request<AuthSession>('/api/auth/login', { method: 'POST', body: payload });
  },

  launchSandbox() {
    return request<AuthSession>('/api/auth/sandbox', { method: 'POST' });
  },

  logout(token: string) {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token });
  },

  getFederatedOverview(token: string, domain: DiseaseDomainId) {
    return request<FederatedOverviewResponse>(
      `/api/federated/overview?domain=${encodeURIComponent(domain)}`,
      { token }
    );
  },

  contributeRound(
    token: string,
    payload: {
      domainId: DiseaseDomainId;
      localSamples: number;
      learningRate: number;
      epsilon: number;
      clippingNorm: number;
    }
  ) {
    return request<{
      roundNumber: number;
      globalAccuracy: number;
      globalLoss: number;
      aucRoc: number;
      dpNoiseScale: number;
      weightsSha256: string;
      updateSha256: string;
      verifiedStatus: string;
    }>('/api/federated/contribute', { method: 'POST', token, body: payload });
  },

  runDiagnosis(
    token: string,
    payload: {
      domainId: DiseaseDomainId;
      patientAlias: string;
      biomarkers: Record<string, number>;
    }
  ) {
    return request<DiagnosisResultResponse>('/api/diagnosis/predict', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  getDiagnosisHistory(token: string) {
    return request<{ records: DiagnosisHistoryItem[] }>('/api/diagnosis/history', { token });
  },

  deleteDiagnosisRecord(token: string, id: string) {
    return request<{ ok: boolean }>(`/api/diagnosis/history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    });
  },

  getSecurityLedger(token: string) {
    return request<SecurityLedgerResponse>('/api/security/ledger', { token });
  },

  verifySecurityLedger(token: string) {
    return request<{ verification: LedgerVerificationResult }>('/api/security/verify-ledger', {
      method: 'POST',
      token,
    });
  },
};
