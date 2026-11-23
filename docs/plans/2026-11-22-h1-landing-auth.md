# H1 · Landing y autenticación — Plan de implementación

> **Para quien ejecute:** usá la skill `executing-plans` tarea por tarea, `test-driven-development` en cada paso de test y `verification-before-completion` antes de dar algo por terminado. Ledger en `IOU/.superpowers/h1/progress.md`. Los pasos con 👤 los hace **el usuario**.

**Objetivo:** que un visitante entienda IOU en la landing, cree su cuenta, ingrese, siga logueado al recargar, cierre sesión, y que nadie sin sesión entre a las rutas protegidas. Todo desplegado.

**Arquitectura:**
- **Back:** las capas de la spec, con dependencias inyectadas. `createAuthService({ usuarios, tokens })` tiene las reglas, `usuarioRepository` habla con Prisma, `createTokenService` firma y verifica los JWT, y `createApp` recibe todo por parámetro para testear sin base.
- **Front:** React Router con un `AuthProvider` que guarda el token (Bearer en `localStorage`), valida la sesión con `GET /auth/me` y redirige al login cuando vence.

**Stack nuevo:**
- **Back:** `bcryptjs`, `jsonwebtoken`, `express-rate-limit` y `dotenv-cli` (dev).
- **Front:** `react-router` y los componentes de shadcn `input`, `label` y `card`.

**Spec:** `IOU-backend/docs/spec.md` (modelo Usuario, RN-18, API `/auth/*`) · `historias-usuario.md` (HU-01 a HU-05, HU-30) · `design.md` (secciones 5, 7 y 10).

## Restricciones globales

- Rama `h1-auth` en cada repo, creada desde `main`. Push, PR y merge solo con el OK del usuario.
- **El desarrollo usa la rama `dev` de Neon**, nunca `production`. `.env.local` apunta a `dev`; Render sigue con `production`.
- Errores con el formato `{ error: { code, message, details? } }` y mensajes en español. Los códigos de este hito:

  | HTTP | `code` | Cuándo |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | Datos inválidos; `details` es `{ campo: mensaje }` |
  | 401 | `CREDENCIALES_INVALIDAS` | Email o contraseña incorrectos |
  | 401 | `NO_AUTENTICADO` | Falta el token |
  | 401 | `TOKEN_INVALIDO` | El token no es válido |
  | 401 | `TOKEN_EXPIRADO` | El token venció |
  | 409 | `EMAIL_EN_USO` | El email ya está registrado |
  | 429 | `DEMASIADOS_INTENTOS` | Se superó el límite de intentos |
- La API devuelve al usuario como `{ id, nombre, email }`, **nunca** con `passwordHash`.
- Contraseña de 8 a 72 caracteres (72 es el límite de bcrypt). Email con `trim` y en minúsculas, de 120 caracteres como máximo. Nombre con `trim`, de 1 a 80 caracteres.
- Variables nuevas del back: `JWT_SECRET` (obligatoria, de 32 caracteres o más) y `JWT_EXPIRES_IN` (por defecto `7d`).
- Textos de la UI tomados de las HU y de design.md, con voseo. Los botones dicen la acción: "Crear cuenta", "Ingresar", "Cerrar sesión".

## Puntos de atención (Review Focus)

1. **Variantes del mismo email** (`" Sofi@Mail.com "` y `sofi@mail.com`): son la misma cuenta, tanto al registrarse como al ingresar. Se prueba en las Tareas 3 y 4.
2. **Contraseñas de más de 72 caracteres:** bcrypt ignora lo que sigue, así que se rechazan con un mensaje claro en vez de aceptarse truncadas (Tarea 4).
3. **Ataque de fuerza bruta al login:** límite de 10 intentos cada 15 minutos por IP en `/api/auth/login` y `/api/auth/register`, con respuesta 429 y mensaje en español. Va con `app.set('trust proxy', 1)`, porque Render está detrás de un proxy (Tarea 4).
4. **Dos registros simultáneos con el mismo email:** la restricción `UNIQUE` de la base (error Prisma `P2002`) responde 409, no 500 (Tarea 3).
5. **`localStorage` no disponible** (navegación privada o bloqueado): la app funciona igual, con la sesión en memoria mientras dure la pestaña (Tarea 5).

---

## Archivos

```
IOU-backend/                                   IOU-client/
├── neon.ts                 (rama dev sin TTL)    ├── src/
├── prisma/schema.prisma    (+ model Usuario)     │   ├── main.tsx            (+ RouterProvider)
├── prisma/migrations/…_usuarios/                 │   ├── router.tsx          (rutas)
├── src/                                          │   ├── api/client.ts       (+ ApiError, apiRequest)
│   ├── config/env.ts       (+ JWT_*)             │   ├── auth/tokenStore.ts
│   ├── lib/password.ts                           │   ├── auth/AuthProvider.tsx  (useAuth)
│   ├── lib/tokens.ts                             │   ├── auth/RequireAuth.tsx
│   ├── domain/usuario.ts   (tipos)               │   ├── schemas/auth.ts     (Zod de formularios)
│   ├── repositories/usuario.repository.ts        │   ├── lib/money.ts        (splitEqual, formatMoney)
│   ├── services/auth.service.ts                  │   ├── components/Vale.tsx, Monto.tsx
│   ├── schemas/auth.schemas.ts                   │   ├── components/AppShell.tsx
│   ├── middlewares/validate.ts                   │   ├── pages/LandingPage.tsx
│   ├── middlewares/requireAuth.ts                │   ├── pages/LoginPage.tsx, RegisterPage.tsx
│   ├── middlewares/rateLimit.ts                  │   ├── pages/GruposPage.tsx  (placeholder H2)
│   ├── controllers/auth.controller.ts            │   └── pages/NotFoundPage.tsx
│   ├── routes/auth.routes.ts                     └── (tests junto a cada archivo)
│   ├── app.ts              (+ deps de auth)
│   └── server.ts           (+ wiring)
└── tests/
    ├── helpers/testApp.ts  (app + repo en memoria)
    ├── password.test.ts · tokens.test.ts
    ├── auth.service.test.ts
    └── auth.routes.test.ts
```

---

### Tarea 1: Rama `dev` de Neon y modelo `Usuario`

**Archivos:** `neon.ts`, `prisma/schema.prisma`, `prisma/migrations/`, `package.json`

- [ ] **Paso 1:** `git -C IOU-backend switch -c h1-auth` y `git -C IOU-client switch -c h1-auth`.
- [ ] **Paso 2:** en `neon.ts`, la política de ramas devuelve `{}` para `branch.name === 'dev'`, así esa rama no vence. Las demás ramas nuevas siguen con `ttl: '7d'`.
- [ ] **Paso 3:** en `IOU-backend`, `npx neon@latest checkout dev --create` y luego `npx neon@latest env pull`. Esperado: `.env.local` apunta a la rama `dev`. Verificar sin imprimir secretos: el host de `DATABASE_URL` es distinto del de producción y `NEON_BRANCH=dev`.
- [ ] **Paso 4:** instalar `dotenv-cli` (dev) y agregar los scripts `db:migrate` (`dotenv -e .env.local -- prisma migrate dev`) y `db:studio` (`dotenv -e .env.local -- prisma studio`).
- [ ] **Paso 5:** el modelo en `schema.prisma`:

```prisma
model Usuario {
  id           String   @id @default(uuid()) @db.Uuid
  nombre       String   @db.VarChar(80)
  email        String   @unique @db.VarChar(120)
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@map("usuarios")
}
```

- [ ] **Paso 6:** `npm run db:migrate -- --name usuarios`. Esperado: se crea `prisma/migrations/<fecha>_usuarios/migration.sql` con `CREATE TABLE "usuarios"` y el índice único de `email`, aplicado en `dev`.
- [ ] **Paso 7:** commit `feat(db): modelo Usuario y rama dev de Neon`.

### Tarea 2: Contraseñas, tokens y entorno

**Archivos:** `src/lib/password.ts`, `src/lib/tokens.ts`, `src/config/env.ts`, `.env.example` · Tests: `tests/password.test.ts`, `tests/tokens.test.ts`, `tests/env.test.ts`

**Interfaces producidas:**
- `hashPassword(plain: string): Promise<string>` (bcryptjs, `BCRYPT_ROUNDS = 10`) y `verifyPassword(plain: string, hash: string): Promise<boolean>`.
- `type TokenPayload = { sub: string }`
- `type TokenService = { sign(payload: TokenPayload): string; verify(token: string): TokenPayload }`
- `createTokenService(opts: { secret: string; expiresIn: string }): TokenService`. `verify` tira `AppError(401, 'TOKEN_EXPIRADO', 'Tu sesión expiró. Ingresá de nuevo.')` si el token venció y `AppError(401, 'TOKEN_INVALIDO', 'La sesión no es válida. Ingresá de nuevo.')` ante cualquier otro error.
- `Env` suma `JWT_SECRET: string` (mínimo 32) y `JWT_EXPIRES_IN: string` (por defecto `'7d'`).

- [ ] **Paso 1: tests (fallan)**

```ts
// password.test.ts
it('el hash no es la contraseña y verifica', async () => {
  const h = await hashPassword('secreta123');
  expect(h).not.toContain('secreta123');
  expect(await verifyPassword('secreta123', h)).toBe(true);
  expect(await verifyPassword('otra', h)).toBe(false);
});
// tokens.test.ts
const t = createTokenService({ secret: 'x'.repeat(32), expiresIn: '1h' });
it('firma y verifica', () => { expect(t.verify(t.sign({ sub: 'u1' })).sub).toBe('u1'); });
it('token vencido → TOKEN_EXPIRADO', () => {
  const viejo = createTokenService({ secret: 'x'.repeat(32), expiresIn: '-1s' }).sign({ sub: 'u1' });
  expect(() => t.verify(viejo)).toThrow(expect.objectContaining({ status: 401, code: 'TOKEN_EXPIRADO' }));
});
it('firma de otro secreto → TOKEN_INVALIDO', () => {
  const ajeno = createTokenService({ secret: 'y'.repeat(32), expiresIn: '1h' }).sign({ sub: 'u1' });
  expect(() => t.verify(ajeno)).toThrow(expect.objectContaining({ code: 'TOKEN_INVALIDO' }));
});
// env.test.ts (agregar; `base` suma JWT_SECRET de 32 caracteres)
it('exige JWT_SECRET de 32+ caracteres', () => {
  expect(() => loadEnv({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
});
it('JWT_EXPIRES_IN por defecto 7d', () => { expect(loadEnv(base).JWT_EXPIRES_IN).toBe('7d'); });
```

- [ ] **Paso 2:** `npm test`. Esperado: FAIL (módulos inexistentes y JWT_SECRET no validado).
- [ ] **Paso 3:** implementar. Agregar `JWT_SECRET` y `JWT_EXPIRES_IN=7d` a `.env.example` (con un valor de ejemplo no real) y un `JWT_SECRET` aleatorio a `.env.local`, generado con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` y **sin mostrarlo**.
- [ ] **Paso 4:** `npm test`; esperado: todo pasa. Lint y typecheck en verde.
- [ ] **Paso 5:** commit `feat(auth): hash de contraseñas, JWT y variables de entorno`.

### Tarea 3: Servicio y repositorio de usuarios

**Archivos:** `src/domain/usuario.ts`, `src/repositories/usuario.repository.ts`, `src/services/auth.service.ts` · Tests: `tests/auth.service.test.ts`, `tests/helpers/memoryUsuarios.ts`

**Interfaces producidas:**
- `type Usuario = { id: string; nombre: string; email: string }` y `type UsuarioConHash = Usuario & { passwordHash: string }`.
- `interface UsuarioRepository { findByEmail(email: string): Promise<UsuarioConHash | null>; findById(id: string): Promise<Usuario | null>; create(data: { nombre: string; email: string; passwordHash: string }): Promise<Usuario> }`. Si el email está repetido, `create` tira `AppError(409, 'EMAIL_EN_USO', 'El email ya está en uso')`.
- `createPrismaUsuarioRepository(prisma: PrismaClient): UsuarioRepository` traduce el `P2002` a `EMAIL_EN_USO`.
- `createMemoryUsuarioRepository(): UsuarioRepository` (solo tests) aplica la misma unicidad.
- `type AuthResult = { token: string; usuario: Usuario }`
- `createAuthService(deps: { usuarios: UsuarioRepository; tokens: TokenService }): { register(i: { nombre: string; email: string; password: string }): Promise<AuthResult>; login(i: { email: string; password: string }): Promise<AuthResult>; me(id: string): Promise<Usuario> }`. Recibe los datos ya validados y normalizados por el schema (Tarea 4).

- [ ] **Paso 1: tests (fallan)** con el repositorio en memoria:
  - `register` crea al usuario, devuelve un token cuyo `sub` es su id, y la respuesta no tiene `passwordHash` (CA-01.1, CA-01.4).
  - `register` con un email existente tira `EMAIL_EN_USO` y no crea un segundo usuario (CA-01.2).
  - `login` con credenciales correctas devuelve un token (CA-02.1).
  - `login` con contraseña incorrecta, o con email inexistente, tira **el mismo** `AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos')` (CA-02.2).
  - `me` con un id inexistente tira `AppError(401, 'TOKEN_INVALIDO', …)`, porque el usuario del token ya no existe.
  - El repositorio en memoria rechaza un `create` duplicado con `EMAIL_EN_USO` (Review Focus 4).
- [ ] **Paso 2:** `npm test`; esperado: FAIL.
- [ ] **Paso 3:** implementar. Para no revelar si el email existe por el tiempo de respuesta, `login` con un email inexistente igual corre `verifyPassword` contra un hash ficticio fijo.
- [ ] **Paso 4:** `npm test`; esperado: pasa.
- [ ] **Paso 5:** prueba manual del repositorio de Prisma contra `dev`: un script temporal (que no se commitea) crea un usuario, lo busca y repite el email. Esperado: `EMAIL_EN_USO`. Después se borra la fila.
- [ ] **Paso 6:** commit `feat(auth): servicio de registro, login y usuario actual`.

### Tarea 4: Endpoints `/api/auth/*`

**Archivos:** `src/schemas/auth.schemas.ts`, `src/middlewares/validate.ts`, `src/middlewares/requireAuth.ts`, `src/middlewares/rateLimit.ts`, `src/controllers/auth.controller.ts`, `src/routes/auth.routes.ts`, `src/app.ts`, `src/server.ts` · Tests: `tests/auth.routes.test.ts`, `tests/helpers/testApp.ts`; adaptar `health.test.ts` y `app.test.ts` al helper.

**Interfaces producidas:**
- `registerSchema`, con `nombre`, `email` y `password` según las restricciones globales, y `loginSchema`, con `email` y `password` de al menos 1 carácter.
- `validate(schema)`: reemplaza `req.body` por el resultado parseado o tira `AppError(400, 'VALIDATION_ERROR', 'Revisá los datos ingresados', { campo: mensaje })`.
- `requireAuth(tokens)`: lee `Authorization: Bearer <token>`. Si falta, tira `NO_AUTENTICADO` ("Tenés que ingresar para continuar"); si está, deja `res.locals.userId`.
- `authRateLimit`: `express-rate-limit` con `windowMs` de 15 minutos y `limit` de 10. El handler responde `429 DEMASIADOS_INTENTOS` ("Demasiados intentos. Probá de nuevo en unos minutos.").
- `AppDeps` pasa a ser `{ checkDb; corsOrigins; authService; tokens; rateLimit?: boolean }`. `rateLimit` es `true` por defecto y los tests lo desactivan, salvo el del límite.
- Rutas:

| Ruta | Respuesta OK | Body de entrada |
|---|---|---|
| `POST /api/auth/register` | 201 `{ token, usuario }` | `{ nombre, email, password }` |
| `POST /api/auth/login` | 200 `{ token, usuario }` | `{ email, password }` |
| `GET /api/auth/me` | 200 `{ usuario }` | — (requiere el token) |

- [ ] **Paso 1: tests (fallan)**, con `makeTestApp()`, que usa el repositorio en memoria y un token service real:
  - `register` 201 y `me` con ese token devuelve el mismo usuario (CA-01.1).
  - `register` con `"  Sofi@Mail.com "` y después `login` con `sofi@mail.com` → 200 (Review Focus 1).
  - `register` con el mismo email en mayúsculas → 409 `EMAIL_EN_USO` (CA-01.2).
  - `register` con contraseña de 7 caracteres → 400 con `details.password`; con email inválido → 400 con `details.email` (CA-01.3).
  - Contraseña de 73 caracteres → 400 con `details.password` (Review Focus 2).
  - `login` con credenciales incorrectas → 401 `CREDENCIALES_INVALIDAS` (CA-02.2).
  - `me` sin token → 401 `NO_AUTENTICADO`; con un token inválido → 401 `TOKEN_INVALIDO`; con un token vencido → 401 `TOKEN_EXPIRADO` (CA-03.2, CA-05.2).
  - Ninguna respuesta tiene `passwordHash` (se verifica sobre el JSON serializado).
  - Con `rateLimit: true`, el intento 11 de `login` dentro de la ventana → 429 `DEMASIADOS_INTENTOS` (Review Focus 3).
- [ ] **Paso 2:** `npm test`; esperado: FAIL.
- [ ] **Paso 3:** implementar.
  - `createApp` suma `app.set('trust proxy', 1)` y monta `/api/auth` antes de `notFound`.
  - `server.ts` arma `createTokenService({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN })` y `createAuthService({ usuarios: createPrismaUsuarioRepository(prisma), tokens })`.
- [ ] **Paso 4:** `npm test`, `npm run lint` y `npm run typecheck`; esperado: todo en verde.
- [ ] **Paso 5:** prueba manual contra `dev` con `npm run dev` y `curl`: register 201 → login 200 → me 200 → register repetido 409.
- [ ] **Paso 6:** en el mismo commit, agregar a la sección 7 de `spec.md` los bodies y respuestas de `/auth/*`, la tabla de códigos de error de este hito y el límite de intentos.
- [ ] **Paso 7:** commit `feat(auth): endpoints de registro, login y sesión`.

### Tarea 5: Base del front: rutas, cliente HTTP y sesión

**Archivos:** `src/router.tsx`, `src/main.tsx`, `src/api/client.ts`, `src/auth/tokenStore.ts`, `src/auth/AuthProvider.tsx`, `src/auth/RequireAuth.tsx`, `src/components/AppShell.tsx`, `src/pages/GruposPage.tsx`, `src/pages/NotFoundPage.tsx` · Tests: `client.test.ts` (ampliar), `tokenStore.test.ts`, `AuthProvider.test.tsx`, `RequireAuth.test.tsx`

**Interfaces producidas:**
- `class ApiError extends Error { status: number; code: string; details?: Record<string, string> }`
- `apiRequest<T>(method: 'GET' | 'POST', path: string, opts?: { body?: unknown; token?: string | null; timeoutMs?: number }): Promise<T>`: tira `ApiError` con el `error` del cuerpo, o con `code: 'SIN_CONEXION'` ante un fallo de red.
- `tokenStore: { get(): string | null; set(t: string): void; clear(): void }`, con clave `iou.token`. Si `localStorage` tira, usa memoria (Review Focus 5).
- `useAuth(): { status: 'loading' | 'authenticated' | 'anonymous'; usuario: Usuario | null; login(email: string, password: string): Promise<void>; register(nombre: string, email: string, password: string): Promise<void>; logout(): void }`
- Rutas: `/` (landing), `/ingresar`, `/registrarme`, `/grupos` (protegida), `*` (404).

- [ ] **Paso 1:** `npm i react-router` y `npx shadcn@latest add input label card`. Revisar que los imports usen `@/lib/utils` (ruling del H0).
- [ ] **Paso 2: tests (fallan)**
  - `apiRequest` manda `Authorization: Bearer t` cuando hay token, y tira `ApiError` con `code` y `details` ante un 400.
  - `tokenStore` funciona cuando `localStorage.setItem` tira.
  - `AuthProvider`: con un token guardado y `/auth/me` en 200 → `status: 'authenticated'` (CA-03.1). Con `/auth/me` en 401 `TOKEN_EXPIRADO` → borra el token y navega a `/ingresar?sesion=expirada` (CA-03.2).
  - `RequireAuth`: anónimo en `/grupos` → redirige a `/ingresar` y guarda la ruta de origen (CA-05.1). Autenticado → muestra el contenido.
  - Un logout borra el token, limpia el caché de queries y lleva a `/ingresar` (CA-04.1).
- [ ] **Paso 3:** `npm test`; esperado: FAIL.
- [ ] **Paso 4:** implementar.
  - `AppShell` tiene el header con `<Logo>`, el nombre del usuario y el botón "Cerrar sesión".
  - `GruposPage` muestra el estado vacío de design.md 7.3 ("Todavía no tenés grupos…"), con el botón "Crear un grupo" deshabilitado y el texto de ayuda "Disponible en la próxima versión".
  - Mientras `status === 'loading'`, se muestra el esqueleto del shell.
  - `vercel.json` ya cubre las rutas profundas.
- [ ] **Paso 5:** `npm test`, `npm run lint`, `npm run typecheck` y `npm run build`; todo en verde.
- [ ] **Paso 6:** commit `feat(client): rutas, cliente HTTP y sesión`.

### Tarea 6: Pantallas de ingreso y registro

**Archivos:** `src/schemas/auth.ts`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx` · Tests: `LoginPage.test.tsx`, `RegisterPage.test.tsx`

Diseño: design.md sección 6 (una columna de 400 px y un vale decorativo) y sección 7.5 (errores).

- [ ] **Paso 1: tests (fallan)**, con `fetch` mockeado:
  - Registro válido → llama a `POST /auth/register` y navega a `/grupos` (CA-01.1).
  - Registro con email en uso (409) → muestra "El email ya está en uso" debajo del campo email (CA-01.2).
  - Contraseña corta → el error aparece en el campo al enviar, sin llamar a la API (CA-01.3).
  - Login incorrecto (401) → "Email o contraseña incorrectos", sin decir cuál de los dos falló (CA-02.2).
  - Con `?sesion=expirada` → el login muestra "Tu sesión expiró. Ingresá de nuevo." (CA-03.2).
  - Mientras envía, el botón queda deshabilitado y dice "Ingresando…" o "Creando cuenta…" (design.md 7.1).
  - Después del login se vuelve a la ruta de origen guardada por `RequireAuth`, o a `/grupos`.
- [ ] **Paso 2:** `npm test`; esperado: FAIL.
- [ ] **Paso 3:** implementar.
  - Los labels siempre están visibles y los errores van enlazados con `aria-describedby` (design.md 9).
  - Los `autocomplete` son `email`, `current-password`, `new-password` y `name`.
  - Un usuario ya logueado que entra a `/ingresar` o `/registrarme` se redirige a `/grupos`.
- [ ] **Paso 4:** todos los checks en verde.
- [ ] **Paso 5:** commit `feat(client): pantallas de ingreso y registro`.

### Tarea 7: Landing (HU-30)

**Archivos:** `src/lib/money.ts`, `src/components/Monto.tsx`, `src/components/Vale.tsx`, `src/pages/LandingPage.tsx` · Tests: `money.test.ts`, `LandingPage.test.tsx`

**Interfaces producidas:**
- `splitEqual(totalCents: number, ids: number[]): Record<number, number>`: el algoritmo de la spec 4.2, con base `floor` y los centavos sobrantes a los primeros ids en orden ascendente.
- `formatMoney(cents: number): string`: `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`, sin decimales cuando son `,00`.
- `parseMoney(input: string): number | null`: acepta `"36.000"`, `"36000,50"` y `"36000.5"`; devuelve centavos, o `null` si es inválido o negativo.
- `<Vale de a monto firma? />`: el vale troquelado de design.md (`mask` y borde punteado).

- [ ] **Paso 1: tests (fallan)**
  - `splitEqual(10000, [1, 2, 3])` da `{ 1: 3334, 2: 3333, 3: 3333 }` (CB-01), y `splitEqual(1, [1, 2, 3])` da `{ 1: 1, 2: 0, 3: 0 }` (CB-02). La suma siempre es igual al total (probarlo para totales de 1 a 1000 y entre 1 y 8 personas).
  - `formatMoney(3600000)` da `"$ 36.000"` (comparar sin el espacio fino) y `formatMoney(3334)` da `"$ 33,34"`.
  - `parseMoney` con los casos válidos de arriba, y `null` para `"abc"` y `"-5"`.
  - Landing: muestra el título "Cuentas claras entre amigos." y el botón "Crear un grupo gratis" (CA-30.1).
  - Demo: con 36.000 entre 4 se ven 3 vales de "$ 9.000". Al cambiar a 3 personas se ven 2 vales de "$ 12.000" (CA-30.2).
  - Con sesión activa, el botón principal dice "Ir a mis grupos" y lleva a `/grupos` (CA-30.3).
- [ ] **Paso 2:** `npm test`; esperado: FAIL.
- [ ] **Paso 3:** implementar la landing según design.md sección 5 y el prototipo `docs/prototipo-d0.html`:
  - **Secciones:** header, hero con la demo, "Así funciona" (3 pasos), el caso Bariloche, los beneficios, el CTA final y el footer.
  - **Animación:** la única es la caída de los vales al cargar, con `prefers-reduced-motion`.
  - **Textos:** los del prototipo, revisados con la skill `copywriting`.
  - **Assets:** sin imágenes externas; el ícono `apple-touch-icon` es `public/brand/iou-icon.svg`.
- [ ] **Paso 4:** todos los checks en verde.
- [ ] **Paso 5:** revisar la landing con la skill `web-design-guidelines` a 375 px y 1280 px en el navegador, en tema claro y oscuro, y corregir lo que encuentre.
- [ ] **Paso 6:** commit `feat(client): landing con demo de reparto`.

### Tarea 8: Deploy, verificación y cierre

- [ ] **Paso 1 👤 Render:** generar el secreto en la terminal propia con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` y pegarlo directo en Render → servicio `iou-backend` → *Environment* → *Add Environment Variable* como `JWT_SECRET`. El valor no pasa por el chat. Agregar también `JWT_EXPIRES_IN=7d` y guardar con *Save Changes*.
- [ ] **Paso 2:** con el OK del usuario, push de `h1-auth`, PRs con el CI en verde y merge a `main` en los dos repos. Render aplica la migración `usuarios` sobre `production` al arrancar (`prisma migrate deploy`).
- [ ] **Paso 3: verificación en producción**
  - `curl` contra la API: register → login → me → register repetido 409. Después se borra la cuenta de prueba con un script contra `production` (o queda como usuario demo, si el usuario prefiere).
  - En el navegador, en https://iou-client.vercel.app:
    - Landing y demo en 375 px y 1280 px.
    - Registro, ingreso, recarga (sigue logueado), cierre de sesión e intento de entrar a `/grupos` (redirige).
  - Lighthouse de la landing en mobile: Performance y Accessibility ≥ 90 (CA-30.4).
- [ ] **Paso 4:** `docs/qa.md` con la sección H1 (todos los CA de HU-01 a HU-05 y HU-30, más los tests automáticos) y los README actualizados (endpoints de auth y variables `JWT_*`).
- [ ] **Paso 5 👤 Validación del hito.**
