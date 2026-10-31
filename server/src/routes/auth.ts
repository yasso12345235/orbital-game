/**
 * ORBITAL server — auth routes (register / login).
 */
import { Router, Request, Response } from 'express';
import { registerSchema, loginSchema } from '../validation';
import { hashPassword, comparePassword, signAccessToken } from '../utils/auth';
import { openDb, queryRow, queryRun, persist } from '../db';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;
  const { db, persist: persistDb } = await openDb();
  try {
    const existing = queryRow(db, 'SELECT id FROM users WHERE username = ?', [username]) as
      | { id: string }
      | undefined;
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    await queryRun(
      db,
      'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [id, username, passwordHash, now]
    );
    persistDb(db);

    const token = signAccessToken({ sub: id, username });
    return res.status(201).json({
      token,
      user: { id, username, createdAt: now },
    });
  } finally {
    db.close();
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;
  const { db, persist: persistDb } = await openDb();
  try {
    const row = queryRow(db, 'SELECT * FROM users WHERE username = ?', [username]) as
      | { id: string; username: string; password_hash: string; created_at: string }
      | undefined;
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = row.password_hash ? await comparePassword(password, row.password_hash) : false;
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAccessToken({ sub: row.id, username: row.username });
    return res.json({
      token,
      user: { id: row.id, username: row.username, createdAt: row.created_at },
    });
  } finally {
    db.close();
  }
});
