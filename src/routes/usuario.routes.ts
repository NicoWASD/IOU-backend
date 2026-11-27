import { Router, type RequestHandler } from 'express';
import { createUsuarioController } from '../controllers/usuario.controller.js';
import type { TokenService } from '../lib/tokens.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { mediosSchema } from '../schemas/usuario.schemas.js';
import type { InvitacionService } from '../services/invitacion.service.js';
import type { MedioService } from '../services/medio.service.js';

/**
 * `/api/usuarios`, `/api/me` y `/api/invitaciones` (H6). requireAuth va por ruta, para que
 * una URL inexistente bajo /api siga dando 404 y no 401.
 */
export function usuarioRouter(deps: {
  invitacionService: InvitacionService;
  medioService: MedioService;
  tokens: TokenService;
  /** Límite de búsquedas (evita recorrer todos los usuarios). */
  limiterBusqueda: RequestHandler;
}): Router {
  const router = Router();
  const auth = requireAuth(deps.tokens);
  const c = createUsuarioController(deps.invitacionService, deps.medioService);
  router.get('/usuarios/buscar', auth, deps.limiterBusqueda, c.buscar);
  router.get('/usuarios/:id/medios', auth, c.mediosDe);
  router.get('/me/medios', auth, c.misMedios);
  router.put('/me/medios', auth, validate(mediosSchema), c.guardarMedios);
  router.get('/invitaciones', auth, c.mias);
  router.post('/invitaciones/:id/aceptar', auth, c.aceptar);
  router.post('/invitaciones/:id/rechazar', auth, c.rechazar);
  return router;
}
