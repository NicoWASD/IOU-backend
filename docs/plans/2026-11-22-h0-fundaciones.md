# H0 · Fundaciones — Plan de implementación

> **Para quien ejecute:** usá la skill `executing-plans` para implementar este plan tarea por tarea, y `verification-before-completion` antes de dar algo por terminado. Los pasos usan checkboxes (`- [ ]`). Los pasos marcados con 👤 los hace **el usuario** (crear cuentas, pegar secretos en los paneles); el agente los indica y espera.

**Objetivo:** que `IOU-backend` e `IOU-client` existan como esqueletos funcionando, con Docker, y desplegados de punta a punta (Vercel → Render → Neon), mostrando "API: ok · DB: ok" desde internet.

**Arquitectura:** el back es una app Express creada por la fábrica `createApp(deps)`. Recibe sus dependencias (el chequeo de la DB) para poder testearla sin una base real. `server.ts` solo carga el entorno, crea Prisma y escucha el puerto. El front es una SPA Vite que consulta `/api/health` con TanStack Query y muestra el estado.

**Stack:** Node 22 · npm · Express 5 · TypeScript 5 (strict) · Prisma 6 · Zod · Vitest · Supertest · ESLint (flat config) + Prettier · React 19 · Vite · Tailwind CSS v4 (`@tailwindcss/vite`) · TanStack Query 5 · Testing Library · Docker · nginx.

**Spec:** `IOU-backend/docs/spec.md` (sección 9) · `IOU-backend/docs/historias-usuario.md` (HU-00).

## Restricciones globales

- Node `22` (`"engines": { "node": ">=22" }` e imagen `node:22-alpine`).
- TypeScript con `"strict": true`; nada de `any` sin justificar.
- Errores de la API con el formato `{ error: { code, message, details? } }`, mensajes en español.
- Cero credenciales en el repo: solo `.env.example`; `.env` y `.env.*` ignorados (ya está en `.gitignore`).
- Un `Dockerfile` multi-stage y un `.dockerignore` por repo; **sin Docker Compose**.
- Finales de línea LF en todos los archivos (`.gitattributes`).
- Puertos: API `3000`; Vite dev `5173`; contenedor web `80` (mapeado a `8080` en local).
- Variables del back: `DATABASE_URL`, `DIRECT_URL`, `PORT`, `CORS_ORIGIN`, `NODE_ENV`. Variable del front: `VITE_API_URL` (incluye `/api`).
- Rama `h0-fundaciones` en cada repo; commits locales por tarea con conventional commits en español. **Push y merge a `main` solo con el OK del usuario.**

## Puntos de atención (Review Focus)

1. **`CORS_ORIGIN` con espacios o barra final** (`"https://iou-client.vercel.app/ , http://localhost:5173"`): tiene que funcionar igual. Se normaliza al parsear (Tarea 2).
2. **DB caída o Neon suspendido:** el servidor arranca igual, y `/api/health` responde `503 { status: "error", db: "error" }` en vez de colgarse o tirar el proceso (Tarea 2).
3. **Falta una variable de entorno obligatoria:** el proceso termina con un mensaje que nombra la variable, no con un stack críptico de Prisma (Tarea 2).
4. **`VITE_API_URL` con barra final** (`.../api/`): no tiene que generar `//health` (Tarea 5).
5. **"Cold start" de Render (30–60 s):** el front muestra "Despertando el servidor…" mientras espera, con un timeout de 70 s, en vez de dar error enseguida (Tarea 5).

---

## Estructura de archivos

```
IOU-backend/                          IOU-client/
├── .gitattributes                    ├── .gitattributes
├── .dockerignore                     ├── .dockerignore
├── .env.example                      ├── .env.example
├── Dockerfile                        ├── Dockerfile
├── eslint.config.js                  ├── nginx.conf
├── .prettierrc                       ├── vercel.json
├── package.json                      ├── eslint.config.js
├── tsconfig.json                     ├── .prettierrc
├── vitest.config.ts                  ├── package.json · tsconfig*.json
├── prisma/schema.prisma              ├── vite.config.ts  (incluye la config de Vitest)
├── src/                              ├── index.html
│   ├── app.ts          createApp()   └── src/
│   ├── server.ts       arranque          ├── main.tsx           (QueryClientProvider)
│   ├── config/env.ts   loadEnv()         ├── App.tsx
│   ├── db/prisma.ts    prisma, checkDb   ├── index.css          (@import "tailwindcss")
│   ├── lib/errors.ts   AppError          ├── config/env.ts      (API_URL)
│   ├── middlewares/                      ├── api/client.ts      (apiGet, joinUrl)
│   │   ├── errorHandler.ts               ├── api/health.ts      (fetchHealth, useHealth)
│   │   └── notFound.ts                   ├── components/HealthStatus.tsx
│   └── routes/health.routes.ts           └── test/setup.ts
└── tests/
    ├── env.test.ts                   tests junto al código: *.test.ts(x)
    ├── health.test.ts
    └── app.test.ts
```

---

### Tarea 1: Esqueleto del backend (tooling)

**Archivos:**
- Crear: `IOU-backend/.gitattributes`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `tests/smoke.test.ts`

**Interfaces:**
- Produce: los scripts de npm `dev` (`tsx watch src/server.ts`), `build` (`prisma generate && tsc -p tsconfig.json`), `start` (`node dist/server.js`), `test` (`vitest run`), `lint` (`eslint .`), `format` (`prettier --write .`), `typecheck` (`tsc --noEmit`).

- [ ] **Paso 1:** crear la rama: `git -C IOU-backend switch -c h0-fundaciones`.
- [ ] **Paso 2:** `.gitattributes` con `* text=auto eol=lf`.
- [ ] **Paso 3:** `npm init -y` y luego `"type": "module"` y `"engines": { "node": ">=22" }` en `package.json`. Instalar:
  - **dependencias:** `express`, `cors`, `zod`, `@prisma/client` y `prisma`. La CLI va en dependencias porque el contenedor corre `prisma migrate deploy` al arrancar.
  - **devDependencies:** `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/cors`, `vitest`, `supertest`, `@types/supertest`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `eslint-config-prettier`.
- [ ] **Paso 4:** `tsconfig.json` con `strict: true`, `module`/`moduleResolution` `NodeNext`, `target` `ES2023`, `outDir` `dist`, `rootDir` `src`, `include` `["src"]`. Vitest compila los tests aparte.
- [ ] **Paso 5:** el test `tests/smoke.test.ts` con `expect(1 + 1).toBe(2)`. Correr `npm test`; esperado: 1 passed.
- [ ] **Paso 6:** `npm run lint` y `npm run typecheck`; esperado: sin errores.
- [ ] **Paso 7:** commit `chore: esqueleto del backend con TypeScript, Vitest y ESLint`.

### Tarea 2: Configuración de entorno, app Express y health check

**Archivos:**
- Crear: `src/config/env.ts`, `src/lib/errors.ts`, `src/middlewares/errorHandler.ts`, `src/middlewares/notFound.ts`, `src/routes/health.routes.ts`, `src/app.ts`, `.env.example`
- Test: `tests/env.test.ts`, `tests/health.test.ts`, `tests/app.test.ts` (borrar `tests/smoke.test.ts`)

**Interfaces:**
- Produce:
  - `type Env = { NODE_ENV: 'development' | 'test' | 'production'; PORT: number; DATABASE_URL: string; DIRECT_URL?: string; CORS_ORIGIN: string[] }`
  - `loadEnv(source: Record<string, string | undefined> = process.env): Env`: valida con Zod; si falla, tira `Error` con el mensaje `Variables de entorno inválidas: <VAR>: <motivo>; ...`.
  - `class AppError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) }`
  - `type AppDeps = { checkDb: () => Promise<void>; corsOrigins: string[] }`
  - `createApp(deps: AppDeps): express.Express`: monta `cors`, `express.json()`, `/api/health`, `notFound` y `errorHandler`.

- [ ] **Paso 1: tests de `loadEnv` (fallan)**

```ts
// tests/env.test.ts
const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/app', CORS_ORIGIN: 'http://localhost:5173' };
it('aplica defaults', () => {
  expect(loadEnv(base)).toMatchObject({ PORT: 3000, NODE_ENV: 'development' });
});
it('normaliza CORS_ORIGIN con espacios y barra final', () => {
  const env = loadEnv({ ...base, CORS_ORIGIN: ' https://iou-client.vercel.app/ , http://localhost:5173' });
  expect(env.CORS_ORIGIN).toEqual(['https://iou-client.vercel.app', 'http://localhost:5173']);
});
it('nombra la variable que falta', () => {
  expect(() => loadEnv({ CORS_ORIGIN: 'x' })).toThrow(/DATABASE_URL/);
});
it('rechaza PORT no numérico', () => {
  expect(() => loadEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
});
```

- [ ] **Paso 2:** `npm test`; esperado: FAIL ("loadEnv is not defined" o error de import).
- [ ] **Paso 3:** implementar `loadEnv` en `src/config/env.ts`. Con Zod: `PORT` con `z.coerce.number().int().positive().default(3000)`; `CORS_ORIGIN` con split por `,`, `trim`, sacar `/` final y filtrar vacíos (mínimo 1); `DATABASE_URL` con `z.string().url()`.
- [ ] **Paso 4:** `npm test`; esperado: los 4 de env pasan.
- [ ] **Paso 5: tests de la app (fallan)**

```ts
// tests/health.test.ts
const ok = createApp({ checkDb: async () => {}, corsOrigins: ['http://localhost:5173'] });
const down = createApp({ checkDb: async () => { throw new Error('ECONNREFUSED'); }, corsOrigins: [] });

it('GET /api/health → 200 con DB ok', async () => {
  const res = await request(ok).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'ok' });
});
it('GET /api/health → 503 si la DB falla, sin filtrar el error', async () => {
  const res = await request(down).get('/api/health');
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: 'error', db: 'error' });
});

// tests/app.test.ts
it('ruta inexistente → 404 con formato de error', async () => {
  const res = await request(ok).get('/api/nada');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada: GET /api/nada' } });
});
it('JSON mal formado → 400 INVALID_JSON', async () => {
  const res = await request(ok).post('/api/health').set('Content-Type', 'application/json').send('{"a":');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INVALID_JSON');
});
it('CORS permite el origen configurado', async () => {
  const res = await request(ok).get('/api/health').set('Origin', 'http://localhost:5173');
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});
it('CORS no permite otros orígenes', async () => {
  const res = await request(ok).get('/api/health').set('Origin', 'https://malicioso.com');
  expect(res.headers['access-control-allow-origin']).toBeUndefined();
});
```

- [ ] **Paso 6:** `npm test`; esperado: FAIL (no existe `createApp`).
- [ ] **Paso 7:** implementar `AppError`, `notFound` (tira `AppError(404, 'NOT_FOUND', ...)`), `errorHandler`, `health.routes.ts` y `createApp`.
  - `errorHandler` traduce `AppError` a su status; el `SyntaxError` del body parser (`type === 'entity.parse.failed'`) a `400 INVALID_JSON` ("El cuerpo de la solicitud no es JSON válido"); cualquier otro error a `500 INTERNAL_ERROR` ("Error interno del servidor"), loguea con `console.error` y nunca expone el stack.
  - El origen de CORS se evalúa con una función: si está en `corsOrigins`, lo permite; si no, responde sin header.
- [ ] **Paso 8:** `npm test`; esperado: los 10 tests pasan. `npm run lint` y `npm run typecheck`, sin errores.
- [ ] **Paso 9:** `.env.example`:

```
NODE_ENV=development
PORT=3000
# Neon: usar la URL "pooled" (con -pooler en el host) para la app
DATABASE_URL=postgresql://USUARIO:PASSWORD@HOST/DB?sslmode=require
# Neon: URL directa (sin -pooler), la usa Prisma para las migraciones
DIRECT_URL=postgresql://USUARIO:PASSWORD@HOST/DB?sslmode=require
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Paso 10:** commit `feat(api): configuración de entorno, manejo de errores y GET /api/health`.

### Tarea 3: Prisma + servidor + Postgres local

**Archivos:**
- Crear: `prisma/schema.prisma`, `src/db/prisma.ts`, `src/server.ts`

**Interfaces:**
- Consume: `loadEnv`, `createApp`.
- Produce: `prisma: PrismaClient`, `checkDb(): Promise<void>` (ejecuta `` prisma.$queryRaw`SELECT 1` ``).

- [ ] **Paso 1:** `prisma/schema.prisma` con `generator client { provider = "prisma-client-js" }` y `datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }`. Todavía sin modelos; los modelos llegan en el H1.
- [ ] **Paso 2:** `src/db/prisma.ts` con `prisma` y `checkDb`.
- [ ] **Paso 3:** `src/server.ts`:
  - Hace `loadEnv()` dentro de un try. Si falla, `console.error(mensaje)` y `process.exit(1)`.
  - Crea la app con `createApp({ checkDb, corsOrigins: env.CORS_ORIGIN })` y escucha en `env.PORT`.
  - Loguea `API escuchando en :<PORT>`.
  - No conecta a la DB al arrancar (Review Focus 2).
- [ ] **Paso 4:** levantar Postgres local:

```bash
docker network create iou-net
docker run -d --name iou-db --network iou-net -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=app -p 5432:5432 postgres:17-alpine
```

  Crear `.env` (no se commitea) con `DATABASE_URL=DIRECT_URL=postgresql://postgres:dev@localhost:5432/app`.
- [ ] **Paso 5:** `npm run dev` y luego `curl -s localhost:3000/api/health`; esperado: `{"status":"ok","db":"ok"}`.
- [ ] **Paso 6:** `docker stop iou-db` y repetir el curl; esperado: HTTP 503 `{"status":"error","db":"error"}`, y el proceso sigue vivo. Después, `docker start iou-db`.
- [ ] **Paso 7:** arrancar sin `DATABASE_URL` (`DATABASE_URL= npm run dev`); esperado: un mensaje que nombra `DATABASE_URL` y exit 1.
- [ ] **Paso 8: conectar Neon con la CLI oficial** (paquete npm `neon`, de `neondatabase/neon-pkgs`):
  1. `npm i -g neon@latest`; si falla, usar `npx neon@latest`. 👤 Si se abre el login en el navegador, lo completa el usuario.
  2. En `IOU-backend/`: `neon init -y --org-id org-noisy-glitter-72465241 --project-id super-rain-30094920 --branch production --services postgres`.
  3. `neon deploy`: aprovisiona lo declarado en `neon.ts` y baja las variables a `.env`, que está ignorado.
  4. Revisar qué nombres de variables escribió la CLI y mapearlos a `DATABASE_URL` (pooled) y `DIRECT_URL` (directa). Si los nombres difieren, adaptar `loadEnv` y `schema.prisma`, y actualizar la spec en el mismo commit.
  5. Commitear `neon.ts`, que tiene IDs pero no secretos. Antes de commitear, verificar con `git status` que ningún `.env*` quede incluido.
- [ ] **Paso 9:** con el `.env` de Neon, `npm run build` y `npm start`; luego `curl -s localhost:3000/api/health`. Esperado: `{"status":"ok","db":"ok"}` contra Neon.
- [ ] **Paso 10:** commit `feat(api): Prisma, arranque del servidor y conexión a Neon`.

### Tarea 4: Dockerfile del backend

**Archivos:**
- Crear: `IOU-backend/Dockerfile`, `IOU-backend/.dockerignore`

- [ ] **Paso 1:** `.dockerignore`: `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `.git`, `coverage`, `docs`, `tests`, `*.log`.
- [ ] **Paso 2:** `Dockerfile` con 3 stages sobre `node:22-alpine`:
  - **`deps`:** `npm ci`.
  - **`build`:** copia el código y corre `npm run build`.
  - **`runtime`:**
    - `apk add --no-cache openssl`, porque Prisma lo requiere en alpine.
    - `ENV NODE_ENV=production`.
    - Dependencias de producción con `npm ci --omit=dev`; incluyen la CLI `prisma`.
    - Copia `dist/`, `prisma/` y el cliente generado (`node_modules/.prisma`) desde el stage `build`.
    - Corre como `USER node`, con `EXPOSE 3000`.
    - `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
    - `CMD ["sh","-c","npx prisma migrate deploy && node dist/server.js"]`.
- [ ] **Paso 3:** build y run en la red local:

```bash
docker build -t iou-backend .
docker run --rm -d --name iou-backend --network iou-net -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:dev@iou-db:5432/app -e DIRECT_URL=postgresql://postgres:dev@iou-db:5432/app \
  -e CORS_ORIGIN=http://localhost:8080 iou-backend
```

  Esperado: `curl localhost:3000/api/health` devuelve `{"status":"ok","db":"ok"}`; `docker inspect --format '{{.State.Health.Status}}' iou-backend` devuelve `healthy` tras unos 30 s; `docker exec iou-backend whoami` devuelve `node`.
- [ ] **Paso 4:** commit `chore(docker): Dockerfile multi-stage del backend`.

### Tarea 5: Esqueleto del frontend con el estado de la API

**Archivos:**
- Crear (con `npm create vite@latest IOU-client -- --template react-ts`, sobre el repo existente sin pisar el README ni el `.gitignore`): `.gitattributes`, `src/config/env.ts`, `src/api/client.ts`, `src/api/health.ts`, `src/components/HealthStatus.tsx`, `src/test/setup.ts`, `.env.example`
- Modificar: `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`; borrar `App.css` y los assets del template.
- Test: `src/api/client.test.ts`, `src/components/HealthStatus.test.tsx`

**Interfaces:**
- Produce:
  - `API_URL: string` (desde `import.meta.env.VITE_API_URL`; si falta, tira `Error('Falta VITE_API_URL')`).
  - `joinUrl(base: string, path: string): string`
  - `apiGet<T>(path: string, opts?: { timeoutMs?: number }): Promise<T>`: el timeout por defecto es 70000 ms; si la respuesta no es ok, tira un `Error` con el `error.message` del cuerpo, si existe.
  - `type HealthResponse = { status: 'ok' | 'error'; db: 'ok' | 'error' }`
  - `fetchHealth(): Promise<HealthResponse>` y `useHealth()`: un `useQuery` con key `['health']`, `retry: 1`.
  - `<HealthStatus />`

- [ ] **Paso 1:** `git -C IOU-client switch -c h0-fundaciones`; generar el template; `.gitattributes` con `* text=auto eol=lf`.
- [ ] **Paso 2:** instalar:
  - **dependencias:** `@tanstack/react-query`, `zod`.
  - **devDependencies:** `tailwindcss`, `@tailwindcss/vite`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `prettier`, `eslint-config-prettier`.

  En `vite.config.ts`, plugins `react()` y `tailwindcss()`, más `test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' }`. `index.css` con `@import "tailwindcss";`. Scripts `test` (`vitest run`), `lint` y `typecheck` (`tsc -b`).
- [ ] **Paso 2b: base del sistema de diseño** (`IOU-backend/docs/design.md`, secciones 2, 3, 11 y 12):
  - Instalar `lucide-react`, `sonner`, `@fontsource/schibsted-grotesk` y `@fontsource/caveat`.
  - Correr `npx shadcn@latest init` (Vite, alias `@/`) y agregar `button`, `skeleton` y `sonner`. El resto de los componentes se suma en cada hito.
  - En `index.css`, los tokens de color de design.md como `@theme` (`--color-paper`, `--color-birome`, etc.), el modo oscuro con `.dark` y el tema de shadcn mapeado a esos tokens.
  - Crear `src/components/brand/Logo.tsx` (el vale cortado, con colores por tokens), con `public/favicon.svg` copiado de `public/brand/favicon.svg` y el `<link rel="icon">` en `index.html`.
  - `HealthStatus` usa `Skeleton` y el aviso de cold start con el texto de design.md 7.1.
- [ ] **Paso 3: tests (fallan)**

```ts
// src/api/client.test.ts
it.each([
  ['https://x.com/api', '/health'], ['https://x.com/api/', '/health'],
  ['https://x.com/api/', 'health'], ['https://x.com/api', 'health'],
])('joinUrl(%s, %s) sin doble barra', (b, p) => {
  expect(joinUrl(b, p)).toBe('https://x.com/api/health');
});
```

```tsx
// src/components/HealthStatus.test.tsx  (envolver en QueryClientProvider con retry: false; mockear fetch con vi.stubGlobal)
it('muestra "Despertando el servidor…" mientras espera', () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  render(<HealthStatus />);
  expect(screen.getByText('Despertando el servidor…')).toBeInTheDocument();
});
it('muestra "API: ok · DB: ok"', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'ok', db: 'ok' }), { status: 200 }));
  render(<HealthStatus />);
  expect(await screen.findByText('API: ok · DB: ok')).toBeInTheDocument();
});
it('muestra "API: ok · DB: sin conexión" ante 503', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'error', db: 'error' }), { status: 503 }));
  render(<HealthStatus />);
  expect(await screen.findByText('API: ok · DB: sin conexión')).toBeInTheDocument();
});
it('muestra "API: sin conexión" si fetch falla', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
  render(<HealthStatus />);
  expect(await screen.findByText('API: sin conexión')).toBeInTheDocument();
});
```

- [ ] **Paso 4:** `npm test`; esperado: FAIL.
- [ ] **Paso 5:** implementar `env.ts`, `client.ts` (`AbortSignal.timeout(timeoutMs)`), `health.ts` y `HealthStatus`.
  - `fetchHealth` trata el 503 como una respuesta válida (con `db: 'error'`) y no como un error de red: lee el cuerpo igual. Así se distingue "la API respondió pero la DB no" de "la API no responde".
  - `App.tsx` muestra un título "IOU", el subtítulo "Gastos compartidos sin vueltas" y `<HealthStatus />` en una tarjeta centrada, con Tailwind.
- [ ] **Paso 6:** `npm test` (8 tests pasan), `npm run lint`, `npm run typecheck` y `npm run build`, todos sin errores.
- [ ] **Paso 7:** `.env.example` con `VITE_API_URL=http://localhost:3000/api`. Con el back local levantado, `npm run dev` y abrir `http://localhost:5173`; esperado: "API: ok · DB: ok".
- [ ] **Paso 8:** commit `feat(client): esqueleto con Tailwind y estado de la API`.

### Tarea 6: Dockerfile del frontend + config de Vercel

**Archivos:**
- Crear: `IOU-client/Dockerfile`, `.dockerignore`, `nginx.conf`, `vercel.json`

- [ ] **Paso 1:** `.dockerignore`: `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `.git`, `coverage`.
- [ ] **Paso 2:** `nginx.conf`: `listen 80`, `root /usr/share/nginx/html`, `location / { try_files $uri $uri/ /index.html; }` y cache larga para `/assets/`.
- [ ] **Paso 3:** `Dockerfile`:
  - **Stage `build`** (`node:22-alpine`): `ARG VITE_API_URL`, `ENV VITE_API_URL=$VITE_API_URL`, `npm ci` y `npm run build`.
  - **Stage `runtime`** (`nginx:1.27-alpine`): copia `dist` y `nginx.conf` a `/etc/nginx/conf.d/default.conf`, con `EXPOSE 80`.
- [ ] **Paso 4:** `vercel.json` con `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
- [ ] **Paso 5:** build y run, con el contenedor del back de la Tarea 4 corriendo:

```bash
docker build -t iou-client --build-arg VITE_API_URL=http://localhost:3000/api .
docker run --rm -d --name iou-client -p 8080:80 iou-client
```

  Esperado:
  - `http://localhost:8080` muestra "API: ok · DB: ok".
  - `curl -s -o /dev/null -w '%{http_code}' localhost:8080/grupos/123` devuelve `200` (fallback de la SPA).
- [ ] **Paso 6:** commit `chore(docker): Dockerfile con nginx y config de Vercel`.

### Tarea 7: CI en GitHub Actions (ambos repos)

**Archivos:**
- Crear: `IOU-backend/.github/workflows/ci.yml`, `IOU-client/.github/workflows/ci.yml`

- [ ] **Paso 1:** en cada repo, un workflow `on: [push, pull_request]` con `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 22`, `cache: npm`) y los pasos `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
  - El back necesita `DATABASE_URL` falsa solo para `prisma generate`: `env: DATABASE_URL: postgresql://ci:ci@localhost:5432/ci`.
  - Además, un job `docker build .` que verifica que la imagen compila.
- [ ] **Paso 2:** commit `ci: lint, tests, build e imagen Docker` en cada repo.
- [ ] **Paso 3:** con el OK del usuario, push de `h0-fundaciones` en ambos repos; esperado: los dos workflows en verde (`gh run list --branch h0-fundaciones`).

### Tarea 8: Deploy de punta a punta

- [ ] **Paso 1:** el proyecto de Neon ya existe y quedó conectado en la Tarea 3. Tomar del `.env` las dos connection strings, la **pooled** y la **directa**, para cargarlas en Render.
- [ ] **Paso 2 👤 Render:** crear un *Web Service* desde el repo `IOU-backend`, rama `main`, *Runtime: Docker*, plan Free y *Health Check Path* `/api/health`. Cargar las variables `DATABASE_URL`, `DIRECT_URL`, `NODE_ENV=production` y `CORS_ORIGIN` (en esta primera vuelta, `http://localhost:5173`). Render inyecta `PORT` solo.
- [ ] **Paso 3:** con el OK del usuario, merge de `h0-fundaciones` a `main` en ambos repos (PR con `gh pr create`, checks en verde y merge).
- [ ] **Paso 4:** verificar el back: `curl -s https://<servicio>.onrender.com/api/health`; esperado: `{"status":"ok","db":"ok"}`.
- [ ] **Paso 5 👤 Vercel:** importar `IOU-client` (*Framework: Vite*) con `VITE_API_URL=https://<servicio>.onrender.com/api`.
- [ ] **Paso 6 👤 Render:** actualizar `CORS_ORIGIN` a `https://<proyecto>.vercel.app,http://localhost:5173` y redeployar.
- [ ] **Paso 7:** verificar en producción:
  - **CA-00.1:** abrir la URL de Vercel en una ventana de incógnito; esperado: "API: ok · DB: ok". Con el back dormido, primero aparece "Despertando el servidor…".
  - Recargar la página en `https://<proyecto>.vercel.app/cualquier/ruta`; esperado: carga la app (sin 404).
  - **CA-00.2:** en cada repo, `git log -p --all | grep -inE "postgres(ql)?://[^:/ ]+:[^@ ]+@" | grep -v "USUARIO:PASSWORD\|postgres:dev\|ci:ci"`; esperado: sin resultados.

### Tarea 9: README y cierre del hito

**Archivos:**
- Modificar: `IOU-backend/README.md`, `IOU-client/README.md`
- Crear: `IOU-backend/docs/qa.md`

- [ ] **Paso 1:** completar en los README las URLs de producción y la sección "Cómo ejecutarlo" en dos variantes:
  - **Con Node:** `npm ci`, `.env` y `npm run dev`.
  - **Con Docker:** los comandos de las Tareas 3, 4 y 6.

  Agregar en ambos el aviso del cold start de Render.
- [ ] **Paso 2:** crear `docs/qa.md` con la tabla `| ID | Criterio | Pasos | Esperado | Obtenido | Estado | Fecha |` y las filas CA-00.1, CA-00.2 y CA-00.3 completas, más la salida resumida de `npm test` de cada repo.
- [ ] **Paso 3 (CA-00.3):** siguiendo **solo** el README, en una carpeta limpia (`git clone` nuevo), levantar los 3 contenedores; esperado: "API: ok · DB: ok" en `localhost:8080`.
- [ ] **Paso 4:** commits `docs: README con deploy e instrucciones` y `docs(qa): resultados del H0`; push con el OK del usuario.
- [ ] **Paso 5 👤 Validación del hito:** el usuario abre la app en producción, revisa `docs/qa.md` y aprueba el H0 antes de empezar el H1.
