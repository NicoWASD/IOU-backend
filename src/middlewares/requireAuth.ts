import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import type { TokenService } from '../lib/tokens.js';

/** Exige `Authorization: Bearer <token>` y deja el id del usuario en res.locals.userId. */
export function requireAuth(tokens: TokenService): RequestHandler {
  return (req, res, next) => {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      next(new AppError(401, 'NO_AUTENTICADO', 'Tenés que ingresar para continuar'));
      return;
    }
    try {
      res.locals.userId = tokens.verify(token).sub;
      next();
    } catch (err) {
      next(err);
    }
  };
}
