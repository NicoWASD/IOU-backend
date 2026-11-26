/**
 * Datos de demostración (HU-26): 3 usuarios, 2 grupos con gastos de los 3 tipos y pagos.
 * Carga todo por la API, así que pasa por las mismas reglas que la app y sirve para
 * cualquier entorno sin credenciales de la base. Es idempotente: si ya existe, no duplica.
 *
 *   API_URL=https://iou-backend.onrender.com/api npm run db:seed
 *   (sin API_URL usa http://localhost:3000/api)
 */

const API = process.env.API_URL ?? 'http://localhost:3000/api';
// Credenciales públicas a propósito: figuran en el README para la evaluación (CA-26.2)
const PASSWORD = 'demo-iou-2026';
const USUARIOS = [
  { nombre: 'Ana', email: 'ana.demo@iou.test' },
  { nombre: 'Bruno', email: 'bruno.demo@iou.test' },
  { nombre: 'Carla', email: 'carla.demo@iou.test' },
] as const;

type Sesion = { token: string; id: string };

async function api<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await res.text();
  const json = texto ? (JSON.parse(texto) as unknown) : null;
  if (!res.ok)
    throw Object.assign(new Error(`${method} ${path} → ${res.status} ${texto}`), {
      status: res.status,
    });
  return json as T;
}

async function sesion(nombre: string, email: string): Promise<Sesion> {
  type Auth = { token: string; usuario: { id: string } };
  try {
    const r = await api<Auth>('POST', '/auth/register', undefined, {
      nombre,
      email,
      password: PASSWORD,
    });
    return { token: r.token, id: r.usuario.id };
  } catch (err) {
    if ((err as { status?: number }).status !== 409) throw err;
    const r = await api<Auth>('POST', '/auth/login', undefined, { email, password: PASSWORD });
    return { token: r.token, id: r.usuario.id };
  }
}

const hace = (dias: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(
    new Date(Date.now() - dias * 86_400_000),
  );

async function grupo(admin: Sesion, nombre: string, descripcion: string, miembros: string[]) {
  const { grupos } = await api<{ grupos: { id: string; nombre: string }[] }>(
    'GET',
    '/grupos',
    admin.token,
  );
  if (grupos.some((g) => g.nombre === nombre)) {
    console.log(`"${nombre}" ya existe: no se vuelve a cargar`);
    return null;
  }
  const { grupo: g } = await api<{ grupo: { id: string } }>('POST', '/grupos', admin.token, {
    nombre,
    descripcion,
  });
  for (const email of miembros)
    await api('POST', `/grupos/${g.id}/miembros`, admin.token, { email });
  return g.id;
}

/** Salda la mitad de la primera deuda sugerida, para que haya un pago sin dejar todo en 0. */
async function pagoParcial(gid: string, s: Map<string, Sesion>) {
  const { transferencias } = await api<{
    transferencias: { de: { id: string }; a: { id: string }; monto: string }[];
  }>('GET', `/grupos/${gid}/liquidacion`, [...s.values()][0]?.token);
  const t = transferencias[0];
  if (!t) return;
  const deudor = [...s.values()].find((x) => x.id === t.de.id);
  const mitad = (Math.round(Number(t.monto) * 50) / 100).toFixed(2);
  await api('POST', `/grupos/${gid}/pagos`, deudor?.token, {
    de: t.de.id,
    a: t.a.id,
    monto: mitad,
    fecha: hace(1),
  });
}

async function main() {
  console.log(`Sembrando en ${API}`);
  const [ana, bruno, carla] = await Promise.all(USUARIOS.map((u) => sesion(u.nombre, u.email)));
  if (!ana || !bruno || !carla) throw new Error('No se pudieron crear los usuarios');
  const porId = new Map([ana, bruno, carla].map((x) => [x.id, x]));
  const gasto = (gid: string, quien: Sesion, body: object) =>
    api('POST', `/grupos/${gid}/gastos`, quien.token, body);

  const viaje = await grupo(ana, 'Viaje a Bariloche', 'Las vacaciones de invierno', [
    USUARIOS[1].email,
    USUARIOS[2].email,
  ]);
  if (viaje) {
    const todos = [ana, bruno, carla].map((x) => ({ usuarioId: x.id }));
    await gasto(viaje, ana, {
      descripcion: 'Nafta',
      monto: '45000',
      fecha: hace(6),
      pagadoPor: ana.id,
      tipoDivision: 'IGUAL',
      participantes: todos,
    });
    await gasto(viaje, bruno, {
      descripcion: 'Cena en el centro',
      monto: '39500',
      fecha: hace(4),
      pagadoPor: bruno.id,
      tipoDivision: 'MONTOS',
      participantes: [
        { usuarioId: ana.id, monto: '12000' },
        { usuarioId: bruno.id, monto: '18000' },
        { usuarioId: carla.id, monto: '9500' },
      ],
    });
    await gasto(viaje, carla, {
      descripcion: 'Cabaña',
      monto: '180000',
      fecha: hace(3),
      pagadoPor: carla.id,
      tipoDivision: 'PORCENTAJE',
      participantes: [
        { usuarioId: ana.id, porcentaje: '50' },
        { usuarioId: bruno.id, porcentaje: '30' },
        { usuarioId: carla.id, porcentaje: '20' },
      ],
    });
    await gasto(viaje, ana, {
      descripcion: 'Super',
      monto: '23450.50',
      fecha: hace(2),
      pagadoPor: ana.id,
      tipoDivision: 'IGUAL',
      participantes: todos,
    });
    await pagoParcial(viaje, porId);
  }

  const depto = await grupo(bruno, 'Depto compartido', 'Alquiler y servicios', [USUARIOS[0].email]);
  if (depto) {
    await gasto(depto, bruno, {
      descripcion: 'Alquiler',
      monto: '400000',
      fecha: hace(10),
      pagadoPor: bruno.id,
      tipoDivision: 'PORCENTAJE',
      participantes: [
        { usuarioId: bruno.id, porcentaje: '60' },
        { usuarioId: ana.id, porcentaje: '40' },
      ],
    });
    await gasto(depto, ana, {
      descripcion: 'Internet',
      monto: '18900',
      fecha: hace(5),
      pagadoPor: ana.id,
      tipoDivision: 'IGUAL',
      participantes: [{ usuarioId: ana.id }, { usuarioId: bruno.id }],
    });
    await pagoParcial(depto, porId);
  }
  console.log(
    'Listo. Usuarios:',
    USUARIOS.map((u) => u.email).join(', '),
    `· contraseña: ${PASSWORD}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
