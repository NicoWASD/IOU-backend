import { Router, type RequestHandler } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import type { TokenService } from '../lib/tokens.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, perfilSchema, registerSchema } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

export function authRouter(deps: {
  authService: AuthService;
  tokens: TokenService;
  limiter: RequestHandler;
}): Router {
  const router = Router();
  const c = createAuthController(deps.authService);
  router.post('/register', deps.limiter, validate(registerSchema), c.register);
  router.post('/login', deps.limiter, validate(loginSchema), c.login);
  router.get('/me', requireAuth(deps.tokens), c.me);
  router.patch('/me', requireAuth(deps.tokens), validate(perfilSchema), c.actualizar);
  return router;
}
