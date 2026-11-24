# Spec — IOU (gastos compartidos)

> Versión 0.1 · Borrador · Nombre: IOU ("I owe you")

## 1. Descripción

**IOU** es una aplicación web para que grupos de personas (amigos de viaje, compañeros de departamento, una pareja) registren los gastos que pagan y vean en todo momento **cuánto pagó cada uno, cuánto le corresponde y quién le debe a quién**. También sugiere la **mínima cantidad de transferencias** para dejar las cuentas en cero y permite registrar esos pagos.

### Problema que resuelve
Cuando varias personas comparten gastos, cada una paga cosas distintas y en montos distintos. Llevar la cuenta a mano es propenso a errores y discusiones. El sistema centraliza los gastos y hace el cálculo automáticamente.

### Usuarios
- **Usuario registrado:** crea grupos, carga gastos y registra pagos.
- **Administrador de grupo:** es el usuario que creó el grupo. Además, gestiona los miembros y puede archivar el grupo.

## 2. Alcance

### Dentro del alcance (MVP)
1. Registro e inicio de sesión (email + contraseña).
2. Crear grupos, editarlos y archivarlos.
3. Agregar y quitar miembros (usuarios ya registrados, buscados por email).
4. Cargar, editar y eliminar gastos con tres modos de división: **partes iguales**, **montos exactos** y **porcentajes**.
5. Ver el balance de cada miembro del grupo.
6. Ver la liquidación sugerida (quién le paga a quién y cuánto).
7. Registrar pagos (liquidaciones) entre miembros.

### Fuera del alcance
- Múltiples monedas o conversión de moneda (cada grupo usa **una sola moneda**).
- Invitaciones por email a personas no registradas.
- Notificaciones, adjuntar comprobantes y gastos recurrentes.
- Integración con medios de pago reales (los pagos se **registran**, no se ejecutan).

## 3. Modelo de datos

```
Usuario 1──* MiembroGrupo *──1 Grupo
Grupo   1──* Gasto 1──* ParticipacionGasto *──1 Usuario
Gasto   *──1 Usuario (pagado_por)
Grupo   1──* Pago  (de_usuario → a_usuario)
```

### Usuario
| Campo | Tipo | Restricciones |
|---|---|---|
| id | UUID / serial | PK |
| nombre | varchar(80) | obligatorio |
| email | varchar(120) | obligatorio, único, formato válido, se guarda en minúsculas |
| password_hash | varchar | bcrypt; nunca se devuelve en la API |
| created_at | timestamp | |

### Grupo
| Campo | Tipo | Restricciones |
|---|---|---|
| id | PK | |
| nombre | varchar(60) | obligatorio |
| descripcion | varchar(200) | opcional |
| moneda | char(3) | por defecto `ARS` |
| creado_por | FK Usuario | |
| archivado | boolean | por defecto `false` |
| created_at | timestamp | |

### MiembroGrupo
| Campo | Tipo | Restricciones |
|---|---|---|
| grupo_id | FK Grupo | PK compuesta con `usuario_id` |
| usuario_id | FK Usuario | |
| rol | enum `ADMIN` \| `MIEMBRO` | |
| activo | boolean | baja lógica (los gastos históricos lo siguen referenciando) |
| fecha_alta | timestamp | |

### Gasto
| Campo | Tipo | Restricciones |
|---|---|---|
| id | PK | |
| grupo_id | FK Grupo | |
| descripcion | varchar(100) | obligatorio |
| monto_centavos | bigint | > 0 (el tope de RN-01 no entra en `integer`) |
| fecha | date | no futura |
| pagado_por | FK Usuario | debe ser miembro activo |
| tipo_division | enum `IGUAL` \| `MONTOS` \| `PORCENTAJE` | |
| creado_por | FK Usuario | |
| created_at / updated_at | timestamp | |

### ParticipacionGasto
| Campo | Tipo | Restricciones |
|---|---|---|
| gasto_id | FK Gasto | PK compuesta con `usuario_id` |
| usuario_id | FK Usuario | |
| monto_centavos | bigint | ≥ 0; la suma de un gasto es igual a `Gasto.monto_centavos` |
| porcentaje | numeric(5,2) | solo si `tipo_division = PORCENTAJE` |

### Pago (liquidación)
| Campo | Tipo | Restricciones |
|---|---|---|
| id | PK | |
| grupo_id | FK Grupo | |
| de_usuario | FK Usuario | quien paga |
| a_usuario | FK Usuario | quien recibe; distinto de `de_usuario` |
| monto_centavos | bigint | > 0 (el tope de RN-01 no entra en `integer`) |
| fecha | date | no futura |
| creado_por | FK Usuario | |
| created_at | timestamp | |

> **Decisión técnica:** el dinero se guarda y se calcula **en centavos (enteros)** para evitar errores de punto flotante. Solo se convierte a decimal al mostrarlo.

## 4. Cálculos

### 4.1 Balance de un miembro
El balance **no se guarda**: se calcula siempre a partir de los gastos y los pagos.

```
balance(u) =   Σ gastos pagados por u
             − Σ participaciones de u
             + Σ pagos enviados por u
             − Σ pagos recibidos por u
```

- `balance > 0` → al usuario **le deben** plata.
- `balance < 0` → el usuario **debe** plata.
- **Invariante:** la suma de los balances de todos los miembros de un grupo es siempre **0**.

### 4.2 Reparto en partes iguales con redondeo
`base = floor(monto / n)` y `resto = monto − base × n` (en centavos).
Los `resto` centavos sobrantes se asignan de a 1 a los primeros participantes, ordenados por id. Así la suma da **exactamente** el total.
*Ejemplo:* $100,00 entre 3 → 3334 + 3333 + 3333 centavos.

### 4.3 Reparto por porcentajes
Cada participante recibe `floor(monto × % / 100)`, y los centavos sobrantes se reparten igual que en 4.2.

### 4.4 Liquidación sugerida (simplificación de deudas)
Algoritmo greedy:
1. Separar a los deudores (balance < 0) de los acreedores (balance > 0).
2. Emparejar al mayor deudor con el mayor acreedor y transferir `min(|deuda|, crédito)`.
3. Actualizar ambos balances y repetir hasta que todos queden en 0.

Resultado: como máximo **n − 1 transferencias** para un grupo de n miembros con saldo.

## 5. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | El monto de un gasto o pago es > 0, tiene como máximo 2 decimales y no supera $99.999.999,99. |
| RN-02 | Quien paga un gasto tiene que ser miembro **activo** del grupo. |
| RN-03 | Un gasto tiene al menos 1 participante, y todos son miembros activos y no están repetidos. |
| RN-04 | En `IGUAL`, el reparto sigue la sección 4.2; el sistema lo calcula, no el cliente. |
| RN-05 | En `MONTOS`, la suma de las participaciones tiene que ser **exactamente** igual al total del gasto. |
| RN-06 | En `PORCENTAJE`, cada porcentaje es > 0 y la suma tiene que ser **exactamente 100**. |
| RN-07 | La fecha de un gasto o pago no puede ser futura. |
| RN-08 | Solo quien creó el gasto o el admin del grupo pueden editarlo o eliminarlo. |
| RN-09 | En un pago, `de_usuario ≠ a_usuario` y ambos son miembros activos. |
| RN-10 | Un pago no puede superar la deuda actual del que paga (`|balance|` si es negativo) ni el crédito actual del que recibe. |
| RN-11 | Solo el admin agrega o quita miembros. Al agregar, el usuario tiene que existir (se busca por email) y no puede ser ya miembro activo. |
| RN-12 | No se puede quitar a un miembro cuyo balance sea ≠ 0. |
| RN-13 | El admin no puede quitarse a sí mismo del grupo. |
| RN-14 | Solo el admin archiva el grupo, y solo si **todos** los balances están en 0. |
| RN-15 | En un grupo archivado no se pueden crear, editar ni eliminar gastos, pagos o miembros (queda en solo lectura). |
| RN-16 | Solo los miembros de un grupo pueden verlo; el resto recibe 403 o 404. |
| RN-17 | No se puede editar un gasto si alguno de sus participantes o su pagador ya no es miembro activo. |
| RN-18 | El email de un usuario es único; la contraseña tiene al menos 8 caracteres. |

## 6. Casos borde

| ID | Caso | Comportamiento esperado |
|---|---|---|
| CB-01 | $100,00 entre 3 personas | 33,34 / 33,33 / 33,33 (suma exacta). |
| CB-02 | $0,01 entre 3 personas | Un participante paga 0,01 y los otros dos 0,00. |
| CB-03 | El pagador no participa del gasto (paga algo que es solo para otros) | Válido: su balance sube por el total. |
| CB-04 | El único participante es el mismo pagador | Válido: el balance no cambia. |
| CB-05 | Montos exactos que suman de más o de menos (aunque sea 1 centavo) | Error 422 que indique la diferencia. |
| CB-06 | Porcentajes que suman 99,99 | Error 422. |
| CB-07 | Pago mayor que la deuda | Error 422 (RN-10). |
| CB-08 | Se elimina un gasto que ya había sido saldado con un pago | Se permite; los balances se recalculan y pueden invertirse. La UI pide confirmación. |
| CB-09 | Se intenta quitar a un miembro que debe $0,01 | Error 409 (RN-12). |
| CB-10 | Un usuario intenta ver el grupo de otro | 404 (no se revela que el grupo existe). |
| CB-11 | Dos personas editan el mismo gasto a la vez | Gana la última escritura (fuera del alcance controlarlo; queda documentado). |
| CB-12 | Monto con más de 2 decimales (`10.555`) o negativo | Error 400. |
| CB-13 | Grupo con un solo miembro | Funciona; la liquidación sugerida queda vacía. |
| CB-14 | Agregar a un miembro que había sido quitado antes | Se reactiva su `MiembroGrupo` (no se duplica). |

## 7. API REST

Base: `/api` · Autenticación: `Authorization: Bearer <JWT>` en todas las rutas salvo `/auth/*`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro |
| POST | `/auth/login` | Login → JWT |
| GET | `/auth/me` | Usuario actual |
| GET | `/grupos` | Mis grupos (con mi balance en cada uno) |
| POST | `/grupos` | Crear grupo (el creador queda como ADMIN) |
| GET | `/grupos/:id` | Detalle |
| PATCH | `/grupos/:id` | Editar nombre o descripción (admin) |
| POST | `/grupos/:id/archivar` | Archivar (RN-14) |
| GET | `/grupos/:id/miembros` | Listar miembros |
| POST | `/grupos/:id/miembros` | Agregar `{ email }` (RN-11) |
| DELETE | `/grupos/:id/miembros/:usuarioId` | Quitar (RN-12, RN-13) |
| GET | `/grupos/:id/gastos` | Listar (paginado, el más reciente primero) |
| POST | `/grupos/:id/gastos` | Crear |
| GET | `/grupos/:id/gastos/:gastoId` | Detalle con participaciones |
| PUT | `/grupos/:id/gastos/:gastoId` | Editar (RN-08, RN-17) |
| DELETE | `/grupos/:id/gastos/:gastoId` | Eliminar (RN-08) |
| GET | `/grupos/:id/pagos` | Listar pagos |
| POST | `/grupos/:id/pagos` | Registrar pago (RN-09, RN-10) |
| DELETE | `/grupos/:id/pagos/:pagoId` | Eliminar pago (quien lo creó o el admin) |
| GET | `/grupos/:id/balances` | Balance por miembro |
| GET | `/grupos/:id/liquidacion` | Transferencias sugeridas (sección 4.4) |

### Ejemplo: crear un gasto
```json
POST /api/grupos/7/gastos
{
  "descripcion": "Supermercado",
  "monto": "12500.50",
  "fecha": "2026-11-18",
  "pagadoPor": 3,
  "tipoDivision": "MONTOS",
  "participantes": [
    { "usuarioId": 3, "monto": "6000.25" },
    { "usuarioId": 5, "monto": "6500.25" }
  ]
}
```

### Autenticación (H1)

| Ruta | Body | Respuesta OK |
|---|---|---|
| `POST /auth/register` | `{ nombre, email, password }` | `201 { token, usuario }` |
| `POST /auth/login` | `{ email, password }` | `200 { token, usuario }` |
| `GET /auth/me` | — (requiere token) | `200 { usuario }` |

- `usuario` es `{ id, nombre, email }` y nunca incluye la contraseña ni su hash.
- **Validación:** el email se guarda con `trim` y en minúsculas (hasta 120 caracteres); la contraseña tiene de 8 a 72 caracteres (72 es el límite de bcrypt); el nombre, de 1 a 80.
- **Token:** JWT HS256, con `sub` igual al id del usuario y vencimiento `JWT_EXPIRES_IN` (7 días por defecto). El front lo manda como `Authorization: Bearer <token>`.
- **Límite de intentos:** 10 cada 15 minutos por IP en `register` y `login`.
- Un login con email inexistente o con contraseña incorrecta devuelve el mismo error, con el mismo tiempo de respuesta.

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Datos inválidos; `details` es `{ campo: mensaje }` |
| 401 | `CREDENCIALES_INVALIDAS` | Email o contraseña incorrectos |
| 401 | `NO_AUTENTICADO` | Falta el token |
| 401 | `TOKEN_INVALIDO` | Token inválido, o su usuario ya no existe |
| 401 | `TOKEN_EXPIRADO` | El token venció |
| 409 | `EMAIL_EN_USO` | El email ya está registrado |
| 429 | `DEMASIADOS_INTENTOS` | Se superó el límite de intentos |

### Formato de error
```json
{ "error": { "code": "SUMA_PARTICIPACIONES_INVALIDA", "message": "Las participaciones suman $12.400,50 y el gasto es de $12.500,50", "details": { "diferencia": "100.00" } } }
```
Códigos HTTP: `400` datos mal formados · `401` sin autenticar · `403` sin permiso · `404` no existe o no es visible · `409` conflicto de estado (RN-12, RN-14) · `422` regla de negocio violada.

## 8. Pantallas

1. **Login / Registro.**
2. **Mis grupos:** tarjetas con el nombre y mi balance en cada grupo (verde: me deben; rojo: debo); botón "Nuevo grupo".
3. **Detalle del grupo**, con pestañas:
   - **Gastos:** lista con descripción, quién pagó, monto y fecha; botón "Agregar gasto".
   - **Balances:** balance de cada miembro y la liquidación sugerida, con un botón "Registrar este pago" que precarga el formulario.
   - **Pagos:** historial de pagos.
   - **Miembros:** lista; el admin puede agregar por email o quitar.
4. **Formulario de gasto:** selector del modo de división; según el modo, muestra checkboxes (IGUAL) o inputs de monto o porcentaje con **la suma en vivo** y aviso si no cierra.
5. **Formulario de pago.**

## 9. Arquitectura propuesta

```
[Frontend SPA]  ──HTTPS/JSON──>  [API REST]  ──SQL──>  [PostgreSQL]
 Vercel/Netlify                   Render                Neon
```

**Backend por capas:**
- `routes/` → define los endpoints.
- `controllers/` → HTTP: leen el request, llaman al servicio y responden.
- `services/` → **reglas de negocio** (RN-xx) y cálculos (sección 4).
- `repositories/` (u ORM) → acceso a datos.
- `middlewares/` → autenticación JWT, manejo centralizado de errores y validación de esquemas.

**Configuración por variables de entorno:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `CORS_ORIGIN` y `PORT` en el back; `VITE_API_URL` (o equivalente) en el front. Se incluye un `.env.example` sin valores reales.

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS v4 · shadcn/ui · lucide-react · sonner · React Router · TanStack Query |
| Diseño | Sistema de diseño en [design.md](design.md) |
| Validación | Zod en el back (fuente de verdad) y en el front (formularios); los esquemas se duplican porque son repos separados |
| Backend | Node.js + Express + TypeScript (API REST) |
| Base de datos | PostgreSQL (Neon) |
| Acceso a datos | Prisma (ORM + migraciones) — *a confirmar* |
| Autenticación | JWT + bcrypt |
| Tests | Vitest + Supertest (back) · Vitest + Testing Library (front) |
| Contenedores | Docker (un `Dockerfile` por repo, sin Docker Compose) |
| Deploy | Vercel (front) · Render con Docker (back) · Neon (DB) |

### Repositorios

Hay dos repos independientes, cada uno con su propio README, `.env.example`, `Dockerfile` y deploy. Se llaman `IOU-client` (front) e `IOU-backend` (API).

```
IOU-backend/                      IOU-client/
├── src/                           ├── src/
│   ├── routes/                    │   ├── api/          (cliente HTTP + hooks de TanStack Query)
│   ├── controllers/               │   ├── components/   (UI reutilizable)
│   ├── services/                  │   ├── features/     (auth, grupos, gastos, balances)
│   ├── repositories/              │   ├── pages/
│   ├── middlewares/               │   ├── schemas/      (Zod de formularios)
│   ├── schemas/   (Zod)           │   ├── lib/          (formato de dinero, utilidades)
│   ├── lib/       (dinero, JWT)   │   └── main.tsx
│   ├── app.ts     (Express)       ├── public/
│   └── server.ts  (arranque)      ├── nginx.conf
├── prisma/                        ├── Dockerfile
│   ├── schema.prisma              ├── .dockerignore
│   ├── migrations/                ├── .env.example
│   └── seed.ts                    └── README.md
├── tests/
├── Dockerfile
├── .dockerignore
├── .env.example
├── README.md
docs/ (en IOU-backend)
├── spec.md
├── historias-usuario.md
└── qa.md
```

> La documentación del proyecto (spec, historias, QA) vive en IOU-backend, y el README de IOU-client enlaza a ella.

### Docker

**API (`IOU-backend/Dockerfile`)**, multi-stage sobre `node:22-alpine`:
1. **deps:** `npm ci`.
2. **build:** `prisma generate` + `tsc`.
3. **runtime:** solo `dist/`, las dependencias de producción y Prisma; usuario no root; `EXPOSE 3000`; `HEALTHCHECK` contra `/api/health`. Al arrancar corre `prisma migrate deploy` y después `node dist/server.js`.

**Web (`IOU-client/Dockerfile`)**, multi-stage:
1. **build:** `node:22-alpine`, `npm ci` y `vite build`. `VITE_API_URL` entra como `ARG` de build, porque Vite incrusta las variables al compilar.
2. **runtime:** `nginx:alpine` sirve `dist/`, con fallback a `index.html` para las rutas de la SPA.

**Uso local sin Compose:** el README de cada repo trae los comandos `docker run`.

```bash
docker network create iou-net
docker run -d --name iou-db --network iou-net -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=app -p 5432:5432 postgres:17-alpine
docker build -t iou-backend . && docker run --name iou-backend --network iou-net --env-file .env -p 3000:3000 iou-backend
docker build -t iou-client --build-arg VITE_API_URL=http://localhost:3000/api . && docker run --name iou-client -p 8080:80 iou-client
```

**En producción:**
- **API:** Render la construye desde su `Dockerfile`.
- **Web:** Vercel la construye en forma nativa (no usa el Dockerfile), así no tiene "cold start" y queda en el free tier. El Dockerfile del front sirve para correrlo en local de forma reproducible y como alternativa de deploy en Render.

### Variables de entorno

| Repo | Variable | Ejemplo |
|---|---|---|
| api | `DATABASE_URL` | URL *pooled* de Neon (host con `-pooler`), la usa la app |
| api | `DATABASE_URL_UNPOOLED` | URL directa de Neon (sin `-pooler`), la usa Prisma para las migraciones |
| api | `JWT_SECRET` | cadena aleatoria larga |
| api | `JWT_EXPIRES_IN` | `7d` |
| api | `CORS_ORIGIN` | `https://iou-client.vercel.app,http://localhost:5173` |
| api | `PORT` | `3000` |
| web | `VITE_API_URL` | `https://iou-backend.onrender.com/api` |

## 10. Criterios de aceptación

Cada criterio se convierte en uno o más casos del Informe de QA.

| ID | Criterio (Dado / Cuando / Entonces) | Reglas |
|---|---|---|
| CA-01 | Dado un usuario nuevo, cuando se registra con un email ya usado, entonces recibe un error y no se crea la cuenta. | RN-18 |
| CA-02 | Dado un grupo con A, B y C, cuando A carga $300 en partes iguales entre los tres, entonces los balances quedan A +200, B −100 y C −100. | RN-04 |
| CA-03 | Dado un gasto de $100 en partes iguales entre 3, cuando se guarda, entonces las participaciones son 33,34 / 33,33 / 33,33. | RN-04, CB-01 |
| CA-04 | Dado un gasto por montos exactos que no suma el total, cuando se envía, entonces el sistema lo rechaza indicando la diferencia. | RN-05 |
| CA-05 | Dado un gasto por porcentajes que suma 90 %, cuando se envía, entonces se rechaza. | RN-06 |
| CA-06 | Dado un gasto con fecha de mañana, cuando se envía, entonces se rechaza. | RN-07 |
| CA-07 | Dado un gasto creado por A, cuando B (que no es admin) intenta editarlo, entonces recibe 403. | RN-08 |
| CA-08 | Dados los balances de CA-02, cuando se pide la liquidación, entonces se sugieren B→A $100 y C→A $100. | 4.4 |
| CA-09 | Dado que B debe $100, cuando registra un pago de $150 a A, entonces se rechaza. | RN-10 |
| CA-10 | Dado que B debe $100, cuando registra un pago de $100 a A, entonces el balance de B queda en 0. | 4.1 |
| CA-11 | Dado un miembro con deuda, cuando el admin intenta quitarlo, entonces se rechaza con 409. | RN-12 |
| CA-12 | Dado un grupo con saldos pendientes, cuando el admin intenta archivarlo, entonces se rechaza. | RN-14 |
| CA-13 | Dado un grupo archivado, cuando alguien intenta cargar un gasto, entonces se rechaza. | RN-15 |
| CA-14 | Dado un usuario ajeno al grupo, cuando pide `/grupos/:id`, entonces recibe 404. | RN-16 |
| CA-15 | Dado cualquier conjunto de gastos y pagos, cuando se piden los balances, entonces la suma de todos da 0. | 4.1 |
