/**
 * ORBITAL server — health route.
 */
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'orbital-server', time: new Date().toISOString() });
});
