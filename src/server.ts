import { createApp } from './app.js';
import { loadEnv, type Env } from './config/env.js';
import { checkDb } from './db/prisma.js';

let env: Env;
try {
  env = loadEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

// No se conecta a la DB al arrancar: si Neon está suspendido, /api/health responde 503.
const app = createApp({ checkDb, corsOrigins: env.CORS_ORIGIN });
app.listen(env.PORT, () => {
  console.log(`API escuchando en :${env.PORT}`);
});
