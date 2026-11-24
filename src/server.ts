import { createApp } from './app.js';
import { loadEnv, type Env } from './config/env.js';
import { checkDb, prisma } from './db/prisma.js';
import { createTokenService } from './lib/tokens.js';
import { createPrismaGastoRepository } from './repositories/gasto.repository.js';
import { createPrismaGrupoRepository } from './repositories/grupo.repository.js';
import { createPrismaUsuarioRepository } from './repositories/usuario.repository.js';
import { createAuthService } from './services/auth.service.js';
import { createGastoService } from './services/gasto.service.js';
import { ceroSaldos, createGrupoService } from './services/grupo.service.js';
import { createMiembroService } from './services/miembro.service.js';

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const tokens = createTokenService({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN });
const usuarios = createPrismaUsuarioRepository(prisma);
const grupos = createPrismaGrupoRepository(prisma);
const authService = createAuthService({ usuarios, tokens });
// Saldos en 0 hasta el H4, que calcula los balances reales
const grupoService = createGrupoService({ grupos, saldos: ceroSaldos });
const miembroService = createMiembroService({ grupoService, grupos, usuarios, saldos: ceroSaldos });
const gastoService = createGastoService({
  grupoService,
  grupos,
  gastos: createPrismaGastoRepository(prisma),
});

// No se conecta a la DB al arrancar: si Neon está suspendido, /api/health responde 503.
const app = createApp({
  checkDb,
  corsOrigins: env.CORS_ORIGIN,
  authService,
  grupoService,
  miembroService,
  gastoService,
  tokens,
});
app.listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
