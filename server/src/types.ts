/**
 * ORBITAL server — shared types.
 */

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface SaveRow {
  id: string;
  userId: string;
  label: string | null;
  data: string; // JSON string of PersistedGame
  savedAt: string;
  updatedAt: string;
}

export interface ScoreRow {
  id: string;
  userId: string;
  username: string;
  missionId: string;
  score: number;
  grade: string;
  difficulty: string;
  createdAt: string;
}

export interface JWTPayload {
  sub: string; // user id
  username: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface CloudSaveInput {
  label?: string | null;
  data: unknown; // PersistedGame-shaped object
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  missionId: string;
  score: number;
  grade: string;
  difficulty: string;
  createdAt: string;
}

export interface PaginatedLeaderboard {
  missionId: string;
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}
