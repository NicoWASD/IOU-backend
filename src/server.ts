import { createApp } from './app.js';
import { loadEnv, type Env } from './config/env.js';
import { checkDb, prisma } from './db/prisma.js';
import { createTokenService } from './lib/tokens.js';
import { createPrismaUsuarioRepository } from './repositories/usuario.repository.js';
import { createAuthService } from './services/auth.service.js';

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const tokens = createTokenService({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN });
const authService = createAuthService({ usuarios: createPrismaUsuarioRepository(prisma), tokens });

// No se conecta a la DB al arrancar: si Neon está suspendido, /api/health responde 503.
const app = createApp({ checkDb, corsOrigins: env.CORS_ORIGIN, authService, tokens });
app.listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
