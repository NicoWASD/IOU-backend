import type { RequestHandler } from 'express';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

/** HTTP puro: lee la request validada, llama al servicio y responde. */
export function createAuthController(auth: AuthService) {
  const register: RequestHandler = async (req, res) => {
    res.status(201).json(await auth.register(req.body as RegisterInput));
  };
  const login: RequestHandler = async (req, res) => {
    res.json(await auth.login(req.body as LoginInput));
  };
  const me: RequestHandler = async (_req, res) => {
    res.json({ usuario: await auth.me(res.locals.userId as string) });
  };
  return { register, login, me };
}
