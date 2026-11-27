import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

/** Limitador por IP en ventanas de 15 minutos, con el error en el formato de la API. */
export function createRateLimit(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
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

/** 10 intentos cada 15 minutos por IP en login y registro. */
export const createAuthRateLimit = () => createRateLimit(10);

/** 30 invitaciones cada 15 minutos por IP. */
export const createMiembrosRateLimit = () => createRateLimit(30);

/** 300 búsquedas cada 15 minutos por IP (el buscador consulta mientras se escribe). */
export const createBusquedaRateLimit = () => createRateLimit(300);
