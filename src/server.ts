import { createApp } from './app.js';
import { loadEnv, type Env } from './config/env.js';
import { checkDb, prisma } from './db/prisma.js';
import { createTokenService } from './lib/tokens.js';
import {
  createPrismaBalanceRepository,
  createPrismaPagoRepository,
} from './repositories/pago.repository.js';
import { createPrismaGastoRepository } from './repositories/gasto.repository.js';
import { createPrismaGrupoRepository } from './repositories/grupo.repository.js';
import { createPrismaUsuarioRepository } from './repositories/usuario.repository.js';
import { createPrismaInvitacionRepository } from './repositories/invitacion.repository.js';
import { createPrismaMedioRepository } from './repositories/medio.repository.js';
import { createInvitacionService } from './services/invitacion.service.js';
import { createMedioService } from './services/medio.service.js';
import { createAuthService } from './services/auth.service.js';
import { createBalanceService, createSaldoProvider } from './services/balance.service.js';
import { createGastoService } from './services/gasto.service.js';
import { createGrupoService } from './services/grupo.service.js';
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
const balances = createPrismaBalanceRepository(prisma);
const saldos = createSaldoProvider(balances);
const grupoService = createGrupoService({ grupos, saldos });
const miembroService = createMiembroService({ grupoService, grupos, saldos });
const balanceService = createBalanceService({
  grupoService,
  grupos,
  balances,
  pagos: createPrismaPagoRepository(prisma),
});
const gastoService = createGastoService({
  grupoService,
  grupos,
  gastos: createPrismaGastoRepository(prisma),
});

const invitacionService = createInvitacionService({
  grupoService,
  grupos,
  usuarios,
  invitaciones: createPrismaInvitacionRepository(prisma),
});
const medioService = createMedioService({ medios: createPrismaMedioRepository(prisma), grupos });

// No se conecta a la DB al arrancar: si Neon está suspendido, /api/health responde 503.
const app = createApp({
  checkDb,
  corsOrigins: env.CORS_ORIGIN,
  authService,
  grupoService,
  miembroService,
  gastoService,
  balanceService,
  invitacionService,
  medioService,
  tokens,
});
app.listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
