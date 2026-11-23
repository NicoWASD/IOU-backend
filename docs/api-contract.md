# Contrato de API — IOU

> Fuente única para el back y el front. **Se congela al inicio de cada hito**: el back lo implementa, y el front programa contra él con mocks generados de los ejemplos de abajo. Si hay que cambiarlo, se cambia acá primero, en un commit propio, y se avisa a los dos lados.
>
> Reglas de negocio y casos borde: [spec.md](spec.md). Auth (H1): sección 7 de la spec.

## Convenciones

- **Base:** `/api`. Todas las rutas de esta página requieren `Authorization: Bearer <token>`; sin token responden 401 `NO_AUTENTICADO`.
- **Dinero:** siempre como **string decimal con 2 decimales**, por ejemplo `"12500.50"` o `"-100.00"`. Internamente se maneja en centavos enteros; nunca se usa `number` para dinero en el JSON.
- **Fechas:** `YYYY-MM-DD` para las fechas de negocio (la `fecha` de gastos y pagos) e ISO 8601 UTC para los timestamps (`createdAt`).
- **IDs:** UUID en string.
- **Usuario resumido** (`UsuarioRef`): `{ "id": "uuid", "nombre": "Sofía" }`.
- **Errores:** `{ "error": { "code": "CODIGO", "message": "Texto en español", "details"?: {...} } }`.
  - `400 VALIDATION_ERROR` lleva `details: { campo: mensaje }`.
  - Los errores de negocio usan **422** cuando el dato es inválido por una regla y **409** cuando choca con el estado actual.
- **No es miembro del grupo** (RN-16): `404 GRUPO_NO_ENCONTRADO`, igual que si el grupo no existiera.
- **Grupo archivado** (RN-15): cualquier escritura responde `409 GRUPO_ARCHIVADO`.

## Tipos

```ts
type Money = string;                       // "12500.50"
type Rol = 'ADMIN' | 'MIEMBRO';
type TipoDivision = 'IGUAL' | 'MONTOS' | 'PORCENTAJE';
type UsuarioRef = { id: string; nombre: string };

type Miembro = UsuarioRef & { email: string; rol: Rol; activo: boolean };

type GrupoResumen = {
  id: string; nombre: string; descripcion: string | null; archivado: boolean;
  miembros: UsuarioRef[];                  // activos, para los avatares
  miBalance: Money;                        // "0.00" hasta el H4
};

type GrupoDetalle = {
  id: string; nombre: string; descripcion: string | null; moneda: 'ARS'; archivado: boolean;
  creadoPor: UsuarioRef; miRol: Rol; createdAt: string;
  miembros: Miembro[];                     // activos e inactivos
};

type Participacion = { usuario: UsuarioRef; monto: Money; porcentaje: string | null };  // porcentaje "60.00"

type GastoResumen = {
  id: string; descripcion: string; monto: Money; fecha: string; tipoDivision: TipoDivision;
  pagadoPor: UsuarioRef; miParte: Money;   // "0.00" si no participo
};

type GastoDetalle = GastoResumen & {
  creadoPor: UsuarioRef; participaciones: Participacion[];
  puedeEditar: boolean;                    // creador o admin, grupo no archivado, sin miembros inactivos (RN-08, RN-15, RN-17)
  createdAt: string;
};

type Pago = { id: string; de: UsuarioRef; a: UsuarioRef; monto: Money; fecha: string; creadoPor: UsuarioRef; puedeEliminar: boolean };

type Balance = { usuario: UsuarioRef; balance: Money };     // > 0: le deben · < 0: debe
type Transferencia = { de: UsuarioRef; a: UsuarioRef; monto: Money };
```

---

## H2 · Grupos y miembros

| Método y ruta | Body | OK | Errores |
|---|---|---|---|
| `GET /grupos` | — | `200 { grupos: GrupoResumen[] }` (primero los activos, después los archivados; ambos por `createdAt` desc) | — |
| `POST /grupos` | `{ nombre, descripcion? }` | `201 { grupo: GrupoDetalle }` (el creador queda `ADMIN`) | 400 |
| `GET /grupos/:id` | — | `200 { grupo: GrupoDetalle }` | 404 `GRUPO_NO_ENCONTRADO` |
| `PATCH /grupos/:id` | `{ nombre?, descripcion? }` | `200 { grupo: GrupoDetalle }` | 400 · 403 `SOLO_ADMIN` · 404 · 409 `GRUPO_ARCHIVADO` |
| `GET /grupos/:id/miembros` | — | `200 { miembros: Miembro[] }` | 404 |
| `POST /grupos/:id/miembros` | `{ email }` | `201 { miembro: Miembro }` (si estaba inactivo, se reactiva: CB-14) | 400 · 403 `SOLO_ADMIN` · 404 `USUARIO_NO_ENCONTRADO` ("No existe un usuario con ese email") · 409 `YA_ES_MIEMBRO` · 409 `GRUPO_ARCHIVADO` |
| `DELETE /grupos/:id/miembros/:usuarioId` | — | `204` (baja lógica) | 403 `SOLO_ADMIN` · 404 `MIEMBRO_NO_ENCONTRADO` · 409 `SALDO_PENDIENTE` con `details: { saldo: Money }` (RN-12) · 409 `ADMIN_NO_PUEDE_SALIR` (RN-13) · 409 `GRUPO_ARCHIVADO` |

Validación: `nombre` con trim, de 1 a 60 caracteres; `descripcion` con trim, hasta 200 (vacía equivale a `null`); `email` con las reglas del H1.

## H3 · Gastos

| Método y ruta | Body | OK | Errores |
|---|---|---|---|
| `GET /grupos/:id/gastos?page=1&pageSize=20` | — | `200 { gastos: GastoResumen[], page, pageSize, total }` (por `fecha` desc y después `createdAt` desc) | 404 |
| `POST /grupos/:id/gastos` | `NuevoGasto` | `201 { gasto: GastoDetalle }` | ver abajo |
| `GET /grupos/:id/gastos/:gastoId` | — | `200 { gasto: GastoDetalle }` | 404 `GASTO_NO_ENCONTRADO` |
| `PUT /grupos/:id/gastos/:gastoId` | `NuevoGasto` | `200 { gasto: GastoDetalle }` | ídem `POST`, más 403 `SIN_PERMISO` y 409 `GASTO_CON_MIEMBRO_INACTIVO` (RN-17) |
| `DELETE /grupos/:id/gastos/:gastoId` | — | `204` | 403 `SIN_PERMISO` · 404 · 409 `GRUPO_ARCHIVADO` |

```ts
type NuevoGasto = {
  descripcion: string;                     // trim, de 1 a 100
  monto: Money;                            // > 0, hasta 2 decimales, <= "99999999.99"
  fecha: string;                           // YYYY-MM-DD, no futura (zona America/Argentina/Buenos_Aires)
  pagadoPor: string;                       // id de un miembro activo
  tipoDivision: TipoDivision;
  participantes:
    | { usuarioId: string }[]                           // IGUAL
    | { usuarioId: string; monto: Money }[]             // MONTOS
    | { usuarioId: string; porcentaje: string }[];      // PORCENTAJE, "60" o "33.33"
};
```

| Código | HTTP | Regla |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Formato: monto con más de 2 decimales, negativo, fecha mal formada (CB-12) |
| `FECHA_FUTURA` | 422 | RN-07 |
| `PAGADOR_NO_MIEMBRO` | 422 | RN-02 |
| `PARTICIPANTES_INVALIDOS` | 422 | RN-03: vacíos, repetidos o que no son miembros activos |
| `SUMA_PARTICIPACIONES_INVALIDA` | 422 | RN-05, con `details: { diferencia: Money }` (positiva si falta, negativa si sobra) |
| `SUMA_PORCENTAJES_INVALIDA` | 422 | RN-06, con `details: { suma: string }` |
| `SIN_PERMISO` | 403 | RN-08 |
| `GRUPO_ARCHIVADO` | 409 | RN-15 |

## H4 · Balances y pagos

| Método y ruta | Body | OK | Errores |
|---|---|---|---|
| `GET /grupos/:id/balances` | — | `200 { balances: Balance[] }` (todos los miembros, incluidos los inactivos con saldo; la suma da 0) | 404 |
| `GET /grupos/:id/liquidacion` | — | `200 { transferencias: Transferencia[] }` (greedy de la spec 4.4; vacía si están a mano) | 404 |
| `GET /grupos/:id/pagos` | — | `200 { pagos: Pago[] }` (por `fecha` desc) | 404 |
| `POST /grupos/:id/pagos` | `{ de, a, monto, fecha }` | `201 { pago: Pago }` | 400 · 422 `MISMO_USUARIO` (RN-09) · 422 `PARTICIPANTES_INVALIDOS` · 422 `PAGO_EXCEDE_DEUDA` con `details: { maximo: Money }` (RN-10) · 422 `FECHA_FUTURA` · 409 `GRUPO_ARCHIVADO` |
| `DELETE /grupos/:id/pagos/:pagoId` | — | `204` | 403 `SIN_PERMISO` · 404 `PAGO_NO_ENCONTRADO` · 409 `GRUPO_ARCHIVADO` |
| `POST /grupos/:id/archivar` | — | `200 { grupo: GrupoDetalle }` | 403 `SOLO_ADMIN` · 409 `SALDOS_PENDIENTES` (RN-14) · 409 `GRUPO_ARCHIVADO` |

A partir del H4, `GrupoResumen.miBalance` devuelve el balance real, y `DELETE /miembros` aplica RN-12 con el balance real.

## Ejemplos (los usan los mocks del front)

```json
// GET /grupos/:id/balances
{ "balances": [
  { "usuario": { "id": "u1", "nombre": "Vos" },  "balance": "200.00" },
  { "usuario": { "id": "u2", "nombre": "Sofi" }, "balance": "-100.00" },
  { "usuario": { "id": "u3", "nombre": "Tomi" }, "balance": "-100.00" }
] }

// GET /grupos/:id/liquidacion
{ "transferencias": [
  { "de": { "id": "u2", "nombre": "Sofi" }, "a": { "id": "u1", "nombre": "Vos" }, "monto": "100.00" },
  { "de": { "id": "u3", "nombre": "Tomi" }, "a": { "id": "u1", "nombre": "Vos" }, "monto": "100.00" }
] }

// 422 de un gasto por montos que no cierra
{ "error": { "code": "SUMA_PARTICIPACIONES_INVALIDA",
  "message": "Las participaciones suman $ 12.400,50 y el gasto es de $ 12.500,50",
  "details": { "diferencia": "100.00" } } }
```
