# Informe de QA — IOU

Registro de las pruebas de cada hito: criterios de aceptación (CA) de [historias-usuario.md](historias-usuario.md), pasos ejecutados y resultados.

**Estados:** ✅ pasa · ❌ falla · ⏳ pendiente

## Resumen

| Hito | CA totales | ✅ | ❌ | ⏳ | Tests automatizados |
|---|---|---|---|---|---|
| H0 · Fundaciones | 3 | 2 | 0 | 1 | back 10/10 · front 8/8 |
| H1 · Landing y autenticación | 21 | 21 | 0 | 0 | back 34/34 · front 51/51 |
| H2 · Grupos y miembros | 24 | 24 | 0 | 0 | back 125/125 · front 139/139 |

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

---

## H1 · Landing y autenticación (HU-01 a HU-05, HU-30)

**Fecha:** 2026-11-23 · **Entorno:** producción (Vercel + Render + Neon `production`) y local (rama `dev` de Neon)

| ID | Criterio | Evidencia | Estado |
|---|---|---|---|
| CA-01.1 | Registro válido crea la cuenta y entra | Prod: `POST /auth/register` 201 + `GET /auth/me` 200. Test `auth.routes` y `auth.test.tsx` | ✅ |
| CA-01.2 | Email repetido (cualquier capitalización) → "El email ya está en uso" | Prod: 409 `EMAIL_EN_USO`. Tests back y front (error bajo el campo) | ✅ |
| CA-01.3 | Contraseña < 8 o email inválido → error en el campo | Tests: 400 con `details.password/email`; front sin llamar a la API | ✅ |
| CA-01.4 | Contraseña hasheada, nunca expuesta | Test: ninguna respuesta contiene `passwordHash` ni `$2b$`; repo Prisma probado contra `dev` | ✅ |
| CA-02.1 | Login correcto → Mis grupos | Prod: login 200 con token. Test front | ✅ |
| CA-02.2 | Login incorrecto → mensaje genérico | Test: mismo `CREDENCIALES_INVALIDAS` para email inexistente y contraseña errónea | ✅ |
| CA-03.1 | Sigue logueado al recargar | Navegador (local): recarga en `/grupos` mantiene la sesión. Test `session.test.tsx` | ✅ |
| CA-03.2 | Token vencido → login con "Tu sesión expiró" | Tests back (401 `TOKEN_EXPIRADO`) y front (redirige a `?sesion=expirada`, también desde cualquier pedido) | ✅ |
| CA-04.1 | Cerrar sesión borra el token y protege las rutas | Navegador (local): logout → `/ingresar`, token `null`, `/grupos` redirige | ✅ |
| CA-05.1 | Sin sesión, `/grupos` redirige al login | Test `RequireAuth` (recuerda el origen) | ✅ |
| CA-05.2 | API sin token → 401 | Prod: `GET /auth/me` y `GET /grupos` sin token → 401 `NO_AUTENTICADO` | ✅ |
| CA-30.1 | Título y "Crear un grupo gratis" sin scroll a 375 y 1280 px | Navegador: visibles en el primer pantallazo a 390 y 1440 px | ✅ |
| CA-30.2 | La demo recalcula los vales con el redondeo de la spec | Tests `LandingPage.test.tsx` (36.000/4 → 9.000; 100/3 → 33,33) y `money.test.ts` | ✅ |
| CA-30.3 | Con sesión, el botón dice "Ir a mis grupos" | Test `LandingPage.test.tsx` | ✅ |
| CA-30.4 | Lighthouse mobile ≥ 90 en Performance y Accessibility | Prod, después de la carga diferida (bundle 660 → 292 KB), 3 corridas: Performance 96 / 90 / 87 (**mediana 90**), Accessibility 100 en las tres, LCP 2,3–2,6 s. Antes era 89. Queda justo: mejorar en el H5 (precarga de fuentes) | ✅ |
| Extra | Límite de intentos en login/registro | Test: intento 11 → 429 `DEMASIADOS_INTENTOS` | ✅ |
| Extra | Email normalizado (`" Sofi@Mail.com "`) | Test de rutas y navegador | ✅ |
| Extra | Contraseña de 73 caracteres → 400 | Test | ✅ |
| Extra | `localStorage` bloqueado → sesión en memoria | Test `tokenStore` | ✅ |
| Extra | Rama `dev` de Neon separada de producción | `.env.local` → `NEON_BRANCH=dev` | ✅ |
| Extra | Sin secretos en el repo | GitGuardian: falso positivo del ejemplo de `.env.example` (corregido) | ✅ |

## H2 · Grupos y miembros (HU-06 a HU-11)

**Fecha:** 2026-11-23 · **Entorno:** producción (después del merge de los PRs #4 back y #5 front) y local contra `dev`

| ID | Criterio | Evidencia | Estado |
|---|---|---|---|
| CA-06.1 | Crear grupo → admin y detalle | Prod: `POST /grupos` 201. Navegador (local): crea y navega a `/grupos/:id` | ✅ |
| CA-06.2 | Nombre vacío o > 60 → rechazo | Tests back (400) y front (error en el campo sin API) | ✅ |
| CA-07.1 | Veo solo mis grupos | Test service y rutas; prod: el quitado ve `{"grupos":[]}` | ✅ |
| CA-07.2 | Sin grupos → estado vacío con "Crear un grupo" | Navegador (local) y test `GruposPage` | ✅ |
| CA-07.3 | Archivados aparte | Test `GruposPage` (sección "Archivados") y orden del service | ✅ |
| CA-08.1 | Detalle con pestañas | Navegador (local) y test `GrupoPage` | ✅ |
| CA-08.2 | No miembro → "Este grupo no existe o no sos parte" (404) | Prod: ajeno → 404. Test: un refetch 404 descarta la caché (revisión I1) | ✅ |
| CA-09.1 | Admin edita | Prod: PATCH del admin 200. Test front (título sin recargar) | ✅ |
| CA-09.2 | No admin no edita | Prod: PATCH de un miembro → 403 `SOLO_ADMIN`; el botón no se muestra | ✅ |
| CA-10.1 | Agregar por email | Prod: 201 con `"  QA-H2-MIEMBRO-…@iou.test "`. Navegador: "Tomi se sumó al grupo" | ✅ |
| CA-10.2 | Email inexistente → "No existe un usuario con ese email" | Navegador: error bajo el campo. Test back 404 | ✅ |
| CA-10.3 | Ya es miembro → "Ya es miembro del grupo" | Tests back (409, también agregarse a uno mismo) y front | ✅ |
| CA-10.4 | Re-agregar a un quitado lo reactiva sin duplicar (CB-14) | Curl local contra `dev`: 201 `activo: true` y la segunda vez 409 | ✅ |
| CA-11.1 | Quitar con saldo 0 → inactivo, conserva historial | Prod: DELETE 204; local: aparece en "Ya no participan" | ✅ |
| CA-11.2 | Con saldo pendiente → rechazo (CB-09) | Test con `SaldoProvider` de 1 centavo → 409 `SALDO_PENDIENTE` `details.saldo "0.01"` (el saldo real llega en el H4) | ✅ |
| CA-11.3 | El admin no se quita | Test 409 `ADMIN_NO_PUEDE_SALIR`; el botón no existe para el admin | ✅ |
| RF-1 | Un no miembro nunca se entera de que el grupo existe | Prod: 404 en detalle; tests: 404 en todas las rutas `/:id/*` | ✅ |
| RF-2 | Un dado de baja pierde el acceso | Prod: 404 y lista vacía | ✅ |
| RF-3 | Email normalizado al agregar | Prod y navegador | ✅ |
| RF-4 | Grupo archivado → 409 en escrituras | Tests service y rutas (forzado en el repo en memoria; archivar llega en el H4) | ✅ |
| RF-5 | Caché del front al día tras mutaciones | Tests de hooks (invalidación) | ✅ |
| Extra | Límite de altas de miembros (evita enumerar emails) | Test: intento 31 → 429 | ✅ |
| Extra | Errores de estado refrescan la lista (revisión M1) | Tests con 4 códigos | ✅ |
| Extra | Revisión de rama por un revisor nuevo | 0 críticos, 1 importante (corregido); menores pendientes: varias pestañas con distinto usuario, h1 en el error del detalle, mensaje de saldo con nombre, tests del repo Prisma, saldos en lote | ✅ |

**Pendiente del H0:** CA-00.3 (Docker local).
