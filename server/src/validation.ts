/**
 * ORBITAL server — validation schemas.
 */
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const saveIdParam = z.object({
  id: z.string().uuid(),
});

export const cloudSaveBody = z.object({
  label: z.string().max(64).optional().nullable(),
  data: z.any(),
});

export const leaderboardMissionParam = z.object({
  missionId: z.string().min(1),
});

export const scoreBody = z.object({
  score: z.number().int().min(0).max(1e9),
  grade: z.string().max(8),
  difficulty: z.string().min(1).max(32),
});

export const leaderboardQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
