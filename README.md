# IOU · Backend

API REST de **IOU** ("I owe you"), una app web para registrar gastos compartidos en grupo, ver quién le debe a quién y saldar deudas con la mínima cantidad de transferencias.

[![CI](https://github.com/NicoWASD/IOU-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/NicoWASD/IOU-backend/actions/workflows/ci.yml)

> Estado: **H0 a H5 completos** (todas las historias del MVP). Detalle en el [informe de QA](docs/qa.md).

## Links

| | |
|---|---|
| App en producción | https://iou-client.vercel.app |
| API en producción | https://iou-backend.onrender.com/api/health |
| Repo del frontend | [IOU-client](https://github.com/NicoWASD/IOU-client) |

> **Aviso:** la API corre en el plan gratuito de Render, que se duerme tras 15 minutos sin uso. La primera solicitud puede tardar hasta un minuto; la app lo indica con "Despertando el servidor…".

## Probalo

Entrá a **https://iou-client.vercel.app** con el usuario demo:

| Email | Contraseña |
|---|---|
| `ana.demo@iou.test` | `demo-iou-2026` |

También existen `bruno.demo@iou.test` y `carla.demo@iou.test` (misma contraseña). Tienen dos grupos, "Viaje a Bariloche" y "Depto compartido", con gastos de los tres tipos y pagos. Son cuentas públicas de demostración: no guardes datos reales.

## Documentación

- [Especificación](docs/spec.md): modelo de datos, reglas de negocio, casos borde, API y arquitectura.
- [Historias de usuario e hitos](docs/historias-usuario.md)
- [Sistema de diseño](docs/design.md)
- [Informe de QA](docs/qa.md)
- [Planes de implementación](docs/plans/)

## Stack

Node.js 22 · Express 5 · TypeScript (strict) · Prisma 6 · PostgreSQL (Neon) · Zod · Vitest + Supertest · Docker · GitHub Actions

## Arquitectura

```
routes → controllers → services (reglas de negocio) → repositories (Prisma) → PostgreSQL
```

- `src/domain/`: tipos y cálculos puros, en centavos: reparto de gastos (`reparto.ts`, spec 4.2 y 4.3) y balances y liquidación (`balances.ts`, spec 4.1 y 4.4).
- `src/services/`: las reglas de negocio (RN-xx). No conocen Express; los repositorios se inyectan y los tests usan versiones en memoria.
- `src/app.ts`: `createApp(deps)` arma la app con sus dependencias, para testearla sin base real.
- `src/server.ts`: valida el entorno y levanta el servidor. No necesita la DB para arrancar: si la base no responde, `/api/health` devuelve 503.
- Errores con el formato `{ "error": { "code", "message", "details?" } }`.

## Endpoints disponibles

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | `200 {"status":"ok","db":"ok"}` · `503 {"status":"error","db":"error"}` |
| POST | `/api/auth/register` · `/api/auth/login` | `{ token, usuario }` |
| GET | `/api/auth/me` | Usuario de la sesión |
| GET · POST | `/api/grupos` | Mis grupos (con `miBalance`) · crear |
| GET · PATCH | `/api/grupos/:id` | Detalle · editar (admin) |
| GET · POST · DELETE | `/api/grupos/:id/miembros[/:usuarioId]` | Miembros · agregar por email · quitar |
| GET · POST · GET · PUT · DELETE | `/api/grupos/:id/gastos[/:gastoId]` | Gastos paginados · crear · detalle · editar · eliminar |
| GET | `/api/grupos/:id/balances` · `/liquidacion` | Balances · transferencias sugeridas |
| GET · POST · DELETE | `/api/grupos/:id/pagos[/:pagoId]` | Pagos · registrar · eliminar |
| POST | `/api/grupos/:id/archivar` | Archivar (admin, todo en 0) |

Todas las rutas salvo `/health` y el registro e ingreso piden `Authorization: Bearer <token>`. El contrato completo está en [docs/api-contract.md](docs/api-contract.md).

## Variables de entorno

Copiá `.env.example` a `.env.local`, o generalo con la CLI de Neon (`npx neon@latest env pull`).

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL *pooled* de Neon (host con `-pooler`); la usa la app |
| `DATABASE_URL_UNPOOLED` | URL directa de Neon; la usa Prisma para las migraciones |
| `CORS_ORIGIN` | Orígenes permitidos separados por coma, p. ej. `https://iou-client.vercel.app,http://localhost:5173` |
| `PORT` | Puerto (por defecto `3000`; Render lo define solo) |
| `NODE_ENV` | `development` · `test` · `production` |

## Cómo ejecutarlo

### Con Node (22 o superior)

```bash
npm ci
npm run dev
```

`npm run dev` lee `.env.local`. Antes de la primera vez, `npm run db:deploy` crea las tablas. Otros scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm start`.

**Datos de demostración:** con la API corriendo, `npm run db:seed` carga los usuarios y grupos demo por la API (no duplica si ya existen). Para otro entorno: `API_URL=https://iou-backend.onrender.com/api npm run db:seed`.

### Con Docker (sin Compose)

```bash
docker network create iou-net
docker run -d --name iou-db --network iou-net -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=app -p 5432:5432 postgres:17-alpine
docker build -t iou-backend .
docker run --rm --name iou-backend --network iou-net -p 3000:3000 -e DATABASE_URL=postgresql://postgres:dev@iou-db:5432/app -e DATABASE_URL_UNPOOLED=postgresql://postgres:dev@iou-db:5432/app -e CORS_ORIGIN=http://localhost:8080 iou-backend
```

Después: `curl localhost:3000/api/health`. Para levantar también el front, seguí el README de [IOU-client](https://github.com/NicoWASD/IOU-client).

## Deploy

- **API:** Render, *Web Service* con runtime Docker, desde `main`. Health check en `/api/health`. Al arrancar corre `prisma migrate deploy`.
- **Base de datos:** Neon (región `us-east-2`), configurada con `neon.ts`.

## Seguridad

- Contraseñas con bcrypt, sesión con JWT, límite de intentos en `/auth` y en las altas de miembros.
- Un no miembro recibe 404 en todo `/grupos/:id/*` (no se revela que el grupo existe).
- Sin credenciales en el repo: todo va por variables de entorno.
- `npm audit` marca 4 vulnerabilidades *high* en el CLI de Prisma (`deepmerge-ts` y `effect`). Solo corren en `prisma generate`/`migrate` con la configuración del repo; el arreglo exige Prisma 7 y queda como riesgo aceptado (ver [qa.md](docs/qa.md)).
