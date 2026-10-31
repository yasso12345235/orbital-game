/**
 * ORBITAL server — global leaderboard routes.
 * Submit and fetch mission scores across all players.
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { leaderboardMissionParam, scoreBody, leaderboardQuery } from '../validation';
import { openDb, queryAll, queryRow, queryRun, persist } from '../db';

export const leaderboardRouter = Router();

function toEntry(row: {
  rank: number;
  user_id: string;
  username: string;
  mission_id: string;
  score: number;
  grade: string;
  difficulty: string;
  created_at: string;
}) {
  return {
    rank: row.rank,
    userId: row.user_id,
    username: row.username,
    missionId: row.mission_id,
    score: row.score,
    grade: row.grade,
    difficulty: row.difficulty,
    createdAt: row.created_at,
  };
}

/** Submit a mission score (authenticated). */
leaderboardRouter.post('/:missionId/score', requireAuth, async (req: AuthedRequest, res: Response) => {
  const missionParsed = leaderboardMissionParam.safeParse(req.params);
  const bodyParsed = scoreBody.safeParse(req.body);
  if (!missionParsed.success || !bodyParsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const userId = req.user!.sub;
  const username = req.user!.username;
  const missionId = missionParsed.data.missionId;
  const { score, grade, difficulty } = bodyParsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { db, persist: persistDb } = await openDb();
  try {
    await     queryRun(
      db,
      'INSERT INTO scores (id, user_id, username, mission_id, score, grade, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, username, missionId, score, grade, difficulty, now]
    );
    persistDb(db);

    return res.status(201).json({ ok: true, score, missionId, difficulty, createdAt: now });
  } finally {
    db.close();
  }
});

/** Get leaderboard for a mission (top scores globally), paginated. */
leaderboardRouter.get('/:missionId', async (req: Request, res: Response) => {
  const missionParsed = leaderboardMissionParam.safeParse(req.params);
  const queryParsed = leaderboardQuery.safeParse(req.query);
  if (!missionParsed.success || !queryParsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const missionId = missionParsed.data.missionId;
  const page = queryParsed.data.page;
  const pageSize = queryParsed.data.pageSize;
  const offset = (page - 1) * pageSize;

  const { db } = await openDb();
  try {
    const totalRow = queryRow(
      db,
      'SELECT COUNT(DISTINCT user_id) AS c FROM scores WHERE mission_id = ?',
      [missionId]
    ) as { c: number };
    const total = totalRow?.c ?? 0;

    const rows = queryAll(
      db,
      `SELECT s.id, s.user_id, s.username, s.mission_id, s.score, s.grade, s.difficulty, s.created_at
       FROM scores s
       JOIN (
         SELECT user_id, MAX(score) AS best_score
         FROM scores
         WHERE mission_id = ?
         GROUP BY user_id
       ) best ON best.user_id = s.user_id AND best.best_score = s.score
       WHERE s.mission_id = ?
       ORDER BY s.score DESC, s.created_at ASC
       LIMIT ? OFFSET ?`,
      [missionId, missionId, pageSize, offset]
    ) as {
      id: string;
      user_id: string;
      username: string;
      mission_id: string;
      score: number;
      grade: string;
      difficulty: string;
      created_at: string;
    }[];

    // Assign competition ranking (1224) based on score ordering.
    let prevScore: number | null = null;
    let rank = 0;
    const entries = rows.map((row, i) => {
      if (prevScore === null || row.score !== prevScore) {
        rank = i + 1;
        prevScore = row.score;
      }
      return toEntry({ ...row, rank });
    });

    return res.json({
      missionId,
      entries,
      total,
      page,
      pageSize,
    });
  } finally {
    db.close();
  }
});
