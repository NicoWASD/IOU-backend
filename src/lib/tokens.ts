import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from './errors.js';

export type TokenPayload = { sub: string };

export type TokenService = {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
};

export function createTokenService(opts: { secret: string; expiresIn: string }): TokenService {
  const signOptions: SignOptions = {
    expiresIn: opts.expiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return {
    sign(payload) {
      return jwt.sign({}, opts.secret, { ...signOptions, subject: payload.sub });
    },
    verify(token) {
      try {
        const decoded = jwt.verify(token, opts.secret, { algorithms: ['HS256'] });
        if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
          throw new Error('payload sin sub');
        }
        return { sub: decoded.sub };
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AppError(401, 'TOKEN_EXPIRADO', 'Tu sesión expiró. Ingresá de nuevo.');
        }
        throw new AppError(401, 'TOKEN_INVALIDO', 'La sesión no es válida. Ingresá de nuevo.');
      }
    },
  };
}
