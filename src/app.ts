import cors from 'cors';
import express, { type RequestHandler } from 'express';
import type { TokenService } from './lib/tokens.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { createAuthRateLimit } from './middlewares/rateLimit.js';
import { authRouter } from './routes/auth.routes.js';
import { grupoRouter } from './routes/grupo.routes.js';
import { healthRouter } from './routes/health.routes.js';
import type { AuthService } from './services/auth.service.js';
import type { GrupoService } from './services/grupo.service.js';
import type { MiembroService } from './services/miembro.service.js';

export type AppDeps = {
  checkDb: () => Promise<void>;
  corsOrigins: string[];
  authService: AuthService;
  grupoService: GrupoService;
  miembroService: MiembroService;
  tokens: TokenService;
  /** Límite de intentos en /auth. Activo por defecto; los tests lo apagan. */
  rateLimit?: boolean;
};

const passThrough: RequestHandler = (_req, _res, next) => next();

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Render está detrás de un proxy: la IP real llega en X-Forwarded-For
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: (origin, cb) => cb(null, origin !== undefined && deps.corsOrigins.includes(origin)),
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter(deps.checkDb));
  app.use(
    '/api/auth',
    authRouter({
      authService: deps.authService,
      tokens: deps.tokens,
      limiter: deps.rateLimit === false ? passThrough : createAuthRateLimit(),
    }),
  );
  app.use(
    '/api/grupos',
    grupoRouter({
      grupoService: deps.grupoService,
      miembroService: deps.miembroService,
      tokens: deps.tokens,
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
