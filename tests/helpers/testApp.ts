import type { Express } from 'express';
import request from 'supertest';
import { createApp, type AppDeps } from '../../src/app.js';
import type { SaldoProvider } from '../../src/domain/grupo.js';
import { createTokenService } from '../../src/lib/tokens.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createGastoService } from '../../src/services/gasto.service.js';
import { ceroSaldos, createGrupoService } from '../../src/services/grupo.service.js';
import { createMiembroService } from '../../src/services/miembro.service.js';
import { createMemoryGastoRepository } from './memoryGastos.js';
import { createMemoryGrupoRepository } from './memoryGrupos.js';
import { createMemoryUsuarioRepository } from './memoryUsuarios.js';

export const TEST_SECRET = 'x'.repeat(32);

/**
 * App con repositorios en memoria (grupos comparte el de usuarios) y JWT real.
 * El límite de intentos viene apagado. `saldos` reemplaza al SaldoProvider (por defecto, todo en 0).
 */
export function makeTestApp(
  overrides: Partial<AppDeps> & { saldos?: SaldoProvider; hoy?: () => string } = {},
) {
  const { saldos = ceroSaldos, hoy = () => '2026-06-15', ...appOverrides } = overrides;
  const tokens = createTokenService({ secret: TEST_SECRET, expiresIn: '1h' });
  const usuarios = createMemoryUsuarioRepository();
  const grupos = createMemoryGrupoRepository(usuarios);
  const grupoService = createGrupoService({ grupos, saldos });
  const gastos = createMemoryGastoRepository(usuarios);
  const deps: AppDeps = {
    checkDb: async () => {},
    corsOrigins: ['http://localhost:5173'],
    authService: createAuthService({ usuarios, tokens }),
    grupoService,
    miembroService: createMiembroService({ grupoService, grupos, usuarios, saldos }),
    gastoService: createGastoService({ grupoService, grupos, gastos, hoy }),
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
  const res = await request(app)
    .post('/api/auth/register')
    .send({ nombre, email, password: 'secreta123' });
  if (res.status !== 201) throw new Error(`No se pudo registrar a ${email}: ${res.status}`);
  return { token: res.body.token as string, id: res.body.usuario.id as string };
}
