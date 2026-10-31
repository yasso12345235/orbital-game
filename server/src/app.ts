/**
 * ORBITAL server — Express app assembly.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { savesRouter } from './routes/saves';
import { leaderboardRouter } from './routes/leaderboard';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.ORBITAL_CORS_ORIGIN || '*',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '4mb' })); // saves are a few KB, allow headroom

  app.get('/', (_req, res) => {
    res.json({ name: 'orbital-server', version: '1.0.0' });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/saves', savesRouter);
  app.use('/api/leaderboard', leaderboardRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
