# Plan maestro H2–H5 · Subagentes coordinados

> Este plan reparte **todas las HU que faltan** (HU-06 a HU-29) en tareas aisladas para subagentes. No reemplaza el plan detallado de cada hito: al arrancar cada hito, `writing-plans` produce su plan (con tests y firmas exactas) a partir de este reparto, y el usuario lo aprueba antes de escribir código, como pide el CLAUDE.md.

## 1. Cómo se coordinan back y front

```
                 ┌──────────────────────────┐
                 │ docs/api-contract.md     │  ← se congela al inicio del hito (commit propio)
                 └────────────┬─────────────┘
          ┌───────────────────┴───────────────────┐
   IOU-backend · rama hN-…                  IOU-client · rama hN-…
   subagentes BACK (en serie)               subagentes FRONT (en serie)
   implementan el contrato con TDD          programan contra el contrato con
   (service → repo → rutas)                 mocks armados con sus ejemplos
          └───────────────────┬───────────────────┘
                 ┌────────────┴─────────────┐
                 │ Integración (yo)          │  ← los dos corriendo contra Neon dev,
                 │ + revisión de rama        │     prueba en el navegador, deploy y QA
                 └──────────────────────────┘
```

1. **Contrato primero.** El contrato (`api-contract.md`) define rutas, bodies, respuestas, tipos y códigos de error. Ni el back ni el front lo cambian por su cuenta: si un subagente encuentra un problema, se detiene y lo reporta, y el cambio entra al contrato en un commit propio, avisando a los dos lados.
2. **Back y front en paralelo, cada uno en su repo.** Como son repos distintos, no se pisan. Dentro de cada repo, las tareas van **en serie**, porque comparten archivos (schema de Prisma, `app.ts`, `router.tsx`).
3. **El front no espera al back.** Usa `mockApi` (`src/test/utils.tsx`) con fixtures sacadas de los ejemplos del contrato (`src/test/fixtures/<hito>.ts`). Los tipos del contrato se copian a `src/api/types.ts`.
4. **Cada tarea, con revisión.** Se ejecuta con la skill `subagent-driven-development`: un subagente implementador con contexto limpio por tarea y un **subagente revisor** que la aprueba o la devuelve antes de la siguiente. Al final del hito, `requesting-code-review` revisa la rama completa.
5. **Integración y cierre (en esta sesión).** Levanto back y front contra la rama `dev` de Neon y recorro cada CA en el navegador. Después vienen el PR con el CI en verde, el merge (con tu OK), la verificación en producción, `qa.md` y **tu validación del hito**.

### Reglas que recibe cada subagente (en su brief)

- **Su alcance:** las HU y RN de su tarea, los archivos que puede tocar y los que no, y las interfaces que consume y produce.
- **Fuentes:** el CLAUDE.md, el contrato, la spec, design.md (en el front) y el plan del hito.
- **Forma de trabajo:** TDD (el test falla y después pasa), dinero en centavos, capas del back y errores con el formato del contrato.
- **Prohibido:** hacer push o PR, tocar el otro repo, cambiar el contrato o modificar `.claude/`.
- **Entrega:** commits con conventional commits y la salida de tests, lint, typecheck y build.

## 2. Reparto por hito

**B** = tarea de back · **F** = tarea de front · **I** = integración (esta sesión).

### H2 · Grupos y miembros (HU-06 a HU-11)

| # | Tarea | HU / RN | Depende de |
|---|---|---|---|
| B1 | Prisma: `Grupo` y `MiembroGrupo` (PK compuesta, `rol`, `activo`), con su migración en `dev` | — | contrato |
| B2 | `grupo.service`: crear (el creador queda ADMIN), listar los míos, detalle, editar (solo admin), con un repositorio en memoria para los tests | HU-06 a 09 · RN-16 | B1 |
| B3 | `miembro.service`: agregar por email, reactivar, quitar (baja lógica), no quitarse siendo admin. RN-12 se apoya en una interfaz `SaldoProvider` que devuelve 0 hasta el H4 | HU-10, 11 · RN-11 a 13 · CB-14 | B2 |
| B4 | Rutas y middleware `cargarMembresia` (404 si no es miembro, `res.locals.rol`), `requireAdmin`, `rechazarSiArchivado`. Tests de endpoint por cada código del contrato | todas | B2, B3 |
| F1 | `src/api/types.ts`, hooks de TanStack Query (`useGrupos`, `useGrupo`, `useCrearGrupo`, `useMiembros`, …) y fixtures H2 | — | contrato |
| F2 | **Mis grupos:** tarjetas con avatares, esqueleto, vacío y error con reintentar. Diálogo "Crear grupo" (shadcn `dialog` en desktop, `drawer` en mobile) | HU-06, 07 | F1 |
| F3 | **Detalle del grupo:** shell con pestañas (mobile) y columna más panel lateral (desktop), 404 "Este grupo no existe o no sos parte", editar nombre y descripción si soy admin | HU-08, 09 | F1 |
| F4 | **Pestaña Miembros:** lista, agregar por email (con los errores del contrato debajo del campo) y quitar con confirmación | HU-10, 11 | F3 |
| I | Integración, revisión de rama, deploy y QA H2 | — | B4, F4 |

### H3 · Gastos (HU-12 a HU-18)

| # | Tarea | HU / RN | Depende de |
|---|---|---|---|
| B1 | Prisma: `Gasto` y `ParticipacionGasto` (centavos en `Int`, `porcentaje` en `Decimal(5,2)`) | — | H2 |
| B2 | **Dominio puro** `domain/reparto.ts`: `splitEqual`, `splitPct`, `validarMontos` y `parseMoney`/`formatMoney`, con tests de tabla de CB-01 a CB-06 y propiedades (la suma siempre da el total) | RN-01, 04 a 06 | — |
| B3 | `gasto.service`: crear, listar paginado, detalle con `puedeEditar`, editar y eliminar | RN-02, 03, 07, 08, 15, 17 | B1, B2 |
| B4 | Rutas y tests de endpoint por cada código de error del contrato | todas | B3 |
| F1 | Hooks de gastos, fixtures H3 y `money.ts` alineado con el dominio del back (los mismos casos de tabla) | — | contrato |
| F2 | **Pestaña Gastos:** lista agrupada por día, paginación, esqueleto, vacío y detalle de un gasto | HU-15, 16 | F1 |
| F3 | **Formulario de gasto** (la pantalla más importante, design.md 7.4): monto primero, chips de descripción, pagador con avatares, 3 modos con la suma en vivo, fecha con "Hoy/Ayer", hoja en mobile y diálogo en desktop | HU-12 a 14 | F1 |
| F4 | Editar (el mismo formulario precargado) y eliminar con confirmación, más el aviso "Gasto guardado / eliminado" con **Deshacer** | HU-17, 18 | F2, F3 |
| I | Integración, revisión, deploy y QA H3 | — | B4, F4 |

### H4 · Balances y pagos (HU-19 a HU-25)

| # | Tarea | HU / RN | Depende de |
|---|---|---|---|
| B1 | Prisma: `Pago` | — | H3 |
| B2 | **Dominio puro** `domain/balances.ts`: `calcularBalances` (spec 4.1) y `liquidar` (greedy 4.4). Tests de la invariante (la suma da 0), de CA-21.2 (n − 1 transferencias como máximo) y de casos aleatorios | RN-14 · CA-19.2 | — |
| B3 | `balance.service` y `pago.service` (registrar con el tope de RN-10, eliminar) y `archivar` (RN-14). Reemplaza `SaldoProvider` por el real (RN-12) y `miBalance` en el listado | HU-19 a 25 · RN-09, 10, 12, 14, 15 | B1, B2 |
| B4 | Rutas y tests de endpoint | todas | B3 |
| F1 | Hooks y fixtures H4. Componentes `<Monto>` (signo, color y texto) y `<BalanceBar>` | — | contrato |
| F2 | **Pestaña Balances** y **panel "Cómo están las cuentas"**: vales sugeridos, "Saldar" que precarga el pago, y la animación de corte del vale (skill `animate`) | HU-19, 21, 22 | F1 |
| F3 | **Formulario de pago** con el tope visible y la **pestaña Pagos** (historial y eliminar) | HU-22 a 24 | F1 |
| F4 | **Archivar** (confirmación y modo solo lectura en toda la UI) y **mi balance en Mis grupos** | HU-20, 25 | F2 |
| I | Integración, revisión, deploy y QA H4 | — | B4, F4 |

### H5 · Calidad y entrega (HU-26 a HU-29)

| # | Tarea | HU | En paralelo |
|---|---|---|---|
| B1 | Seed de demo (`prisma/seed.ts`: 3 usuarios, 2 grupos con gastos de los 3 tipos y pagos) y su script `db:seed` para `dev` y producción | HU-26 | sí |
| B2 | Decisión sobre la vulnerabilidad de la CLI de Prisma (subir a Prisma 7 o justificarla) y revisión de seguridad (`security-review`) | — | sí |
| F1 | Auditoría de UI con `impeccable` (audit/critique) y `web-design-guidelines` en todas las pantallas, a 375 y 1280 px, en claro y oscuro | HU-27 | sí |
| F2 | Auditoría de movimiento con `improve-animations` y `review-animations`, con la aplicación de los arreglos prioritarios | HU-27 | después de F1 |
| I | Lighthouse (CA-30.4), CA-00.3 con Docker, `qa.md` completo, README final y revisión de las dos ramas | HU-28, 29 | — |

## 3. Paralelismo real

- **Dentro de un hito:** la línea B y la línea F corren **al mismo tiempo**, cada una con su subagente. En H3 y H4, las tareas de dominio puro (B2) pueden arrancar en paralelo con B1.
- **Entre hitos:** van en serie. Cada uno depende del anterior y de **tu validación**.
- **Costo:** cada tarea consume un subagente implementador y uno revisor. Son unas 30 tareas en total, así que el H5 se puede hacer con menos revisores si querés ahorrar.

## 4. Diseño de cada pantalla

Antes de cada tarea F de una pantalla nueva, el subagente aplica `impeccable` en su modo *shape* sobre design.md y el prototipo para definir la composición, y `emil-design-eng` para las interacciones. Si una pantalla necesita un patrón que design.md no tiene, se agrega ahí primero.
