import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

/** 10 intentos cada 15 minutos por IP en login y registro. */
export function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'DEMASIADOS_INTENTOS',
          'Demasiados intentos. Probá de nuevo en unos minutos.',
        ),
      );
    },
  });
}
