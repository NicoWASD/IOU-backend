# IOU · Backend

API REST de **IOU** ("I owe you"), una app web para registrar gastos compartidos en grupo, ver quién le debe a quién y saldar deudas con la mínima cantidad de transferencias.

[![CI](https://github.com/NicoWASD/IOU-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/NicoWASD/IOU-backend/actions/workflows/ci.yml)

> Hito actual: **H0 · Fundaciones** completo. Siguiente: H1 · Landing y autenticación.

## Links

| | |
|---|---|
| App en producción | https://iou-client.vercel.app |
| API en producción | https://iou-backend.onrender.com/api/health |
| Repo del frontend | [IOU-client](https://github.com/NicoWASD/IOU-client) |

> **Aviso:** la API corre en el plan gratuito de Render, que se duerme tras 15 minutos sin uso. La primera solicitud puede tardar hasta un minuto; la app lo indica con "Despertando el servidor…".

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

- `src/app.ts`: `createApp({ checkDb, corsOrigins })` arma la app con sus dependencias, para testearla sin base real.
- `src/server.ts`: valida el entorno y levanta el servidor. No necesita la DB para arrancar: si la base no responde, `/api/health` devuelve 503.
- Errores con el formato `{ "error": { "code", "message", "details?" } }`.

## Endpoints disponibles

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | `200 {"status":"ok","db":"ok"}` · `503 {"status":"error","db":"error"}` |

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

`npm run dev` lee `.env.local`. Otros scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y `npm start`.

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
