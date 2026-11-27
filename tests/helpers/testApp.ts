import type { Express } from 'express';
import request from 'supertest';
import { createApp, type AppDeps } from '../../src/app.js';
import type { SaldoProvider } from '../../src/domain/grupo.js';
import { createTokenService } from '../../src/lib/tokens.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createBalanceService, createSaldoProvider } from '../../src/services/balance.service.js';
import { createGastoService } from '../../src/services/gasto.service.js';
import { createGrupoService } from '../../src/services/grupo.service.js';
import { createMiembroService } from '../../src/services/miembro.service.js';
import { createMemoryGastoRepository } from './memoryGastos.js';
import { createMemoryBalanceRepository, createMemoryPagoRepository } from './memoryPagos.js';
import { createMemoryGrupoRepository } from './memoryGrupos.js';
import { createMemoryUsuarioRepository } from './memoryUsuarios.js';
import {
  createMemoryInvitacionRepository,
  createMemoryMedioRepository,
} from './memoryInvitaciones.js';
import { createInvitacionService } from '../../src/services/invitacion.service.js';
import { createMedioService } from '../../src/services/medio.service.js';

export const TEST_SECRET = 'x'.repeat(32);

/**
 * App con repositorios en memoria (grupos comparte el de usuarios) y JWT real.
 * El límite de intentos viene apagado. `saldos` reemplaza al SaldoProvider (por defecto, el real).
 */
export function makeTestApp(
  overrides: Partial<AppDeps> & { saldos?: SaldoProvider; hoy?: () => string } = {},
) {
  const { saldos: saldosOverride, hoy = () => '2026-06-15', ...appOverrides } = overrides;
  const tokens = createTokenService({ secret: TEST_SECRET, expiresIn: '1h' });
  const usuarios = createMemoryUsuarioRepository();
  const grupos = createMemoryGrupoRepository(usuarios);
  usuarios.setMiembroActivo(grupos.esMiembroActivo);
  const gastos = createMemoryGastoRepository(usuarios);
  const pagos = createMemoryPagoRepository(usuarios);
  const balances = createMemoryBalanceRepository(gastos, pagos);
  const saldos = saldosOverride ?? createSaldoProvider(balances);
  const grupoService = createGrupoService({ grupos, saldos });
  const deps: AppDeps = {
    checkDb: async () => {},
    corsOrigins: ['http://localhost:5173'],
    authService: createAuthService({ usuarios, tokens }),
    grupoService,
    miembroService: createMiembroService({ grupoService, grupos, saldos }),
    gastoService: createGastoService({ grupoService, grupos, gastos, hoy }),
    balanceService: createBalanceService({ grupoService, grupos, balances, pagos, hoy }),
    invitacionService: createInvitacionService({
      grupoService,
      grupos,
      usuarios,
      invitaciones: createMemoryInvitacionRepository(usuarios, grupos),
    }),
    medioService: createMedioService({ medios: createMemoryMedioRepository(), grupos }),
    tokens,
    rateLimit: false,
    ...appOverrides,
  };
  return { app: createApp(deps), usuarios, grupos, gastos, tokens };
}

/** Registra un usuario por la API y devuelve su token y su id. */
export async function registrar(
  app: Express,
  nombre: string,
  email: string,
): Promise<{ token: string; id: string }> {
  const usuario = email
    .split('@')[0]!
    .replace(/[^a-z0-9_.]/g, '')
    .padEnd(3, '_');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ usuario, email, password: 'secreta123' });
  if (res.status !== 201) throw new Error(`No se pudo registrar a ${email}: ${res.status}`);
  const token = res.body.token as string;
  // El nombre visible de los tests ("Tomi") sale del perfil (RN-19)
  await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ nombre });
  return { token, id: res.body.usuario.id as string };
}

type Sesion = { token: string; id: string };
const h = (s: Sesion) => ({ Authorization: `Bearer ${s.token}` });

/** Alta por invitación (RN-20): el admin invita y el invitado acepta. */
export async function unir(app: Express, grupoId: string, admin: Sesion, invitado: Sesion) {
  const inv = await request(app)
    .post(`/api/grupos/${grupoId}/invitaciones`)
    .set(h(admin))
    .send({ usuarioId: invitado.id });
  if (inv.status !== 201) throw new Error(`No se pudo invitar: ${inv.status} ${inv.text}`);
  const ok = await request(app)
    .post(`/api/invitaciones/${inv.body.invitacion.id}/aceptar`)
    .set(h(invitado));
  if (ok.status !== 200) throw new Error(`No se pudo aceptar: ${ok.status} ${ok.text}`);
}
