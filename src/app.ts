import cors from 'cors';
import express, { type RequestHandler } from 'express';
import type { TokenService } from './lib/tokens.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import {
  createAuthRateLimit,
  createBusquedaRateLimit,
  createMiembrosRateLimit,
} from './middlewares/rateLimit.js';
import { authRouter } from './routes/auth.routes.js';
import { grupoRouter } from './routes/grupo.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { usuarioRouter } from './routes/usuario.routes.js';
import type { InvitacionService } from './services/invitacion.service.js';
import type { MedioService } from './services/medio.service.js';
import type { AuthService } from './services/auth.service.js';
import type { BalanceService } from './services/balance.service.js';
import type { GastoService } from './services/gasto.service.js';
import type { GrupoService } from './services/grupo.service.js';
import type { MiembroService } from './services/miembro.service.js';

export type AppDeps = {
  checkDb: () => Promise<void>;
  corsOrigins: string[];
  authService: AuthService;
  grupoService: GrupoService;
  miembroService: MiembroService;
  gastoService: GastoService;
  balanceService: BalanceService;
  invitacionService: InvitacionService;
  medioService: MedioService;
  tokens: TokenService;
  /** Límites de intentos (/auth y altas de miembros). Activos por defecto; los tests los apagan. */
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
      gastoService: deps.gastoService,
      balanceService: deps.balanceService,
      invitacionService: deps.invitacionService,
      medioService: deps.medioService,
      tokens: deps.tokens,
      limiterMiembros: deps.rateLimit === false ? passThrough : createMiembrosRateLimit(),
    }),
  );
  app.use(
    '/api',
    usuarioRouter({
      invitacionService: deps.invitacionService,
      medioService: deps.medioService,
      tokens: deps.tokens,
      limiterBusqueda: deps.rateLimit === false ? passThrough : createBusquedaRateLimit(),
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
