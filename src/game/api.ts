/**
 * Mission Architect — optional cloud API client.
 *
 * Thin fetch wrapper over the ORBITAL backend (server/). All methods are
 * offline-safe: they reject instead of throwing, and the caller decides
 * whether to fall back to localStorage. The JWT is kept in memory only;
 * persist it yourself (e.g. sessionStorage) if you want it across reloads.
 */
export type CloudUser = { id: string; username: string; createdAt: string };
export type CloudSave = {
  id: string;
  userId: string;
  label: string | null;
  data: unknown;
  savedAt: string;
  updatedAt: string;
};
export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  missionId: string;
  score: number;
  grade: string;
  difficulty: string;
  createdAt: string;
};

const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8787';

let token: string | null = null;

export function setAuthToken(t: string | null) {
  token = t;
}

export function getAuthToken(): string | null {
  return token;
}

async function request(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${BASE}${path}`, { headers, ...opts });
}

/* ---------------------------------------------------------------- auth */

export interface AuthResult {
  user: CloudUser;
  token: string;
}

export async function apiRegister(username: string, password: string): Promise<AuthResult> {
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Register failed');
  const body = (await res.json()) as { token: string; user: CloudUser };
  token = body.token;
  return { user: body.user, token: body.token };
}

export async function apiLogin(username: string, password: string): Promise<AuthResult> {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Login failed');
  const body = (await res.json()) as { token: string; user: CloudUser };
  token = body.token;
  return { user: body.user, token: body.token };
}

/* ---------------------------------------------------------------- saves */

export async function apiListSaves(): Promise<CloudSave[]> {
  const res = await request('/api/saves');
  if (!res.ok) throw new Error('Failed to list saves');
  const body = (await res.json()) as { saves: CloudSave[] };
  return body.saves;
}

export async function apiGetSave(id: string): Promise<CloudSave> {
  const res = await request(`/api/saves/${id}`);
  if (!res.ok) throw new Error('Save not found');
  return (await res.json()) as CloudSave;
}

export async function apiCreateSave(label: string | null, data: unknown): Promise<CloudSave> {
  const res = await request('/api/saves', {
    method: 'POST',
    body: JSON.stringify({ label, data }),
  });
  if (!res.ok) throw new Error('Failed to create save');
  return (await res.json()) as CloudSave;
}

export async function apiUpdateSave(id: string, label: string | null, data: unknown): Promise<{ id: string; label: string | null; updatedAt: string }> {
  const res = await request(`/api/saves/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ label, data }),
  });
  if (!res.ok) throw new Error('Failed to update save');
  return (await res.json()) as { id: string; label: string | null; updatedAt: string };
}

export async function apiDeleteSave(id: string): Promise<void> {
  const res = await request(`/api/saves/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete save');
}

/* ---------------------------------------------------------------- leaderboard */

export async function apiSubmitScore(
  missionId: string,
  score: number,
  grade: string,
  difficulty: string,
): Promise<{ ok: boolean; score: number; missionId: string; difficulty: string; createdAt: string }> {
  const res = await request(`/api/leaderboard/${missionId}/score`, {
    method: 'POST',
    body: JSON.stringify({ score, grade, difficulty }),
  });
  if (!res.ok) throw new Error('Failed to submit score');
  return (await res.json()) as {
    ok: boolean;
    score: number;
    missionId: string;
    difficulty: string;
    createdAt: string;
  };
}

export interface LeaderboardPage {
  missionId: string;
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function apiGetLeaderboard(
  missionId: string,
  page = 1,
  pageSize = 20,
): Promise<LeaderboardPage> {
  const res = await request(
    `/api/leaderboard/${missionId}?page=${page}&pageSize=${pageSize}`,
  );
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return (await res.json()) as LeaderboardPage;
}

/* ---------------------------------------------------------------- health */

export async function apiHealth(): Promise<{ status: string; service: string; time: string }> {
  const res = await request('/api/health');
  if (!res.ok) throw new Error('Backend unavailable');
  return (await res.json()) as { status: string; service: string; time: string };
}
