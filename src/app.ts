import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { healthRouter } from './routes/health.routes.js';

export type AppDeps = {
  checkDb: () => Promise<void>;
  corsOrigins: string[];
};

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, cb) => cb(null, origin !== undefined && deps.corsOrigins.includes(origin)),
    }),
  );
  app.use(express.json());
  app.use('/api/health', healthRouter(deps.checkDb));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
