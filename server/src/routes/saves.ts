/**
 * ORBITAL server — cloud save routes.
 * Stores the game's PersistedGame JSON per authenticated user.
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { saveIdParam, cloudSaveBody } from '../validation';
import { openDb, queryAll, queryRow, queryRun, persist } from '../db';

export const savesRouter = Router();

function toSaveRow(row: {
  id: string;
  user_id: string;
  label: string | null;
  data: string;
  saved_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    data: JSON.parse(row.data as string),
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}

/** List the user's cloud saves (most recent first). */
savesRouter.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user!.sub;
  const { db } = await openDb();
  try {
    const rows = queryAll(
      db,
      'SELECT id, user_id, label, data, saved_at, updated_at FROM saves WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    ) as {
      id: string;
      user_id: string;
      label: string | null;
      data: string;
      saved_at: string;
      updated_at: string;
    }[];
    return res.json({ saves: rows.map(toSaveRow) });
  } finally {
    db.close();
  }
});

/** Get a single save (owner only). */
savesRouter.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = saveIdParam.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid save id' });
  }

  const userId = req.user!.sub;
  const { db } = await openDb();
  try {
    const row = queryRow(
      db,
      'SELECT id, user_id, label, data, saved_at, updated_at FROM saves WHERE id = ? AND user_id = ?',
      [parsed.data.id, userId]
    ) as
      | {
          id: string;
          user_id: string;
          label: string | null;
          data: string;
          saved_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Save not found' });
    }
    return res.json(toSaveRow(row));
  } finally {
    db.close();
  }
});

/** Create a save. Body: { label?, data: PersistedGame }. */
savesRouter.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = cloudSaveBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { label, data } = parsed.data;
  const userId = req.user!.sub;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(data ?? {});

  const { db, persist: persistDb } = await openDb();
  try {
    await queryRun(
      db,
      'INSERT INTO saves (id, user_id, label, data, saved_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, label ?? null, dataJson, now, now]
    );
    persistDb(db);
    return res.status(201).json({
      id,
      userId,
      label,
      savedAt: now,
      updatedAt: now,
    });
  } finally {
    db.close();
  }
});

/** Replace an existing save (owner only). */
savesRouter.put('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const idParsed = saveIdParam.safeParse(req.params);
  const bodyParsed = cloudSaveBody.safeParse(req.body);
  if (!idParsed.success || !bodyParsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { label, data } = bodyParsed.data;
  const userId = req.user!.sub;
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(data ?? {});

  const { db, persist: persistDb } = await openDb();
  try {
    const result = await queryRun(
      db,
      'UPDATE saves SET label = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [label ?? null, dataJson, now, idParsed.data.id, userId]
    );
    persistDb(db);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Save not found' });
    }
    return res.json({ id: idParsed.data.id, label, updatedAt: now });
  } finally {
    db.close();
  }
});

/** Delete a save (owner only). */
savesRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = saveIdParam.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid save id' });
  }

  const userId = req.user!.sub;
  const { db, persist: persistDb } = await openDb();
  try {
    const result = await queryRun(db, 'DELETE FROM saves WHERE id = ? AND user_id = ?', [
      parsed.data.id,
      userId,
    ]);
    persistDb(db);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Save not found' });
    }
    return res.json({ ok: true });
  } finally {
    db.close();
  }
});
