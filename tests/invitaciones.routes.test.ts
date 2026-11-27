import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, registrar, unir } from './helpers/testApp.js';

type U = { token: string; id: string };
let ctx: ReturnType<typeof makeTestApp>;
let sofi: U;
let tomi: U;
let ajeno: U;
let gid: string;
const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
const invitar = (u: U, quien = sofi) =>
  request(ctx.app)
    .post(`/api/grupos/${gid}/invitaciones`)
    .set(auth(quien))
    .send({ usuarioId: u.id });

beforeEach(async () => {
  ctx = makeTestApp();
  sofi = await registrar(ctx.app, 'Sofía', 'sofi@mail.com');
  tomi = await registrar(ctx.app, 'Tomi', 'tomi@mail.com');
  ajeno = await registrar(ctx.app, 'Ajeno', 'ajeno@mail.com');
  gid = (await request(ctx.app).post('/api/grupos').set(auth(sofi)).send({ nombre: 'Casa' })).body
    .grupo.id;
});

describe('perfil y @usuario (HU-31, HU-34)', () => {
  it('register guarda el usuario en minúsculas; repetido → 409 USUARIO_EN_USO; inválido → 400', async () => {
    const reg = (usuario: string, email: string) =>
      request(ctx.app).post('/api/auth/register').send({ usuario, email, password: 'secreta123' });
    const ok = await reg('@Ana.Paz', 'ana@mail.com');
    expect(ok.status).toBe(201);
    expect(ok.body.usuario).toMatchObject({ usuario: 'ana.paz', nombre: 'ana.paz' });
    expect((await reg('ana.paz', 'otra@mail.com')).body.error.code).toBe('USUARIO_EN_USO');
    expect((await reg('a b', 'tres@mail.com')).status).toBe(400);
  });

  it('PATCH /auth/me: nombre y apellido pasan a ser el nombre visible (RN-19)', async () => {
    const res = await request(ctx.app)
      .patch('/api/auth/me')
      .set(auth(tomi))
      .send({ nombre: 'Tomás', apellido: 'Paz', tutorialVisto: true });
    expect(res.body.usuario).toMatchObject({
      nombre: 'Tomás Paz',
      nombreReal: 'Tomás',
      apellido: 'Paz',
      tutorialVisto: true,
    });
    await unir(ctx.app, gid, sofi, tomi);
    const g = await request(ctx.app).get(`/api/grupos/${gid}`).set(auth(sofi));
    expect(g.body.grupo.miembros.map((m: { nombre: string }) => m.nombre)).toContain('Tomás Paz');
    // Sin nombre ni apellido vuelve a verse el usuario
    const sin = await request(ctx.app)
      .patch('/api/auth/me')
      .set(auth(tomi))
      .send({ nombre: '', apellido: null });
    expect(sin.body.usuario.nombre).toBe('tomi');
  });
});

describe('buscar (HU-32)', () => {
  it('por prefijo, sin email, sin el actor ni los miembros activos del grupo', async () => {
    const buscar = (q: string) =>
      request(ctx.app).get('/api/usuarios/buscar').query({ q, grupoId: gid }).set(auth(sofi));
    const res = await buscar('TO');
    expect(res.status).toBe(200);
    expect(res.body.usuarios).toEqual([{ id: tomi.id, nombre: 'Tomi', usuario: 'tomi' }]);
    expect(res.text).not.toMatch(/mail\.com/);
    expect((await buscar('so')).body.usuarios).toEqual([]);
    await unir(ctx.app, gid, sofi, tomi);
    expect((await buscar('to')).body.usuarios).toEqual([]);
    expect((await buscar('t')).status).toBe(400);
  });

  it('con un grupo ajeno → 404 (RN-16)', async () => {
    const res = await request(ctx.app)
      .get('/api/usuarios/buscar')
      .query({ q: 'to', grupoId: gid })
      .set(auth(ajeno));
    expect(res.status).toBe(404);
  });
});

describe('invitaciones (HU-32, HU-33, RN-20)', () => {
  it('invitar → pendiente para el invitado; aceptar lo suma al grupo', async () => {
    const inv = await invitar(tomi);
    expect(inv.status).toBe(201);
    expect(inv.body.invitacion).toMatchObject({
      grupo: { id: gid, nombre: 'Casa' },
      invitado: { id: tomi.id, usuario: 'tomi' },
      invitadoPor: { id: sofi.id, nombre: 'Sofía' },
    });
    const mias = await request(ctx.app).get('/api/invitaciones').set(auth(tomi));
    expect(mias.body.invitaciones).toHaveLength(1);
    const id = inv.body.invitacion.id as string;
    // Nadie más puede responderla (CA-33.2)
    expect(
      (await request(ctx.app).post(`/api/invitaciones/${id}/aceptar`).set(auth(ajeno))).status,
    ).toBe(404);
    const ok = await request(ctx.app).post(`/api/invitaciones/${id}/aceptar`).set(auth(tomi));
    expect(ok.body).toEqual({ grupoId: gid });
    await request(ctx.app).get(`/api/grupos/${gid}`).set(auth(tomi)).expect(200);
    // Doble clic: la segunda ya no existe
    expect(
      (await request(ctx.app).post(`/api/invitaciones/${id}/aceptar`).set(auth(tomi))).status,
    ).toBe(404);
  });

  it('409 YA_INVITADO, 409 YA_ES_MIEMBRO, 403 SOLO_ADMIN y 404 con un usuario inexistente', async () => {
    await invitar(tomi).expect(201);
    expect((await invitar(tomi)).body.error.code).toBe('YA_INVITADO');
    expect((await invitar(sofi)).body.error.code).toBe('YA_ES_MIEMBRO');
    await unir(ctx.app, gid, sofi, ajeno);
    expect((await invitar(sofi, ajeno)).body.error.code).toBe('SOLO_ADMIN');
    const res = await invitar({ token: '', id: '00000000-0000-4000-8000-000000000000' });
    expect(res.body.error.code).toBe('USUARIO_NO_ENCONTRADO');
  });

  it('rechazar → 204 y desaparece; el admin cancela y lista las pendientes', async () => {
    const a = (await invitar(tomi)).body.invitacion.id as string;
    await request(ctx.app).post(`/api/invitaciones/${a}/rechazar`).set(auth(tomi)).expect(204);
    expect(
      (await request(ctx.app).get('/api/invitaciones').set(auth(tomi))).body.invitaciones,
    ).toEqual([]);
    const b = (await invitar(tomi)).body.invitacion.id as string;
    const pend = await request(ctx.app).get(`/api/grupos/${gid}/invitaciones`).set(auth(sofi));
    expect(pend.body.invitaciones.map((i: { id: string }) => i.id)).toEqual([b]);
    await request(ctx.app)
      .delete(`/api/grupos/${gid}/invitaciones/${b}`)
      .set(auth(sofi))
      .expect(204);
    const res = await request(ctx.app).post(`/api/invitaciones/${b}/aceptar`).set(auth(tomi));
    expect(res.body.error.code).toBe('INVITACION_NO_ENCONTRADA');
  });

  it('CB-16: aceptar con el grupo archivado → 409 GRUPO_ARCHIVADO', async () => {
    const id = (await invitar(tomi)).body.invitacion.id as string;
    ctx.grupos.archivar(gid);
    const res = await request(ctx.app).post(`/api/invitaciones/${id}/aceptar`).set(auth(tomi));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GRUPO_ARCHIVADO');
  });
});

describe('medios de cobro (HU-35, RN-21, RN-22)', () => {
  const medio = { plataforma: 'MERCADO_PAGO', valor: 'tomi.mp' };
  const guardar = (medios: object[], u = tomi) =>
    request(ctx.app).put('/api/me/medios').set(auth(u)).send({ medios });

  it('guarda en orden; más de 5 → 422 DEMASIADOS_MEDIOS', async () => {
    const res = await guardar([medio, { plataforma: 'BANCO', valor: '0000003100', nota: 'CVU' }]);
    expect(res.body.medios).toEqual([
      { ...medio, nota: null },
      { plataforma: 'BANCO', valor: '0000003100', nota: 'CVU' },
    ]);
    expect((await guardar(Array(6).fill(medio))).body.error.code).toBe('DEMASIADOS_MEDIOS');
    expect((await guardar([{ plataforma: 'X', valor: 'a' }])).status).toBe(400);
  });

  it('los ve quien comparte un grupo activo; el resto recibe 404', async () => {
    await guardar([medio]);
    const ver = (u: U) => request(ctx.app).get(`/api/usuarios/${tomi.id}/medios`).set(auth(u));
    expect((await ver(sofi)).status).toBe(404);
    await unir(ctx.app, gid, sofi, tomi);
    expect((await ver(sofi)).body.medios).toEqual([{ ...medio, nota: null }]);
    expect((await ver(ajeno)).status).toBe(404);
  });
});
