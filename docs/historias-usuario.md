# Historias de usuario — IOU

> Versión 0.1 · Borrador para validar · Complementa a [spec.md](spec.md) (las reglas RN-xx y los casos CB-xx están definidos ahí).

## Convenciones

- **Formato:** *Como* [rol], *quiero* [acción], *para* [beneficio].
- **Prioridad (MoSCoW):** **M** = Must (obligatoria para entregar) · **S** = Should · **C** = Could (si sobra tiempo).
- **Tamaño:** S (≤ medio día) · M (1 día) · L (2 días o más).
- **Criterios de aceptación:** formato *Dado / Cuando / Entonces*. Cada uno se convierte en al menos un caso del informe de QA.
- **Definición de terminado (DoD)** de cada historia:
  1. El backend valida todas sus reglas, aunque el front ya las valide.
  2. Tiene tests del servicio (reglas de negocio) y del endpoint.
  3. La pantalla maneja los estados de carga, error y vacío.
  4. Está desplegada y probada en producción.

## Mapa de módulos e hitos

| Hito | Módulo | Objetivo | Historias |
|---|---|---|---|
| **H0** | Fundaciones | Esqueleto front + back + DB, desplegado de punta a punta | HU-00 |
| **H1** | Autenticación | Los usuarios pueden registrarse e ingresar | HU-01 a HU-05 |
| **H2** | Grupos y miembros | Crear grupos y armar quién participa | HU-06 a HU-11 |
| **H3** | Gastos | Cargar gastos con los 3 modos de división | HU-12 a HU-18 |
| **H4** | Balances y pagos | Saber quién debe a quién y saldar deudas | HU-19 a HU-25 |
| **H5** | Calidad y entrega | QA, documentación y pulido final | HU-26 a HU-29 |

Cada hito cierra con una **validación tuya**: revisás la app desplegada contra los criterios de aceptación del módulo y aprobás o pedís cambios antes de pasar al siguiente.

---

## H0 · Fundaciones

### HU-00 · Proyecto base desplegado — M · L
*Como* desarrollador, *quiero* el esqueleto del proyecto funcionando en internet, *para* detectar al principio los problemas de deploy (CORS, variables de entorno, conexión a la DB).

**Alcance técnico:**
- Dos repos públicos: `IOU-client` (React + TypeScript + Vite + Tailwind) y `IOU-backend` (Express + TypeScript + Prisma).
- Un `Dockerfile` multi-stage y un `.dockerignore` en cada repo (sin Docker Compose).
- PostgreSQL en Neon, con migraciones versionadas; en local, Postgres con `docker run`.
- `GET /api/health` responde `{ status: "ok", db: "ok" }` (consulta real a la DB).
- El front muestra el estado del back.
- Front en Vercel y back en Render (deploy con Docker); `.env.example` en ambos; `.env` en `.gitignore`.
- Lint y formato configurados en ambos repos.

**Criterios de aceptación:**
- **CA-00.1:** Dada la URL pública del front, cuando la abro, entonces veo "API: ok · DB: ok".
- **CA-00.2:** Dados ambos repos, cuando busco credenciales, entonces no hay ninguna en el código ni en el historial.
- **CA-00.3:** Dado cada repo, cuando sigo las instrucciones `docker build` / `docker run` del README, entonces la app levanta en local sin instalar Node.

---

## H1 · Autenticación

### HU-01 · Registrarme — M · M
*Como* visitante, *quiero* crear una cuenta con nombre, email y contraseña, *para* poder usar la aplicación.
**Reglas:** RN-18.
- **CA-01.1:** Dados datos válidos, cuando me registro, entonces se crea la cuenta y quedo logueado.
- **CA-01.2:** Dado un email ya registrado (aunque cambien mayúsculas y minúsculas), cuando me registro, entonces veo "El email ya está en uso".
- **CA-01.3:** Dada una contraseña de menos de 8 caracteres o un email mal formado, cuando envío el formulario, entonces veo el error en el campo correspondiente y no se crea la cuenta.
- **CA-01.4:** Dada una cuenta creada, cuando miro la DB, entonces la contraseña está hasheada (bcrypt), nunca en texto plano.

### HU-02 · Iniciar sesión — M · S
*Como* usuario registrado, *quiero* ingresar con mi email y contraseña, *para* acceder a mis grupos.
- **CA-02.1:** Dadas credenciales correctas, cuando ingreso, entonces voy a "Mis grupos".
- **CA-02.2:** Dadas credenciales incorrectas, cuando ingreso, entonces veo "Email o contraseña incorrectos", sin revelar cuál de los dos falló.

### HU-03 · Mantener la sesión — M · S
*Como* usuario, *quiero* seguir logueado al recargar la página, *para* no ingresar a cada rato.
- **CA-03.1:** Dado que ingresé, cuando recargo la página, entonces sigo logueado.
- **CA-03.2:** Dado un token vencido o inválido, cuando hago cualquier acción, entonces vuelvo al login con el aviso "Tu sesión expiró".

### HU-04 · Cerrar sesión — M · S
*Como* usuario, *quiero* cerrar sesión, *para* proteger mi cuenta en un dispositivo compartido.
- **CA-04.1:** Dado que estoy logueado, cuando cierro sesión, entonces vuelvo al login y no puedo entrar a rutas protegidas.

### HU-05 · Proteger rutas — M · S
*Como* sistema, *quiero* bloquear el acceso sin autenticación, *para* que nadie vea datos ajenos.
- **CA-05.1:** Dado que no estoy logueado, cuando entro a `/grupos`, entonces me redirige al login.
- **CA-05.2:** Dado un request a la API sin token, cuando llega, entonces responde 401.

---

## H2 · Grupos y miembros

### HU-06 · Crear un grupo — M · S
*Como* usuario, *quiero* crear un grupo con nombre y descripción, *para* empezar a cargar gastos compartidos.
- **CA-06.1:** Dado un nombre válido, cuando creo el grupo, entonces quedo como su ADMIN y veo su detalle.
- **CA-06.2:** Dado un nombre vacío o de más de 60 caracteres, cuando lo envío, entonces se rechaza.

### HU-07 · Ver mis grupos — M · S
*Como* usuario, *quiero* ver la lista de los grupos de los que soy miembro, *para* entrar al que necesito.
- **CA-07.1:** Dado que pertenezco a 2 grupos, cuando entro a "Mis grupos", entonces veo exactamente esos 2.
- **CA-07.2:** Dado que no tengo grupos, cuando entro, entonces veo un estado vacío con el botón "Crear grupo".
- **CA-07.3:** Los grupos archivados se muestran aparte o marcados como tales.

### HU-08 · Ver el detalle de un grupo — M · S
*Como* miembro, *quiero* ver el detalle de un grupo, *para* consultar sus gastos, balances, pagos y miembros.
**Reglas:** RN-16.
- **CA-08.1:** Dado que soy miembro, cuando abro el grupo, entonces veo sus pestañas.
- **CA-08.2:** Dado que no soy miembro, cuando abro la URL del grupo, entonces veo "Grupo no encontrado" (la API responde 404).

### HU-09 · Editar un grupo — S · S
*Como* admin, *quiero* cambiar el nombre y la descripción del grupo, *para* corregirlos.
- **CA-09.1:** Dado que soy admin, cuando edito, entonces se guarda el cambio.
- **CA-09.2:** Dado que no soy admin, entonces no veo la opción, y la API responde 403.

### HU-10 · Agregar un miembro — M · M
*Como* admin, *quiero* agregar a un usuario registrado por su email, *para* que participe de los gastos.
**Reglas:** RN-11 · **Casos borde:** CB-14.
- **CA-10.1:** Dado un email registrado, cuando lo agrego, entonces aparece en la lista de miembros.
- **CA-10.2:** Dado un email no registrado, cuando lo agrego, entonces veo "No existe un usuario con ese email".
- **CA-10.3:** Dado un usuario que ya es miembro activo, cuando lo agrego, entonces veo "Ya es miembro del grupo".
- **CA-10.4:** Dado un usuario que había sido quitado antes, cuando lo agrego, entonces se reactiva y no se duplica.

### HU-11 · Quitar un miembro — M · M
*Como* admin, *quiero* quitar a un miembro, *para* que deje de participar del grupo.
**Reglas:** RN-12, RN-13 · **Casos borde:** CB-09.
- **CA-11.1:** Dado un miembro con balance 0, cuando lo quito, entonces deja de aparecer como activo, y sus gastos históricos se conservan.
- **CA-11.2:** Dado un miembro con balance distinto de 0, cuando intento quitarlo, entonces veo "No se puede quitar: tiene saldo pendiente de $X".
- **CA-11.3:** Dado que soy el admin, cuando intento quitarme a mí mismo, entonces se rechaza.

> Nota: hasta que exista el H4, el balance de todos es 0, así que la validación de CA-11.2 se completa y se prueba en el H4.

---

## H3 · Gastos

### HU-12 · Cargar un gasto en partes iguales — M · M
*Como* miembro, *quiero* registrar un gasto dividido en partes iguales entre los participantes que elija, *para* repartirlo sin hacer cuentas.
**Reglas:** RN-01 a RN-04, RN-07 · **Casos borde:** CB-01 a CB-04, CB-12.
- **CA-12.1:** Dado un gasto de $300 entre A, B y C pagado por A, cuando lo guardo, entonces cada uno tiene una participación de $100.
- **CA-12.2:** Dado un gasto de $100 entre 3, cuando lo guardo, entonces las participaciones son 33,34 / 33,33 / 33,33.
- **CA-12.3:** Dado un monto ≤ 0, con más de 2 decimales, o una fecha futura, cuando lo envío, entonces se rechaza.
- **CA-12.4:** Dado que no elijo ningún participante, cuando lo envío, entonces se rechaza.
- **CA-12.5:** Por defecto, el pagador es el usuario actual y todos los miembros activos vienen seleccionados.

### HU-13 · Cargar un gasto por montos exactos — M · M
*Como* miembro, *quiero* indicar cuánto le corresponde a cada participante, *para* repartir gastos desiguales (por ejemplo, cada uno pidió un plato distinto).
**Reglas:** RN-05 · **Casos borde:** CB-05.
- **CA-13.1:** Dados montos que suman exactamente el total, cuando guardo, entonces se registra.
- **CA-13.2:** Dados montos que no suman el total, cuando escribo, entonces la UI muestra la diferencia en vivo; y si lo envío igual, la API responde 422 con la diferencia.

### HU-14 · Cargar un gasto por porcentajes — S · M
*Como* miembro, *quiero* dividir un gasto por porcentajes, *para* repartos proporcionales (por ejemplo, un alquiler 60/40).
**Reglas:** RN-06 · **Casos borde:** CB-06.
- **CA-14.1:** Dado 60 % / 40 % sobre $1000, cuando guardo, entonces las participaciones son $600 / $400.
- **CA-14.2:** Dados porcentajes que no suman 100, cuando lo envío, entonces se rechaza.
- **CA-14.3:** Dado un reparto que no da centavos exactos, cuando guardo, entonces la suma de las participaciones es exactamente igual al total.

### HU-15 · Ver la lista de gastos — M · S
*Como* miembro, *quiero* ver los gastos del grupo, *para* saber en qué se gastó.
- **CA-15.1:** Dado un grupo con gastos, cuando abro la pestaña, entonces los veo del más reciente al más antiguo, con descripción, quién pagó, monto y fecha.
- **CA-15.2:** Dado un grupo con más de 20 gastos, entonces la lista está paginada.
- **CA-15.3:** Dado un grupo sin gastos, entonces veo un estado vacío con el botón "Agregar gasto".

### HU-16 · Ver el detalle de un gasto — M · S
*Como* miembro, *quiero* ver cómo se dividió un gasto, *para* entender cuánto me tocó.
- **CA-16.1:** Dado un gasto, cuando lo abro, entonces veo el tipo de división y la participación de cada miembro.

### HU-17 · Editar un gasto — M · M
*Como* creador del gasto o admin, *quiero* editarlo, *para* corregir errores.
**Reglas:** RN-08, RN-17.
- **CA-17.1:** Dado que soy su creador o el admin, cuando edito, entonces se guarda y los balances se recalculan.
- **CA-17.2:** Dado que no soy ni su creador ni el admin, entonces no veo la opción, y la API responde 403.
- **CA-17.3:** Dado un gasto con un participante que ya no es miembro activo, cuando intento editarlo, entonces se rechaza con un mensaje claro.

### HU-18 · Eliminar un gasto — M · S
*Como* creador del gasto o admin, *quiero* eliminarlo, *para* borrar un gasto cargado por error.
**Reglas:** RN-08 · **Casos borde:** CB-08.
- **CA-18.1:** Dado que tengo permiso, cuando elimino y confirmo, entonces desaparece y los balances se recalculan.
- **CA-18.2:** Antes de eliminar, la UI pide confirmación.

---

## H4 · Balances y pagos

### HU-19 · Ver los balances del grupo — M · M
*Como* miembro, *quiero* ver cuánto debe o le deben a cada miembro, *para* saber cómo están las cuentas.
**Cálculo:** sección 4.1 de la spec.
- **CA-19.1:** Dado el gasto de CA-12.1, cuando veo los balances, entonces son A +200, B −100 y C −100.
- **CA-19.2:** Dado cualquier conjunto de gastos y pagos, entonces la suma de los balances es 0.
- **CA-19.3:** Los balances positivos se ven en verde ("le deben") y los negativos en rojo ("debe").

### HU-20 · Ver mi balance en "Mis grupos" — S · S
*Como* usuario, *quiero* ver mi balance en cada grupo desde la lista, *para* saber de un vistazo dónde debo.
- **CA-20.1:** Dado que debo $100 en un grupo, cuando veo "Mis grupos", entonces esa tarjeta muestra "Debés $100".

### HU-21 · Ver la liquidación sugerida — M · M
*Como* miembro, *quiero* ver la mínima cantidad de transferencias para saldar todo, *para* no hacer pagos de más.
**Cálculo:** sección 4.4 de la spec · **Casos borde:** CB-13.
- **CA-21.1:** Dados los balances A +200, B −100 y C −100, cuando veo la liquidación, entonces dice: B → A $100 y C → A $100.
- **CA-21.2:** Dado un grupo con n miembros con saldo, entonces se sugieren como máximo n − 1 transferencias.
- **CA-21.3:** Dado que todos tienen balance 0, entonces veo "¡Están todos al día!".

### HU-22 · Registrar un pago — M · M
*Como* miembro, *quiero* registrar que le pagué a otro miembro, *para* que se actualicen los balances.
**Reglas:** RN-07, RN-09, RN-10 · **Casos borde:** CB-07.
- **CA-22.1:** Dado que B debe $100 a A, cuando registro un pago de B → A por $100, entonces ambos quedan en 0.
- **CA-22.2:** Dado un pago mayor que la deuda del que paga o que el crédito del que recibe, cuando lo envío, entonces se rechaza.
- **CA-22.3:** Dado que el que paga y el que recibe son la misma persona, cuando lo envío, entonces se rechaza.
- **CA-22.4:** Desde la liquidación sugerida, el botón "Registrar este pago" precarga quién paga, a quién y el monto.

### HU-23 · Ver el historial de pagos — M · S
*Como* miembro, *quiero* ver los pagos registrados, *para* tener trazabilidad.
- **CA-23.1:** Dado un grupo con pagos, cuando abro la pestaña, entonces los veo con quién pagó, a quién, el monto y la fecha.

### HU-24 · Eliminar un pago — S · S
*Como* creador del pago o admin, *quiero* eliminarlo, *para* corregir un pago cargado por error.
- **CA-24.1:** Dado que tengo permiso, cuando lo elimino y confirmo, entonces los balances se recalculan.
- **CA-24.2:** Dado que no tengo permiso, la API responde 403.

### HU-25 · Archivar un grupo — S · S
*Como* admin, *quiero* archivar un grupo saldado, *para* cerrarlo sin perder su historial.
**Reglas:** RN-14, RN-15.
- **CA-25.1:** Dado que todos tienen balance 0, cuando archivo el grupo, entonces queda en solo lectura.
- **CA-25.2:** Dado que hay saldos pendientes, cuando intento archivarlo, entonces se rechaza con 409.
- **CA-25.3:** Dado un grupo archivado, cuando intento cargar un gasto, un pago o un miembro, entonces se rechaza, y la UI oculta esos botones.

---

## H5 · Calidad y entrega

### HU-26 · Datos de demostración — M · S
*Como* profesora evaluadora, *quiero* un usuario de prueba con grupos y gastos ya cargados, *para* probar la app sin cargar todo desde cero.
- **CA-26.1:** Dado el script de seed, cuando lo corro, entonces se crean 3 usuarios demo y 2 grupos con gastos de los 3 tipos y algún pago.
- **CA-26.2:** Las credenciales del usuario demo figuran en el README.

### HU-27 · Experiencia de uso consistente — M · M
*Como* usuario, *quiero* que la app sea clara y funcione en el celular, *para* usarla cómodamente.
- **CA-27.1:** Todas las pantallas funcionan a 375 px de ancho, sin scroll horizontal.
- **CA-27.2:** Todas las acciones muestran el estado de carga, y los errores de la API se muestran con su mensaje en español.
- **CA-27.3:** Los montos se muestran con formato `$ 1.234,56`.

### HU-28 · Informe de QA — M · M
*Como* evaluadora, *quiero* un registro de las pruebas, *para* verificar la calidad.
- **CA-28.1:** `docs/qa.md` tiene una fila por criterio de aceptación: ID, pasos, resultado esperado, resultado obtenido, estado y fecha.
- **CA-28.2:** Incluye los resultados de los tests automatizados y la prueba manual en producción.

### HU-29 · README y entrega — M · S
*Como* evaluadora, *quiero* un README completo, *para* entender y probar el proyecto.
- **CA-29.1:** El README tiene la descripción, la arquitectura, las URLs del front y del back, las instrucciones para correrlo en local, el usuario demo y el aviso del "cold start" de Render.
- **CA-29.2:** El repo es público y no tiene credenciales.

---

## Fuera del alcance (backlog futuro)

- Invitar por email a personas no registradas.
- Varias monedas por grupo.
- Categorías de gastos y gráficos.
- Adjuntar fotos de tickets.
- Gastos recurrentes.
- Recuperar la contraseña por email.

## Resumen

| Hito | Historias | Must | Should |
|---|---|---|---|
| H0 | 1 | 1 | 0 |
| H1 | 5 | 5 | 0 |
| H2 | 6 | 5 | 1 |
| H3 | 7 | 6 | 1 |
| H4 | 7 | 4 | 3 |
| H5 | 4 | 4 | 0 |
| **Total** | **30** | **25** | **5** |
