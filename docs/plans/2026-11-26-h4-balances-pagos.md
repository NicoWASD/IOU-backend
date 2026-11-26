# H4 · Balances y pagos — Plan de implementación

> **Ejecución liviana (pedido del usuario):** la sesión principal lo hace en orden, sin subagentes ni revisor. Tests mínimos: el dominio (balances y liquidación) y un test de rutas con los códigos de error. La prueba de uso la hace el usuario en la app desplegada.

**Objetivo:** ver balances y la liquidación sugerida, registrar y eliminar pagos, archivar el grupo y mostrar el balance real en "Mis grupos" y en RN-12.

**Spec:** `docs/spec.md` (Pago, 4.1, 4.4, RN-09, RN-10, RN-12, RN-14, RN-15, CB-07, CB-09, CB-13), `docs/api-contract.md` (H4) y HU-19 a HU-25.

## Errores nuevos

| Código | HTTP | `message` |
|---|---|---|
| `MISMO_USUARIO` | 422 | "Quien paga y quien recibe tienen que ser personas distintas" |
| `PARTICIPANTES_INVALIDOS` | 422 | "Quien paga y quien recibe tienen que ser miembros activos del grupo" |
| `PAGO_EXCEDE_DEUDA` | 422 | "El pago no puede superar {maximo}", `details.maximo` |
| `PAGO_NO_ENCONTRADO` | 404 | "Este pago no existe" |
| `SALDOS_PENDIENTES` | 409 | "No se puede archivar: hay saldos pendientes" |

## Back (rama `h4-balances`)

1. Prisma `Pago` (`monto_centavos BigInt`, `fecha Date`) y migración en Neon `dev`.
2. `domain/balances.ts`: `calcularBalances` (spec 4.1) y `liquidar` (greedy 4.4).
3. `BalanceRepository.aportes(grupoId)`: sumas por usuario de pagado, consumido, enviado y recibido (`groupBy` de Prisma). `createSaldoProvider` reemplaza a `ceroSaldos` (RN-12 y `miBalance`).
4. `pago.service` (listar, crear con RN-07, RN-09 y RN-10, eliminar con RN-08) y `balance.service` (balances, liquidación y archivar con RN-14).
5. Rutas: `GET /balances`, `GET /liquidacion`, `GET|POST /pagos`, `DELETE /pagos/:pagoId` y `POST /archivar`.

## Front (rama `h4-balances`)

1. Tipos y hooks (`api/balances.ts`). Toda mutación de gastos o pagos invalida todo lo del grupo.
2. **Pestaña Balances:** un renglón por miembro ("le deben" en verde, "debe" en rojo), los vales sugeridos con "Registrar este pago" (precarga el formulario) y "¡Están todos al día!" cuando está vacía. El admin ve "Archivar grupo" con confirmación.
3. **Pestaña Pagos:** historial, vacío, "Registrar un pago" y eliminar con confirmación.
4. **Formulario de pago** en `HojaODialogo`: quién paga, a quién, monto y fecha; el error de la API aparece en el formulario.
5. "Mis grupos" ya muestra `miBalance`: con el balance real, alcanza.

**Queda para después:** la transacción entre `saldoDe` y `desactivarMiembro` (la carrera es improbable con el volumen del proyecto) y la animación del vale cortado (H5).
