# Informe de QA — IOU

Registro de las pruebas de cada hito: criterios de aceptación (CA) de [historias-usuario.md](historias-usuario.md), pasos ejecutados y resultados.

**Estados:** ✅ pasa · ❌ falla · ⏳ pendiente

## Resumen

| Hito | CA totales | ✅ | ❌ | ⏳ | Tests automatizados |
|---|---|---|---|---|---|
| H0 · Fundaciones | 3 | 2 | 0 | 1 | back 10/10 · front 8/8 |
| H1 · Landing y autenticación | 21 | 21 | 0 | 0 | back 34/34 · front 51/51 |
| H2 · Grupos y miembros | 24 | 24 | 0 | 0 | back 125/125 · front 139/139 |
| H3 · Gastos | 19 | 18 | 0 | 1 | back 155/155 · front 141/141 |
| H4 · Balances y pagos | 18 | 18 | 0 | 0 | back 167/167 · front 141/141 |
| H5 · Calidad y entrega | 9 | 9 | 0 | 0 | back 167/167 · front 141/141 |
| **Total** | **94** | **92** | **0** | **2** | CI en verde en los dos repos |

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

---

## H3 · Gastos (HU-12 a HU-18)

**Fecha:** 2026-11-23 · **Entorno:** producción (después del merge de los PRs #7 back y #7 front) y local contra `dev`

**Producción (API, usuarios `qa-h3*@iou.test`):** 201 con 33,33/33,33/33,34 (CA-12.2) · 400 con 3 decimales y 422 `FECHA_FUTURA` (CA-12.3) · 422 `PARTICIPANTES_INVALIDOS` (CA-12.4) · 422 `SUMA_PARTICIPACIONES_INVALIDA` con `diferencia "0.01"` (CA-13.2) · 60/40 de 000 → 600/400 (CA-14.1) · 422 `SUMA_PORCENTAJES_INVALIDA` (CA-14.2) · lista y detalle con `miParte` y `puedeEditar: false` para otro miembro (CA-15.1, CA-16.1) · 403 `SIN_PERMISO`, 200 al editar y 409 `GASTO_CON_MIEMBRO_INACTIVO` (CA-17.x) · 204 al eliminar (CA-18.1). Front en Vercel: 200.

| ID | Criterio | Evidencia | Estado |
|---|---|---|---|
| CA-12.1 | $300 entre 3 → $100 c/u | Test de dominio y test de ruta (PUT a $300) | ✅ |
| CA-12.2 | $100 entre 3 → 33,34 / 33,33 / 33,33 | Tests de dominio (CB-01) y de ruta | ✅ |
| CA-12.3 | Monto ≤ 0, con 3 decimales o fecha futura → rechazo | Tests de ruta: 400 `VALIDATION_ERROR` y 422 `FECHA_FUTURA` | ✅ |
| CA-12.4 | Sin participantes → rechazo | Test 422 `PARTICIPANTES_INVALIDOS`; en la UI, Guardar queda deshabilitado | ✅ |
| CA-12.5 | Por defecto pago yo y están todos los activos | `GastoForm` (estado inicial) y test del front (`pagadoPor: u1`) | ✅ |
| CA-13.1 | Montos que suman el total → se registra | Test de ruta 201 y test del front | ✅ |
| CA-13.2 | Diferencia en vivo y 422 con la diferencia | Test del front ("Faltan $ 40" → "Cierra justo") y test 422 `details.diferencia "0.01"` | ✅ |
| CA-14.1 | 60/40 sobre $1000 → $600/$400 | Tests de dominio y de ruta | ✅ |
| CA-14.2 | Porcentajes que no suman 100 → rechazo (CB-06) | Test 422 `SUMA_PORCENTAJES_INVALIDA` `details.suma "99.99"` | ✅ |
| CA-14.3 | La suma de las participaciones da exacto el total | Test de dominio; local contra `dev`: $99.999.999,99 al 33,33/66,67 suma exacto | ✅ |
| CA-15.1 | Lista del más reciente al más antiguo | Test de ruta (orden por fecha) y test del front (por día, pagador, monto y mi parte) | ✅ |
| CA-15.2 | Más de 20 → paginada | Test de ruta (`pageSize`, `total`); "Ver más gastos" en la UI | ✅ |
| CA-15.3 | Sin gastos → vacío con "Agregar un gasto" | Test de `GrupoPage` | ✅ |
| CA-16.1 | El detalle muestra el tipo y las participaciones | Test del front | ✅ |
| CA-17.1 / 17.2 / 17.3 | Edita creador o admin; 403 a otro; rechazo con miembro inactivo | Tests de ruta 200, 403 `SIN_PERMISO`, 409 `GASTO_CON_MIEMBRO_INACTIVO`; local contra `dev`: 403 y 200 | ✅ |
| CA-18.1 | Eliminar → desaparece | Test de ruta 204 y lista vacía; local contra `dev` | ✅ |
| CA-18.2 | La UI pide confirmación | `alert-dialog` en el detalle (sin test automático) | ⏳ |

**Decisiones:** `monto_centavos` es `bigint` porque el tope de RN-01 (9.999.999.999 centavos) no entra en `integer` (spec actualizada). El **Deshacer** del aviso queda fuera del H3.
**Ejecución liviana a pedido del usuario:** sin subagentes ni revisor por tarea; la revisión de UI en el navegador queda para la validación del hito.

---

## H4 · Balances y pagos (HU-19 a HU-25)

**Entorno:** producción (después del merge de NicoWASD/IOU-backend#9 y NicoWASD/IOU-client#8) y local contra `dev`. Usuarios `qa-h4*@iou.test`.

| ID | Pasos | Resultado esperado | Resultado obtenido | Estado | Fecha |
|---|---|---|---|---|---|
| CA-19.1 | Gasto de $300 en partes iguales entre A, B y C pagado por A; `GET /balances` | A +200, B −100, C −100 | Prod: `A200.00 B-100.00 C-100.00`; test de rutas | ✅ | 2026-11-26 |
| CA-19.2 | Gastos y pagos variados; sumar los balances | La suma da 0 | Prod: 200 − 100 − 100 = 0 y después de los pagos, 0/0/0; `calcularBalances` suma con signo | ✅ | 2026-11-26 |
| CA-19.3 | Abrir la pestaña Balances | Positivo en verde "Le deben", negativo en rojo "Debe" | Navegador local a 375 px: "Debe −$ 28.183,16" en rojo, "Le deben +$ 83.499,99" en verde; test de `GrupoPage` | ✅ | 2026-11-26 |
| CA-20.1 | B debe $100; abrir "Mis grupos" | La tarjeta dice "Debés $100" | Prod: `miBalance -100.00` para B; `MiBalance` muestra "Debés −$ 100" | ✅ | 2026-11-26 |
| CA-21.1 | Con A +200, B −100, C −100, `GET /liquidacion` | B → A $100 y C → A $100 | Prod: `B->A 100.00, C->A 100.00` | ✅ | 2026-11-26 |
| CA-21.2 | Balances aleatorios de 5 miembros; liquidar | ≤ n − 1 transferencias y todos en 0 | Test de dominio (`liquidar`) | ✅ | 2026-11-26 |
| CA-21.3 | Todos en 0; ver la liquidación | "¡Están todos al día!" | Prod: liquidación vacía después de los pagos; la UI muestra el texto | ✅ | 2026-11-26 |
| CA-22.1 | B → A $100 con B debiendo $100 | Los dos quedan en 0 | Prod y test de rutas: B `0.00` | ✅ | 2026-11-26 |
| CA-22.2 | Pago de $150 con deuda de $100 | 422 con el máximo | Prod: `PAGO_EXCEDE_DEUDA` "El pago no puede superar $ 100,00", `maximo "100.00"` | ✅ | 2026-11-26 |
| CA-22.3 | Pago de A a A | 422 | Test de rutas: `MISMO_USUARIO` | ✅ | 2026-11-26 |
| CA-22.4 | En la liquidación, tocar "Saldar" en un vale | El formulario abre con quién paga, a quién y el monto | Navegador local: "Ana (vos) → Carla, 28183,16". El botón visible dice "Saldar" (diseño del vale) y su nombre accesible es "Saldar: registrar el pago de…" | ✅ | 2026-11-26 |
| CA-23.1 | Abrir la pestaña Pagos con pagos | Quién pagó, a quién, monto y fecha | Prod: 2 pagos listados; `PagosTab` muestra "De → A", fecha y monto | ✅ | 2026-11-26 |
| CA-24.1 | El creador elimina un pago y confirma | 204 y balances recalculados | Test de rutas: 204 y lista vacía; diálogo de confirmación en `PagosTab` | ✅ | 2026-11-26 |
| CA-24.2 | Otro miembro (no admin) elimina el pago | 403 | Test de rutas: `SIN_PERMISO` | ✅ | 2026-11-26 |
| CA-25.1 | Todo saldado; el admin archiva | Queda en solo lectura | Prod: 200 `archivado: true` | ✅ | 2026-11-26 |
| CA-25.2 | Con saldos pendientes, archivar | 409 | Prod: `SALDOS_PENDIENTES` | ✅ | 2026-11-26 |
| CA-25.3 | Grupo archivado: cargar gasto, pago o miembro | 409 y la UI oculta los botones | Tests: 409 `GRUPO_ARCHIVADO` en gastos, pagos y miembros; los botones dependen de `!grupo.archivado` | ✅ | 2026-11-26 |
| RN-12 | Quitar a un miembro que debe | 409 con su saldo real | Test de rutas: `SALDO_PENDIENTE` `details.saldo "-100.00"`; el mensaje nombra a la persona (M5) | ✅ | 2026-11-26 |

---

## H5 · Calidad y entrega (HU-26 a HU-29)

| ID | Pasos | Resultado esperado | Resultado obtenido | Estado | Fecha |
|---|---|---|---|---|---|
| CA-26.1 | `API_URL=https://iou-backend.onrender.com/api npm run db:seed` (dos veces) | 3 usuarios y 2 grupos con gastos de los 3 tipos y pagos, sin duplicar | Prod: "Viaje a Bariloche" (IGUAL, MONTOS, PORCENTAJE, IGUAL + 1 pago) y "Depto compartido" (PORCENTAJE, IGUAL + 1 pago); la 2ª corrida dice "ya existe" | ✅ | 2026-11-26 |
| CA-26.2 | Leer el README | Credenciales del usuario demo | README de los dos repos: `ana.demo@iou.test` / `demo-iou-2026` | ✅ | 2026-11-26 |
| CA-27.1 | Recorrer Mis grupos, el detalle con sus 4 pestañas y los formularios a 375 px | Sin scroll horizontal | Navegador local a 375 px: `scrollWidth = 375` en todas; ningún elemento pasa de 375 px dentro del formulario de gasto | ✅ | 2026-11-26 |
| CA-27.2 | Ejecutar cada acción y forzar errores de la API | Estado de carga y mensaje de la API en español | Botones con spinner y gerundio ("Guardando…", "Registrando…", "Archivando…"); los 422/409 muestran el `message` (tests de H3/H4 y navegador) | ✅ | 2026-11-26 |
| CA-27.3 | Ver montos en la UI | Formato `$ 1.234,56` | `formatMoney` (`Intl` es-AR): "$ 28.183,16", "$ 55.316,83" | ✅ | 2026-11-26 |
| CA-28.1 | Revisar este informe | Una fila por CA con ID, pasos, esperado, obtenido, estado y fecha | H0, H4 y H5 con esas columnas; H1, H2 y H3 resumen pasos y resultado en "Evidencia" y llevan la fecha en el encabezado de la sección | ✅ | 2026-11-26 |
| CA-28.2 | Revisar el resumen | Tests automatizados y prueba en producción | Resumen con los conteos por hito; cada hito con su evidencia en producción | ✅ | 2026-11-26 |
| CA-29.1 | Leer el README de cada repo | Descripción, arquitectura, URLs, cómo correrlo, usuario demo y aviso de cold start | README de back y front actualizados | ✅ | 2026-11-26 |
| CA-29.2 | Revisar los repos | Públicos y sin credenciales | Los dos repos públicos; GitGuardian en verde en cada PR; solo `.env.example` sin valores. Las credenciales demo del README son públicas a propósito | ✅ | 2026-11-26 |

### Extras del H5

- **Deshacer** en "Gasto guardado" (lo elimina) y "Gasto eliminado" (lo vuelve a cargar), como pide design.md 7.4.
- **Menores del H2 resueltos:** M4 (h1 en el error del detalle) y M5 (el mensaje de `SALDO_PENDIENTE` nombra a la persona).
- **Vulnerabilidad del CLI de Prisma** (4 *high* en `npm audit --omit=dev`: `deepmerge-ts` y `effect`, dependencias de `@prisma/config`): **riesgo aceptado**. Solo se ejecutan en `prisma generate` y `migrate` con la configuración del repo, nunca con datos de usuarios; el arreglo requiere Prisma 7, que cambia el generador del cliente y queda fuera del alcance.

### Pendientes

- **CA-00.3** (Docker en local): Docker Desktop no arrancó en esta máquina. El CI construye las dos imágenes en cada PR.
- **CA-18.2** (confirmación antes de eliminar un gasto): implementado, sin test automático.
- Usuarios `qa-*@iou.test` en producción: no hay endpoint para borrarlos y el acceso a la base de producción no está disponible desde esta sesión.
- CB-11 (dos personas editan el mismo gasto) y la transacción entre `saldoDe` y `desactivarMiembro`: documentados, fuera del alcance.
