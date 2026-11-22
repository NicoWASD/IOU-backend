# Informe de QA — IOU

Registro de las pruebas de cada hito: criterios de aceptación (CA) de [historias-usuario.md](historias-usuario.md), pasos ejecutados y resultados.

**Estados:** ✅ pasa · ❌ falla · ⏳ pendiente

## Resumen

| Hito | CA totales | ✅ | ❌ | ⏳ | Tests automatizados |
|---|---|---|---|---|---|
| H0 · Fundaciones | 3 | 2 | 0 | 1 | back 10/10 · front 8/8 |

---

## H0 · Fundaciones (HU-00)

**Fecha:** 2026-11-22 · **Entorno:** producción (Vercel + Render + Neon) y local (Windows 11, Node 24)

### Criterios de aceptación

| ID | Criterio | Pasos | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CA-00.1 | El front en internet muestra el estado de la API y la DB | Abrir https://iou-client.vercel.app | "API: ok · DB: ok" | "API: ok · DB: ok" (captura del usuario); CORS de Render devuelve `access-control-allow-origin: https://iou-client.vercel.app` | ✅ |
| CA-00.2 | Sin credenciales en el código ni en el historial | En cada repo: `git log -p --all` buscando URLs `postgres://usuario:clave@`, y `git log --all --name-only` buscando archivos `.env` | 0 coincidencias | IOU-backend: 0 URLs y 0 archivos `.env`. IOU-client: 0 y 0 | ✅ |
| CA-00.3 | Cada repo levanta en local con `docker build` / `docker run` siguiendo el README | Clone limpio, comandos de Docker de cada README | La app en `localhost:8080` muestra "API: ok · DB: ok" | No ejecutado en local: Docker Desktop no estaba corriendo. Cubierto en parte por CI (ver abajo) | ⏳ |

### Pruebas adicionales del hito

| Caso | Pasos | Esperado | Obtenido | Estado |
|---|---|---|---|---|
| Health en producción | `curl https://iou-backend.onrender.com/api/health` | 200 `{"status":"ok","db":"ok"}` | 200 `{"status":"ok","db":"ok"}` | ✅ |
| DB caída | API con `DATABASE_URL` a un puerto cerrado, `curl /api/health` | 503 y el proceso sigue vivo | 503 `{"status":"error","db":"error"}`; `/api/nada` responde 404 | ✅ |
| Falta una variable | `node dist/server.js` sin `DATABASE_URL` | Mensaje que nombra la variable y exit 1 | "Variables de entorno inválidas: DATABASE_URL: …", exit 1 | ✅ |
| Rutas profundas de la SPA | `curl https://iou-client.vercel.app/grupos/123` | 200 (carga la app) | 200 | ✅ |
| Imagen Docker del back | CI: `docker build` y arranque sin `DATABASE_URL` | Build OK y salida con error | OK (run 45063506650) | ✅ |
| Imagen Docker del front | CI: `docker build`, `curl localhost:8080/` y `/grupos/123` | Build OK, HTML de la app y 200 | OK (run 45063508956) | ✅ |

### Tests automatizados

**IOU-backend** (`npm test`): 10 passed

- `env.test.ts`: aplica defaults · normaliza `CORS_ORIGIN` con espacios y barra final · nombra la variable que falta · rechaza `PORT` no numérico.
- `health.test.ts`: 200 con DB ok · 503 si la DB falla sin filtrar el error.
- `app.test.ts`: 404 con formato de error · JSON mal formado → 400 `INVALID_JSON` · CORS permite el origen configurado · CORS bloquea otros orígenes.

**IOU-client** (`npm test`): 8 passed

- `client.test.ts`: `joinUrl` sin doble barra (4 combinaciones).
- `HealthStatus.test.tsx`: "Despertando el servidor…" mientras espera · "API: ok · DB: ok" · "API: ok · DB: sin conexión" ante 503 · "API: sin conexión" si falla la red.

### Observaciones

- `npm audit` reporta 4 vulnerabilidades altas en la CLI de Prisma (dependencia `effect`). Es tooling de desarrollo, no corre en el servidor; el arreglo requiere Prisma 7. Revisar antes de la entrega.
- La base de desarrollo local apunta a la rama `production` de Neon. Antes del H1, crear una rama `dev`.
