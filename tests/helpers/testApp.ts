import { createApp, type AppDeps } from '../../src/app.js';
import { createTokenService } from '../../src/lib/tokens.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createMemoryUsuarioRepository } from './memoryUsuarios.js';

export const TEST_SECRET = 'x'.repeat(32);

/** App con repositorio en memoria y JWT real. El límite de intentos viene apagado. */
export function makeTestApp(overrides: Partial<AppDeps> = {}) {
  const tokens = createTokenService({ secret: TEST_SECRET, expiresIn: '1h' });
  const usuarios = createMemoryUsuarioRepository();
  const deps: AppDeps = {
    checkDb: async () => {},
    corsOrigins: ['http://localhost:5173'],
    authService: createAuthService({ usuarios, tokens }),
    tokens,
    rateLimit: false,
    ...overrides,
  };
  return { app: createApp(deps), usuarios, tokens };
}
