import { Router, type RequestHandler } from 'express';
import { createBalanceController } from '../controllers/balance.controller.js';
import { createGastoController } from '../controllers/gasto.controller.js';
import { createGrupoController } from '../controllers/grupo.controller.js';
import type { TokenService } from '../lib/tokens.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { crearGrupoSchema, editarGrupoSchema } from '../schemas/grupo.schemas.js';
import { nuevoGastoSchema } from '../schemas/gasto.schemas.js';
import { nuevoPagoSchema } from '../schemas/pago.schemas.js';
import { invitarSchema } from '../schemas/usuario.schemas.js';
import { createUsuarioController } from '../controllers/usuario.controller.js';
import type { InvitacionService } from '../services/invitacion.service.js';
import type { MedioService } from '../services/medio.service.js';
import type { BalanceService } from '../services/balance.service.js';
import type { GastoService } from '../services/gasto.service.js';
import type { GrupoService } from '../services/grupo.service.js';
import type { MiembroService } from '../services/miembro.service.js';

/** `/api/grupos`. Todo requiere sesión; las reglas (404/403/409) viven en los services. */
export function grupoRouter(deps: {
  grupoService: GrupoService;
  miembroService: MiembroService;
  gastoService: GastoService;
  balanceService: BalanceService;
  invitacionService: InvitacionService;
  medioService: MedioService;
  tokens: TokenService;
  /** Límite de invitaciones. */
  limiterMiembros: RequestHandler;
}): Router {
  const router = Router();
  const c = createGrupoController(deps.grupoService, deps.miembroService);
  router.use(requireAuth(deps.tokens));
  router.get('/', c.listar);
  router.post('/', validate(crearGrupoSchema), c.crear);
  router.get('/:id', c.detalle);
  router.patch('/:id', validate(editarGrupoSchema), c.editar);
  router.get('/:id/miembros', c.listarMiembros);
  router.delete('/:id/miembros/:usuarioId', c.quitarMiembro);
  const u = createUsuarioController(deps.invitacionService, deps.medioService);
  router.get('/:id/invitaciones', u.pendientesDeGrupo);
  router.post('/:id/invitaciones', deps.limiterMiembros, validate(invitarSchema), u.invitar);
  router.delete('/:id/invitaciones/:invId', u.cancelar);
  const g = createGastoController(deps.gastoService);
  router.get('/:id/gastos', g.listar);
  router.post('/:id/gastos', validate(nuevoGastoSchema), g.crear);
  router.get('/:id/gastos/:gastoId', g.detalle);
  router.put('/:id/gastos/:gastoId', validate(nuevoGastoSchema), g.editar);
  router.delete('/:id/gastos/:gastoId', g.eliminar);
  const b = createBalanceController(deps.balanceService);
  router.get('/:id/balances', b.balances);
  router.get('/:id/liquidacion', b.liquidacion);
  router.post('/:id/archivar', b.archivar);
  router.get('/:id/pagos', b.listarPagos);
  router.post('/:id/pagos', validate(nuevoPagoSchema), b.crearPago);
  router.delete('/:id/pagos/:pagoId', b.eliminarPago);
  return router;
}
