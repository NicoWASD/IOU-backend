# Sistema de diseño — IOU

> Versión 0.1 · D0 · Para validar. Lo implementan `IOU-client` (Tailwind v4 + shadcn/ui) y el prototipo de D0.

## 1. Punto de partida

- **Qué es:** una app para que un grupo de amigos (un viaje, el depto compartido, el asado del finde) anote quién pagó qué y sepa, sin hacer cuentas, quién le debe a quién.
- **Para quién:** gente de 18 a 35 años, que la usa desde el celular en el momento ("pagué la nafta, lo anoto ya") y desde la compu para cerrar las cuentas.
- **Tarea principal de la interfaz:** que en **5 segundos** sepas cuánto debés o te deben, y que anotar un gasto lleve **menos de 15 segundos**.

### El concepto: el vale

Un *IOU* es, literalmente, un vale: el papelito donde alguien anota "te debo $5.000" y lo firma. Ese objeto es la identidad de IOU:

- **Cada deuda es un vale:** una tira de papel con el borde troquelado, el monto escrito y quién se lo debe a quién.
- **Saldar es cortar el vale:** cuando registrás un pago, el vale se "arranca" por el troquel. Es **la única animación protagonista** del producto.
- El resto de la interfaz es **silenciosa y ordenada**, como una libreta de cuentas: mucho blanco, números grandes y alineados, nada de decoración.

## 2. Color

La paleta sale de los objetos del vale: papel blanco, tinta de birome azul, y verde y rojo para lo que te deben y lo que debés. El amarillo resaltador se usa solo para "saldado".

| Token | Hex (claro) | Hex (oscuro) | Uso |
|---|---|---|---|
| `paper` | `#F6F7F9` | `#111318` | Fondo de la app |
| `surface` | `#FFFFFF` | `#191C23` | Tarjetas, hojas, vales |
| `graphite` | `#1B1E25` | `#E8EAF0` | Texto principal |
| `pencil` | `#5F6573` | `#A3A9B6` | Texto secundario, metadatos |
| `rule` | `#E2E5EB` | `#2A2E38` | Bordes y separadores |
| `birome` | `#2337C6` | `#8B9BFF` | Color de marca: acciones primarias, links, foco |
| `birome-soft` | `#E8EBFB` | `#1E2447` | Fondos de selección y chips activos |
| `teDeben` | `#0E7A55` | `#4FD1A1` | Balance positivo ("te deben") |
| `debes` | `#C2303B` | `#FF7A84` | Balance negativo ("debés") y acciones destructivas |
| `resaltador` | `#FFE45C` | `#FFE45C` | Solo para el estado "saldado" (subrayado de resaltador) |

**Reglas:**
- Todo par texto/fondo cumple **WCAG AA**: 4,5:1 para texto normal y 3:1 para texto grande o íconos.
- **El verde y el rojo nunca son la única señal.** Siempre van con texto ("Te deben" / "Debés") y signo (+ / −). Así funcionan para personas con daltonismo.
- Sin gradientes ni sombras de color. La única sombra es `0 1px 0 rule` en las tarjetas y una sombra suave en los diálogos.
- **"Saldado" en oscuro:** el resaltador cubre todo el alto del texto y la tinta pasa a `#1B1E25`. Con texto claro sobre la franja amarilla, el contraste era de alrededor de 1,2:1.
- **Montos:** van con cifras proporcionales. Con `tabular-nums`, Schibsted Grotesk separa los puntos y las comas ("$ 380 . 300 , 50"). Para alinear columnas, se alinea a la derecha.
- **Avatares:** 6 tonos neutros sin violeta (`--av1` a `--av6`).
- El modo oscuro está **soportado desde el principio** con los tokens. Sigue la preferencia del sistema y se puede cambiar a mano.

## 3. Tipografía

| Rol | Familia | Por qué |
|---|---|---|
| Interfaz y títulos | **Schibsted Grotesk** (Google Fonts), pesos 400, 500, 700 y 800 | Grotesca con carácter, pensada para lectura rápida en pantalla; no es la de siempre (Inter, Geist). |
| Montos | Schibsted Grotesk con `font-variant-numeric: tabular-nums` | Los números se alinean en columnas, como en una libreta. |
| Firma del vale | **Caveat** (Google Fonts), peso 600 | **Solo** en el nombre "firmado" de los vales de la landing y en el estado vacío. Nunca en la interfaz funcional. |

**Escala** (proporción 1,25, base de 16 px):

| Token | Tamaño / altura de línea | Uso |
|---|---|---|
| `display` | 56 / 60, peso 800, tracking −2 % | Hero de la landing (40/44 en mobile) |
| `h1` | 32 / 38, peso 700 | Título de la pantalla |
| `h2` | 24 / 30, peso 700 | Secciones |
| `amount-xl` | 40 / 44, peso 800, tabular | Balance principal ("Te deben $12.400") |
| `h3` | 18 / 26, peso 600 | Títulos de las tarjetas |
| `body` | 16 / 24, peso 400 | Texto |
| `small` | 14 / 20, peso 400–500 | Metadatos, ayudas |
| `micro` | 12 / 16, peso 500 | Solo fechas en listas densas |

**Reglas:**
- Todo en minúscula de oración (*sentence case*). **Nada de etiquetas en mayúsculas.**
- Líneas de 75 caracteres como máximo (`max-w-prose`).
- No se resalta una sola palabra de un título con otro color o en cursiva.
- Montos: `$ 12.400,50`, siempre con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`. Si no hay centavos, se omiten en las listas y se muestran en el detalle.

## 4. Forma, espacio y estructura

- **Espaciado:** escala de 4 px (`4, 8, 12, 16, 24, 32, 48, 64, 96`).
- **Radios por jerarquía** (no todo con el mismo radio):
  - Diálogos y hojas: `20px`.
  - Tarjetas: `14px`.
  - Inputs y botones: `10px`.
  - Chips y avatares: redondos.
  - **Vales: sin radio, con borde troquelado** (círculos recortados en los extremos, con `mask`).
- **Bordes antes que sombras:** las tarjetas se separan con un borde `rule` de 1 px.
- **Avatares:** iniciales sobre un color asignado de forma estable a cada miembro (6 tonos desaturados, que no compiten con el verde y el rojo). Sirven para identificar a cada uno en las listas sin leer nombres.
- **Íconos:** `lucide-react`, trazo de 1,75 y 20 px.

## 5. Layout

### Landing (`/`)

```
┌──────────────────────────────────────────────────────────────┐
│ IOU                                   Ingresar  [Crear cuenta]│
├──────────────────────────────────────────────────────────────┤
│ Cuentas claras entre amigos.    │   ┌─ demo en vivo ───────┐ │
│ Anotá quién pagó qué. IOU te    │   │ Cena · $36.000       │ │
│ dice quién le debe a quién.     │   │ pagó Sofi · 4 partes │ │
│ [Crear un grupo gratis]         │   │ ┌vale┐ ┌vale┐ ┌vale┐ │ │
│                                 │   │ Tomi→Sofi $9.000 ... │ │
│                                 │   └──────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Así funciona: 1 Armá el grupo · 2 Anotá gastos · 3 Saldá      │  ← la secuencia es real, la numeración se justifica
├──────────────────────────────────────────────────────────────┤
│ El viaje a Bariloche, resuelto: 23 gastos → 3 transferencias  │  ← caso concreto
├──────────────────────────────────────────────────────────────┤
│ Repartos iguales, por montos o por %  │  Sin planillas │ ...  │
├──────────────────────────────────────────────────────────────┤
│ [Crear un grupo gratis]                              footer   │
└──────────────────────────────────────────────────────────────┘
```

- **El hero es una demo interactiva**, no una ilustración: elegís el monto y la cantidad de personas, y los vales se recalculan.
- Texto **alineado a la izquierda**. Hay **un solo momento de animación**: al cargar, los vales caen de a uno.

### App (autenticada)

- **Mobile (< 768 px):** barra superior con el nombre del grupo, y el botón **"+ Gasto"** fijo abajo a la derecha. Las pestañas del grupo (Gastos · Balances · Pagos · Miembros) son un *segmented control* fijo bajo la barra.
- **Desktop (≥ 1024 px):** columna central de 720 px con la lista de gastos y un **panel lateral fijo** con "Cómo están las cuentas": mi balance, los vales pendientes y un botón para saldar. Así los balances se ven sin cambiar de pestaña.

```
Desktop · Detalle del grupo
┌────────┬───────────────────────────────┬──────────────────────┐
│ IOU    │ Bariloche 2026        [+ Gasto]│ Cómo están las cuentas│
│        │ ─────────────────────────────  │ Te deben  $ 12.400    │
│ Grupos │ Hoy                            │ ┌vale┐ Tomi → vos     │
│ · Bari │  🧾 Nafta     pagó vos $ 40.000│ ┌vale┐ Juli → vos     │
│ · Depto│  🧾 Super     pagó Juli $ 8.300│ [Registrar un pago]   │
│        │ Ayer ...                       │                       │
└────────┴───────────────────────────────┴──────────────────────┘
```

## 6. Pantallas

| Ruta | Pantalla | Contenido clave |
|---|---|---|
| `/` | Landing | Hero con demo, cómo funciona, caso, beneficios, CTA |
| `/ingresar`, `/registrarme` | Auth | Una columna de 400 px, un vale decorativo y el link para cambiar de pantalla |
| `/grupos` | Mis grupos | Tarjetas con nombre, miembros (avatares) y **mi balance** en grande con color y texto |
| `/grupos/:id` | Detalle | Gastos agrupados por día, panel de cuentas (desktop) y pestañas (mobile) |
| `/grupos/:id/gastos/nuevo` | Nuevo gasto | **Hoja inferior** en mobile y diálogo en desktop (sección 7.4) |
| `/grupos/:id/balances` | Balances | Una barra por miembro (centrada en 0, verde a la derecha, rojo a la izquierda) y los vales sugeridos |
| `/grupos/:id/pagos` | Pagos | Historial con los vales "cortados" |
| `/grupos/:id/miembros` | Miembros | Lista; el admin ve "Agregar por email" |

## 7. Patrones de UX

### 7.1 Carga: esqueletos, no spinners

- Cada lista y tarjeta tiene un **esqueleto con su misma forma** (mismo alto de fila, avatar redondo, línea de monto a la derecha). Usa el componente `Skeleton` de shadcn con una animación `pulse` suave.
- El esqueleto **aparece recién a los 150 ms**, para evitar el parpadeo en respuestas rápidas, y **se mantiene al menos 300 ms** una vez que aparece.
- Los botones que envían algo muestran un spinner chico **dentro del botón** y el texto cambia al gerundio ("Guardando…"). El botón queda deshabilitado mientras tanto.
- **Cold start de Render:** si la primera carga tarda más de 3 s, debajo del esqueleto aparece *"Despertando el servidor… La primera carga puede tardar hasta un minuto."*, con una barra indeterminada. Nunca se muestra un error antes de los 70 s.
- Con `prefers-reduced-motion`, el pulso del esqueleto se reemplaza por un tono fijo.

### 7.2 Actualizaciones optimistas

Las acciones con resultado predecible (por ejemplo, borrar un gasto) se reflejan al instante, y se deshacen con un aviso si la API falla. Las que dependen de validaciones del servidor (crear un gasto, registrar un pago) esperan la respuesta.

### 7.3 Estados vacíos

Cada vacío es una invitación a hacer algo: un vale en blanco "firmado" con Caveat, una frase y **una sola acción**.

| Dónde | Texto | Acción |
|---|---|---|
| Mis grupos | "Todavía no tenés grupos. Armá uno para el viaje, el depto o el asado." | Crear un grupo |
| Gastos | "Sin gastos todavía. El primero que pague, que lo anote." | Agregar un gasto |
| Balances (todo saldado) | "Están todos a mano." (con el subrayado de resaltador) | — |
| Pagos | "Cuando alguien salde una deuda, va a aparecer acá." | — |

### 7.4 Formulario de gasto (la pantalla más importante)

1. **El monto, primero y grande:** input numérico con teclado decimal en mobile, con foco automático.
2. **Descripción**, con sugerencias rápidas en chips (Super, Nafta, Cena, Alquiler).
3. **"Pagó"**: los avatares de los miembros; por defecto, vos.
4. **"Entre quiénes"**: el control segmentado *Partes iguales · Montos · Porcentajes*, y abajo una fila por miembro:
   - **Iguales:** checkbox y el monto calculado en vivo.
   - **Montos / %:** un input por persona y una **barra de progreso de la suma** ("Faltan $ 1.200" en rojo, "Cierra justo" en verde). El botón Guardar se habilita solo cuando cierra.
5. **Fecha**: por defecto hoy, con atajos "Hoy" y "Ayer".
6. Botón **"Guardar gasto"**. Al guardar, el aviso dice "Gasto guardado", con la opción **Deshacer**.

### 7.5 Errores

- **De campo:** debajo del input, en `debes`, con un ícono. Dice qué pasó y cómo arreglarlo ("El monto tiene que ser mayor a 0").
- **De la API (422/409):** se muestra el `message` de la API en el lugar de la acción. Ejemplo: "No se puede quitar a Tomi: tiene saldo pendiente de $ 3.200".
- **De red:** aviso persistente "No hay conexión con el servidor", con el botón "Reintentar".
- **Pantalla no encontrada o sin permiso:** "Este grupo no existe o no sos parte", con el botón "Ir a mis grupos".
- Los errores no piden perdón ni usan signos de exclamación.

### 7.6 Confirmaciones

Solo para acciones destructivas o difíciles de revertir: eliminar un gasto, quitar un miembro, archivar un grupo. El botón de confirmar repite el verbo ("Eliminar gasto") en `debes`. Lo demás no pide confirmación y ofrece **Deshacer**.

### 7.7 Avisos (toasts)

`sonner`: abajo al centro en mobile y abajo a la derecha en desktop, 4 s. El verbo es el mismo que el de la acción: "Guardar gasto" produce "Gasto guardado".

## 8. Movimiento

- **El protagonista es el corte del vale:** al registrar un pago, el vale se parte por el troquel (las dos mitades se separan 8 px, rotan ±3° y se desvanecen en 400 ms con `ease-out`). Pasa una sola vez y como respuesta a tu acción.
- **El resto es funcional:** las hojas y diálogos entran en 200 ms, las pestañas cambian sin animación y los números del balance se interpolan en 300 ms cuando cambian.
- **Prohibido:** animaciones de entrada en cada sección al hacer scroll, *hover* que levanta tarjetas y efectos *parallax*.
- `prefers-reduced-motion` reemplaza todo por un *fade* de 100 ms.

## 9. Accesibilidad (piso, no extra)

- Todo funciona con teclado. El foco es visible con un anillo de 2 px en `birome` y 2 px de separación.
- Las áreas táctiles miden al menos 44 × 44 px.
- Los esqueletos llevan `aria-busy="true"` en el contenedor y un texto "Cargando gastos" para lectores de pantalla.
- Los montos se leen completos ("Te deben doce mil cuatrocientos pesos"), con `aria-label` en los montos abreviados.
- Las rutas de la SPA mueven el foco al `h1` de la pantalla nueva.
- Formularios: `label` siempre visible (nunca solo *placeholder*) y errores enlazados con `aria-describedby`.

## 10. Voz y textos

- Español rioplatense con voseo, cercano y directo: "Anotá un gasto", "Debés $ 3.200 a Sofi".
- Los botones dicen exactamente qué pasa: "Guardar gasto", "Registrar pago", "Crear grupo" (nunca "Enviar" ni "Aceptar").
- Se habla de personas, no de entidades: "Tomi te debe", nunca "Usuario 5 tiene balance −3200".
- Para lo mismo, la misma palabra en todos lados: **gasto**, **pago**, **grupo**, **saldar**.

## 11. Implementación (IOU-client)

- **Tailwind v4** con los tokens en `@theme` (`--color-paper`, `--color-birome`, etc.) y el modo oscuro con la clase `.dark`.
- **shadcn/ui** (Vite): `button`, `input`, `label`, `dialog`, `drawer` (hoja inferior en mobile), `tabs`, `toggle-group`, `checkbox`, `avatar`, `skeleton`, `sonner`, `dropdown-menu`, `alert-dialog`, `form`, `tooltip`. El tema de shadcn se mapea a los tokens de IOU.
- **Fuentes** con `@fontsource/schibsted-grotesk` y `@fontsource/caveat`, servidas desde el propio sitio (sin pedidos a Google en producción).
- **Componentes propios:**
  - `<Vale>`: borde troquelado y animación de corte.
  - `<Monto>`: formato es-AR, tabular, con color y signo.
  - `<BalanceBar>`
  - `<EstadoVacio>`
  - `<EsqueletoLista>`
  - `<AvisoColdStart>`

## 12. Marca

- **Logo, "el vale cortado":** las letras I, O y U dibujadas a medida, partidas por un corte horizontal en la mitad. La mitad inferior se corre 8 unidades a la derecha y va en `birome`; la superior va en `graphite`.
- **Construcción:** altura 120, trazo 30, espacio entre letras 18, corte de 4 y corrimiento de 8. La O es un anillo perfecto y la U es la O abierta arriba.
- **Archivos:** `IOU-client/public/brand/` (`iou-logo.svg`, `iou-logo-dark.svg`, `iou-logo-mono.svg`, `iou-icon.svg` y `favicon.svg`). Se generan con `node scripts/build-brand.mjs`.
- **Ícono de app:** el logo sobre `birome`, en blanco con la mitad cortada en `resaltador`. **Favicon** (menos de 48 px): solo la O cortada.
- **Reglas:**
  - Aire libre mínimo igual a un trazo en los cuatro lados.
  - El logo completo, desde 64 px de ancho.
  - Nunca cerrar el corte, invertir los colores de las mitades, deformarlo ni rotarlo.
- **En la UI:** `<Logo />` en React, que hereda los tokens del tema. Al registrar el primer pago de un grupo se puede repetir el corte como guiño, sin exagerar el uso.
- Hoja de marca completa: `IOU-client/docs/marca-iou.html`.
