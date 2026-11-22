import { Router } from 'express';

export function healthRouter(checkDb: () => Promise<void>): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await checkDb();
      res.json({ status: 'ok', db: 'ok' });
    } catch (err) {
      console.error('Health check: la base de datos no responde', err);
      res.status(503).json({ status: 'error', db: 'error' });
    }
  });
  return router;
}
