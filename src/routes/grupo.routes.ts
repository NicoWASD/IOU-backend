import { Router } from 'express';
import { createGrupoController } from '../controllers/grupo.controller.js';
import type { TokenService } from '../lib/tokens.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  agregarMiembroSchema,
  crearGrupoSchema,
  editarGrupoSchema,
} from '../schemas/grupo.schemas.js';
import type { GrupoService } from '../services/grupo.service.js';
import type { MiembroService } from '../services/miembro.service.js';

/** `/api/grupos`. Todo requiere sesión; las reglas (404/403/409) viven en los services. */
export function grupoRouter(deps: {
  grupoService: GrupoService;
  miembroService: MiembroService;
  tokens: TokenService;
}): Router {
  const router = Router();
  const c = createGrupoController(deps.grupoService, deps.miembroService);
  router.use(requireAuth(deps.tokens));
  router.get('/', c.listar);
  router.post('/', validate(crearGrupoSchema), c.crear);
  router.get('/:id', c.detalle);
  router.patch('/:id', validate(editarGrupoSchema), c.editar);
  router.get('/:id/miembros', c.listarMiembros);
  router.post('/:id/miembros', validate(agregarMiembroSchema), c.agregarMiembro);
  router.delete('/:id/miembros/:usuarioId', c.quitarMiembro);
  return router;
}
