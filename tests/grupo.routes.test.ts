import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, registrar } from './helpers/testApp.js';

let ctx: ReturnType<typeof makeTestApp>;
let sofi: { token: string; id: string };
let tomi: { token: string; id: string };
let ajeno: { token: string; id: string };

const auth = (t: { token: string }) => ({ Authorization: `Bearer ${t.token}` });

const crearGrupo = async (body: object = { nombre: 'Bariloche' }) => {
  const res = await request(ctx.app).post('/api/grupos').set(auth(sofi)).send(body);
  expect(res.status).toBe(201);
  return res.body.grupo as { id: string };
};

beforeEach(async () => {
  ctx = makeTestApp();
  sofi = await registrar(ctx.app, 'Sofía', 'sofi@mail.com');
  tomi = await registrar(ctx.app, 'Tomi', 'tomi@mail.com');
  ajeno = await registrar(ctx.app, 'Ajeno', 'ajeno@mail.com');
});

describe('POST /api/grupos', () => {
  it('201 con el detalle; el creador queda ADMIN (CA-06.1)', async () => {
    const res = await request(ctx.app)
      .post('/api/grupos')
      .set(auth(sofi))
      .send({ nombre: '  Bariloche  ', descripcion: '  Viaje ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      grupo: {
        id: expect.any(String),
        nombre: 'Bariloche',
        descripcion: 'Viaje',
        moneda: 'ARS',
        archivado: false,
        creadoPor: { id: sofi.id, nombre: 'Sofía' },
        miRol: 'ADMIN',
        createdAt: expect.any(String),
        miembros: [
          { id: sofi.id, nombre: 'Sofía', email: 'sofi@mail.com', rol: 'ADMIN', activo: true },
        ],
      },
    });
  });

  it('descripción vacía pasa a ser null', async () => {
    const res = await request(ctx.app)
      .post('/api/grupos')
      .set(auth(sofi))
      .send({ nombre: 'Depto', descripcion: '   ' });
    expect(res.body.grupo.descripcion).toBeNull();
  });

  it('nombre vacío o de más de 60 → 400 con detalle en nombre (CA-06.2)', async () => {
    for (const nombre of ['   ', 'x'.repeat(61), undefined]) {
      const res = await request(ctx.app).post('/api/grupos').set(auth(sofi)).send({ nombre });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.nombre).toBe('Poné un nombre de hasta 60 caracteres');
    }
  });

  it('nombre de exactamente 60 pasa', async () => {
    await crearGrupo({ nombre: 'x'.repeat(60) });
  });

  it('descripción de más de 200 → 400', async () => {
    const res = await request(ctx.app)
      .post('/api/grupos')
      .set(auth(sofi))
      .send({ nombre: 'Depto', descripcion: 'x'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.descripcion).toBeDefined();
  });
});

describe('GET /api/grupos', () => {
  it('200 con mis grupos: activos primero, después archivados (CA-07.1, CA-07.3)', async () => {
    const a = await crearGrupo({ nombre: 'A' });
    await crearGrupo({ nombre: 'B' });
    ctx.grupos.archivar(a.id);
    const res = await request(ctx.app).get('/api/grupos').set(auth(sofi));
    expect(res.status).toBe(200);
    expect(res.body.grupos.map((g: { nombre: string }) => g.nombre)).toEqual(['B', 'A']);
    expect(res.body.grupos[0]).toEqual({
      id: expect.any(String),
      nombre: 'B',
      descripcion: null,
      archivado: false,
      miembros: [{ id: sofi.id, nombre: 'Sofía' }],
      miBalance: '0.00',
    });
  });

  it('un usuario sin grupos recibe una lista vacía (CA-07.2)', async () => {
    await crearGrupo();
    const res = await request(ctx.app).get('/api/grupos').set(auth(ajeno));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ grupos: [] });
  });
});

describe('GET /api/grupos/:id', () => {
  it('200 para un miembro (CA-08.1)', async () => {
    const g = await crearGrupo();
    const res = await request(ctx.app).get(`/api/grupos/${g.id}`).set(auth(sofi));
    expect(res.status).toBe(200);
    expect(res.body.grupo).toMatchObject({ id: g.id, miRol: 'ADMIN' });
  });

  it('404 GRUPO_NO_ENCONTRADO para un id inexistente o que no es UUID (CA-08.2)', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'basura']) {
      const res = await request(ctx.app).get(`/api/grupos/${id}`).set(auth(sofi));
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({
        code: 'GRUPO_NO_ENCONTRADO',
        message: 'Este grupo no existe o no sos parte',
      });
    }
  });
});

describe('PATCH /api/grupos/:id', () => {
  it('200 cuando el admin edita (CA-09.1)', async () => {
    const g = await crearGrupo({ nombre: 'Depto', descripcion: 'Viejo' });
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ nombre: ' Depto Palermo ', descripcion: '' });
    expect(res.status).toBe(200);
    expect(res.body.grupo).toMatchObject({ nombre: 'Depto Palermo', descripcion: null });
  });

  it('acepta descripcion: null para borrarla', async () => {
    const g = await crearGrupo({ nombre: 'Depto', descripcion: 'Viejo' });
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ descripcion: null });
    expect(res.status).toBe(200);
    expect(res.body.grupo).toMatchObject({ nombre: 'Depto', descripcion: null });
  });

  it('con {} devuelve el grupo sin cambios; las claves extra se descartan', async () => {
    const g = await crearGrupo({ nombre: 'Depto', descripcion: 'd' });
    const vacio = await request(ctx.app).patch(`/api/grupos/${g.id}`).set(auth(sofi)).send({});
    expect(vacio.status).toBe(200);
    expect(vacio.body.grupo).toMatchObject({ nombre: 'Depto', descripcion: 'd' });
    const extra = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ archivado: true, moneda: 'USD', creadoPorId: tomi.id });
    expect(extra.status).toBe(200);
    expect(extra.body.grupo).toMatchObject({
      archivado: false,
      moneda: 'ARS',
      creadoPor: { id: sofi.id },
    });
  });

  it('400 con una descripción que no es texto', async () => {
    const g = await crearGrupo();
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ descripcion: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.descripcion).toBeDefined();
  });

  it('un grupo archivado se sigue pudiendo consultar (200, RN-15)', async () => {
    const g = await crearGrupo();
    ctx.grupos.archivar(g.id);
    const res = await request(ctx.app).get(`/api/grupos/${g.id}`).set(auth(sofi));
    expect(res.status).toBe(200);
    expect(res.body.grupo.archivado).toBe(true);
  });

  it('400 con un nombre inválido', async () => {
    const g = await crearGrupo();
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ nombre: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.nombre).toBe('Poné un nombre de hasta 60 caracteres');
  });

  it('403 SOLO_ADMIN para un miembro común (CA-09.2)', async () => {
    const g = await crearGrupo();
    await request(ctx.app)
      .post(`/api/grupos/${g.id}/miembros`)
      .set(auth(sofi))
      .send({ email: 'tomi@mail.com' })
      .expect(201);
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(tomi))
      .send({ nombre: 'Mío' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SOLO_ADMIN');
  });

  it('409 GRUPO_ARCHIVADO aunque sea el admin (Review Focus 4)', async () => {
    const g = await crearGrupo();
    ctx.grupos.archivar(g.id);
    const res = await request(ctx.app)
      .patch(`/api/grupos/${g.id}`)
      .set(auth(sofi))
      .send({ nombre: 'Otro' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GRUPO_ARCHIVADO');
  });
});

describe('miembros', () => {
  let grupoId: string;
  beforeEach(async () => {
    grupoId = (await crearGrupo()).id;
  });

  const agregar = (email: string, quien = sofi) =>
    request(ctx.app).post(`/api/grupos/${grupoId}/miembros`).set(auth(quien)).send({ email });

  it('POST 201 con el miembro; el email se normaliza (CA-10.1, Review Focus 3)', async () => {
    const res = await agregar('  Tomi@Mail.com ');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      miembro: {
        id: tomi.id,
        nombre: 'Tomi',
        email: 'tomi@mail.com',
        rol: 'MIEMBRO',
        activo: true,
      },
    });
  });

  it('POST 400 con un email mal formado', async () => {
    const res = await agregar('no-es-mail');
    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBeDefined();
  });

  it('POST 400 sin email, con un mensaje que habla de la otra persona', async () => {
    const res = await request(ctx.app)
      .post(`/api/grupos/${grupoId}/miembros`)
      .set(auth(sofi))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBe('Ingresá el email de la persona');
  });

  it('un miembro dado de baja recibe 404 también en las rutas de miembros', async () => {
    await agregar('tomi@mail.com').expect(201);
    await agregar('ajeno@mail.com').expect(201);
    await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${tomi.id}`)
      .set(auth(sofi))
      .expect(204);
    const intentos = [
      request(ctx.app).get(`/api/grupos/${grupoId}/miembros`),
      request(ctx.app).post(`/api/grupos/${grupoId}/miembros`).send({ email: 'sofi@mail.com' }),
      request(ctx.app).delete(`/api/grupos/${grupoId}/miembros/${ajeno.id}`),
    ];
    for (const intento of intentos) {
      const res = await intento.set(auth(tomi));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GRUPO_NO_ENCONTRADO');
    }
  });

  it('DELETE de alguien que ya está inactivo → 404 MIEMBRO_NO_ENCONTRADO', async () => {
    await agregar('tomi@mail.com').expect(201);
    const quitar = () =>
      request(ctx.app).delete(`/api/grupos/${grupoId}/miembros/${tomi.id}`).set(auth(sofi));
    await quitar().expect(204);
    const res = await quitar();
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MIEMBRO_NO_ENCONTRADO');
  });

  it('POST 404 USUARIO_NO_ENCONTRADO (CA-10.2)', async () => {
    const res = await agregar('nadie@mail.com');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'USUARIO_NO_ENCONTRADO',
      message: 'No existe un usuario con ese email',
    });
  });

  it('POST 409 YA_ES_MIEMBRO, también para uno mismo (CA-10.3)', async () => {
    await agregar('tomi@mail.com').expect(201);
    for (const email of ['tomi@mail.com', 'sofi@mail.com']) {
      const res = await agregar(email);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('YA_ES_MIEMBRO');
    }
  });

  it('POST 403 SOLO_ADMIN para un miembro común', async () => {
    await agregar('tomi@mail.com').expect(201);
    const res = await agregar('ajeno@mail.com', tomi);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SOLO_ADMIN');
  });

  it('POST 409 GRUPO_ARCHIVADO', async () => {
    ctx.grupos.archivar(grupoId);
    const res = await agregar('tomi@mail.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GRUPO_ARCHIVADO');
  });

  it('DELETE 204 sin body; queda inactivo en GET y vuelve al reagregarlo (CA-11.1, CB-14)', async () => {
    await agregar('tomi@mail.com').expect(201);
    const del = await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${tomi.id}`)
      .set(auth(sofi));
    expect(del.status).toBe(204);
    expect(del.text).toBe('');

    const lista = await request(ctx.app).get(`/api/grupos/${grupoId}/miembros`).set(auth(sofi));
    expect(lista.status).toBe(200);
    expect(lista.body.miembros).toContainEqual({
      id: tomi.id,
      nombre: 'Tomi',
      email: 'tomi@mail.com',
      rol: 'MIEMBRO',
      activo: false,
    });

    // Review Focus 2: el dado de baja pierde el acceso
    await request(ctx.app).get(`/api/grupos/${grupoId}`).set(auth(tomi)).expect(404);
    expect((await request(ctx.app).get('/api/grupos').set(auth(tomi))).body.grupos).toEqual([]);

    const otraVez = await agregar('tomi@mail.com');
    expect(otraVez.status).toBe(201);
    expect(otraVez.body.miembro.activo).toBe(true);
    const despues = await request(ctx.app).get(`/api/grupos/${grupoId}/miembros`).set(auth(sofi));
    expect(despues.body.miembros).toHaveLength(2);
  });

  it('DELETE 409 ADMIN_NO_PUEDE_SALIR (CA-11.3)', async () => {
    const res = await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${sofi.id}`)
      .set(auth(sofi));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADMIN_NO_PUEDE_SALIR');
  });

  it('DELETE 404 MIEMBRO_NO_ENCONTRADO, también con un id que no es UUID', async () => {
    for (const id of [ajeno.id, 'basura']) {
      const res = await request(ctx.app)
        .delete(`/api/grupos/${grupoId}/miembros/${id}`)
        .set(auth(sofi));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MIEMBRO_NO_ENCONTRADO');
    }
  });

  it('DELETE 403 SOLO_ADMIN para un miembro común', async () => {
    await agregar('tomi@mail.com').expect(201);
    const res = await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${sofi.id}`)
      .set(auth(tomi));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SOLO_ADMIN');
  });

  it('DELETE 409 GRUPO_ARCHIVADO', async () => {
    await agregar('tomi@mail.com').expect(201);
    ctx.grupos.archivar(grupoId);
    const res = await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${tomi.id}`)
      .set(auth(sofi));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GRUPO_ARCHIVADO');
  });

  it('DELETE 409 SALDO_PENDIENTE con details.saldo (CA-11.2, CB-09)', async () => {
    ctx = makeTestApp({ saldos: { saldoDe: async () => 1 } });
    sofi = await registrar(ctx.app, 'Sofía', 'sofi@mail.com');
    tomi = await registrar(ctx.app, 'Tomi', 'tomi@mail.com');
    grupoId = (await crearGrupo()).id;
    await agregar('tomi@mail.com').expect(201);
    const res = await request(ctx.app)
      .delete(`/api/grupos/${grupoId}/miembros/${tomi.id}`)
      .set(auth(sofi));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'SALDO_PENDIENTE',
      message: 'No se puede quitar: tiene saldo pendiente de $ 0,01',
      details: { saldo: '0.01' },
    });
  });
});

describe('un usuario ajeno nunca se entera de que el grupo existe (Review Focus 1, RN-16)', () => {
  it('404 GRUPO_NO_ENCONTRADO en todas las rutas /grupos/:id/*', async () => {
    const { id } = await crearGrupo();
    const intentos = [
      request(ctx.app).get(`/api/grupos/${id}`),
      request(ctx.app).patch(`/api/grupos/${id}`).send({ nombre: 'X' }),
      request(ctx.app).get(`/api/grupos/${id}/miembros`),
      request(ctx.app).post(`/api/grupos/${id}/miembros`).send({ email: 'ajeno@mail.com' }),
      request(ctx.app).delete(`/api/grupos/${id}/miembros/${sofi.id}`),
    ];
    for (const intento of intentos) {
      const res = await intento.set(auth(ajeno));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GRUPO_NO_ENCONTRADO');
    }
  });
});

describe('autenticación', () => {
  it('sin token → 401 NO_AUTENTICADO en todas las rutas', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const intentos = [
      request(ctx.app).get('/api/grupos'),
      request(ctx.app).post('/api/grupos').send({ nombre: 'X' }),
      request(ctx.app).get(`/api/grupos/${id}`),
      request(ctx.app).patch(`/api/grupos/${id}`).send({ nombre: 'X' }),
      request(ctx.app).get(`/api/grupos/${id}/miembros`),
      request(ctx.app).post(`/api/grupos/${id}/miembros`).send({ email: 'a@b.com' }),
      request(ctx.app).delete(`/api/grupos/${id}/miembros/${id}`),
    ];
    for (const intento of intentos) {
      const res = await intento;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NO_AUTENTICADO');
    }
  });

  it('ninguna respuesta incluye passwordHash', async () => {
    const creado = await request(ctx.app)
      .post('/api/grupos')
      .set(auth(sofi))
      .send({ nombre: 'Depto' });
    const id = creado.body.grupo.id as string;
    const agregado = await request(ctx.app)
      .post(`/api/grupos/${id}/miembros`)
      .set(auth(sofi))
      .send({ email: 'tomi@mail.com' });
    const editado = await request(ctx.app)
      .patch(`/api/grupos/${id}`)
      .set(auth(sofi))
      .send({ nombre: 'Otro' });
    for (const res of [creado, agregado]) {
      expect(res.status).toBe(201);
      expect(res.text).not.toMatch(/password/i);
    }
    expect(editado.text).not.toMatch(/password/i);
    const respuestas = await Promise.all([
      Promise.resolve(editado),
      request(ctx.app).get('/api/grupos').set(auth(sofi)),
      request(ctx.app).get(`/api/grupos/${id}`).set(auth(sofi)),
      request(ctx.app).get(`/api/grupos/${id}/miembros`).set(auth(sofi)),
    ]);
    for (const res of respuestas) {
      expect(res.status).toBe(200);
      expect(res.text).not.toMatch(/passwordHash|password/i);
    }
  });
});

describe('límite de intentos al agregar miembros', () => {
  it('el intento 31 en la ventana → 429 DEMASIADOS_INTENTOS (evita enumerar emails)', async () => {
    const app = makeTestApp({ rateLimit: true }).app;
    // el registro también tiene límite (10): se registra una sola cuenta
    const admin = await registrar(app, 'Admin', 'admin-rl@mail.com');
    const g = await request(app).post('/api/grupos').set(auth(admin)).send({ nombre: 'Límite' });
    const intento = (i: number) =>
      request(app)
        .post(`/api/grupos/${g.body.grupo.id}/miembros`)
        .set(auth(admin))
        .send({ email: `nadie-${i}@mail.com` });
    for (let i = 0; i < 30; i++) expect((await intento(i)).status).toBe(404);
    const res = await intento(30);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('DEMASIADOS_INTENTOS');
  });
});
