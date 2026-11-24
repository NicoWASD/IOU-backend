import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, registrar } from './helpers/testApp.js';

type U = { token: string; id: string };
let ctx: ReturnType<typeof makeTestApp>;
let sofi: U, tomi: U, juli: U, ajeno: U;
let grupoId: string;

const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
const url = (extra = '') => `/api/grupos/${grupoId}/gastos${extra}`;
const igual = (over: object = {}) => ({
  descripcion: 'Súper',
  monto: '100.00',
  fecha: '2026-06-15',
  pagadoPor: sofi.id,
  tipoDivision: 'IGUAL',
  participantes: [{ usuarioId: sofi.id }, { usuarioId: tomi.id }, { usuarioId: juli.id }],
  ...over,
});
const crear = (body: object, u: U = sofi) => request(ctx.app).post(url()).set(auth(u)).send(body);
const montos = (g: { participaciones: { monto: string }[] }) =>
  g.participaciones.map((p) => p.monto).sort();

beforeEach(async () => {
  ctx = makeTestApp();
  sofi = await registrar(ctx.app, 'Sofía', 'sofi@mail.com');
  tomi = await registrar(ctx.app, 'Tomi', 'tomi@mail.com');
  juli = await registrar(ctx.app, 'Juli', 'juli@mail.com');
  ajeno = await registrar(ctx.app, 'Ajeno', 'ajeno@mail.com');
  const g = await request(ctx.app).post('/api/grupos').set(auth(sofi)).send({ nombre: 'Casa' });
  grupoId = g.body.grupo.id;
  for (const email of ['tomi@mail.com', 'juli@mail.com'])
    await request(ctx.app).post(`/api/grupos/${grupoId}/miembros`).set(auth(sofi)).send({ email });
});

describe('POST /gastos', () => {
  it('201 en partes iguales: 33,34 / 33,33 / 33,33 (CA-12.2)', async () => {
    const res = await crear(igual());
    expect(res.status).toBe(201);
    expect(montos(res.body.gasto)).toEqual(['33.33', '33.33', '33.34']);
    expect(res.body.gasto).toMatchObject({
      monto: '100.00',
      puedeEditar: true,
      miParte: expect.any(String),
    });
  });

  it('201 por montos y por porcentajes (CA-13.1, CA-14.1)', async () => {
    const m = await crear(
      igual({
        tipoDivision: 'MONTOS',
        participantes: [
          { usuarioId: sofi.id, monto: '70' },
          { usuarioId: tomi.id, monto: '30.00' },
        ],
      }),
    );
    expect(m.status).toBe(201);
    const p = await crear(
      igual({
        monto: '1000',
        tipoDivision: 'PORCENTAJE',
        participantes: [
          { usuarioId: sofi.id, porcentaje: '60' },
          { usuarioId: tomi.id, porcentaje: '40' },
        ],
      }),
    );
    expect(p.status).toBe(201);
    expect(p.body.gasto.participaciones).toContainEqual({
      usuario: { id: tomi.id, nombre: 'Tomi' },
      monto: '400.00',
      porcentaje: '40.00',
    });
  });

  it.each([
    ['monto con 3 decimales (CB-12)', { monto: '10.555' }],
    ['monto negativo', { monto: '-5' }],
    ['monto 0', { monto: '0' }],
    ['fecha inválida', { fecha: '2026-02-30' }],
    ['tipo inválido', { tipoDivision: 'OTRO' }],
  ])('400 %s', async (_n, over) => {
    const res = await crear(igual(over));
    expect([res.status, res.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('422 con cada regla de negocio (CA-12.3, CA-12.4)', async () => {
    const casos: [object, string][] = [
      [{ fecha: '2026-06-16' }, 'FECHA_FUTURA'],
      [{ pagadoPor: ajeno.id }, 'PAGADOR_NO_MIEMBRO'],
      [{ participantes: [] }, 'PARTICIPANTES_INVALIDOS'],
      [
        { participantes: [{ usuarioId: sofi.id }, { usuarioId: sofi.id }] },
        'PARTICIPANTES_INVALIDOS',
      ],
      [{ participantes: [{ usuarioId: ajeno.id }] }, 'PARTICIPANTES_INVALIDOS'],
    ];
    for (const [over, code] of casos) {
      const res = await crear(igual(over));
      expect([res.status, res.body.error.code]).toEqual([422, code]);
    }
  });

  it('422 con la diferencia en montos y la suma en porcentajes (CB-05, CB-06)', async () => {
    const m = await crear(
      igual({ tipoDivision: 'MONTOS', participantes: [{ usuarioId: sofi.id, monto: '99.99' }] }),
    );
    expect(m.status).toBe(422);
    expect(m.body.error).toMatchObject({
      code: 'SUMA_PARTICIPACIONES_INVALIDA',
      details: { diferencia: '0.01' },
    });
    const p = await crear(
      igual({
        tipoDivision: 'PORCENTAJE',
        participantes: [
          { usuarioId: sofi.id, porcentaje: '60' },
          { usuarioId: tomi.id, porcentaje: '39.99' },
        ],
      }),
    );
    expect(p.body.error).toMatchObject({
      code: 'SUMA_PORCENTAJES_INVALIDA',
      details: { suma: '99.99' },
    });
  });

  it('404 a quien no es miembro y 409 si el grupo está archivado', async () => {
    expect((await crear(igual(), ajeno)).status).toBe(404);
    ctx.grupos.archivar(grupoId);
    expect((await crear(igual())).body.error.code).toBe('GRUPO_ARCHIVADO');
  });
});

describe('GET, PUT y DELETE', () => {
  it('lista paginada, por fecha desc, con miParte (CA-15.1, CA-15.2)', async () => {
    await crear(igual({ fecha: '2026-06-01', descripcion: 'Viejo' }));
    await crear(igual({ fecha: '2026-06-10', descripcion: 'Nuevo' }));
    const res = await request(ctx.app).get(url('?page=1&pageSize=1')).set(auth(juli));
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      gastos: [{ descripcion: 'Nuevo', miParte: expect.stringMatching(/^33\.3[34]$/) }],
    });
  });

  it('detalle 404 GASTO_NO_ENCONTRADO', async () => {
    const res = await request(ctx.app).get(url('/no-existe')).set(auth(sofi));
    expect([res.status, res.body.error.code]).toEqual([404, 'GASTO_NO_ENCONTRADO']);
  });

  it('403 si no es creador ni admin (CA-17.2); el creador edita (CA-17.1)', async () => {
    const id = (await crear(igual(), tomi)).body.gasto.id;
    expect(
      (
        await request(ctx.app)
          .put(url(`/${id}`))
          .set(auth(juli))
          .send(igual())
      ).status,
    ).toBe(403);
    const visto = await request(ctx.app)
      .get(url(`/${id}`))
      .set(auth(juli));
    expect(visto.body.gasto.puedeEditar).toBe(false);
    const ok = await request(ctx.app)
      .put(url(`/${id}`))
      .set(auth(tomi))
      .send(igual({ monto: '300' }));
    expect(montos(ok.body.gasto)).toEqual(['100.00', '100.00', '100.00']);
  });

  it('409 GASTO_CON_MIEMBRO_INACTIVO (RN-17, CA-17.3)', async () => {
    const id = (await crear(igual())).body.gasto.id;
    await request(ctx.app).delete(`/api/grupos/${grupoId}/miembros/${juli.id}`).set(auth(sofi));
    const res = await request(ctx.app)
      .put(url(`/${id}`))
      .set(auth(sofi))
      .send(igual({ participantes: [{ usuarioId: sofi.id }] }));
    expect([res.status, res.body.error.code]).toEqual([409, 'GASTO_CON_MIEMBRO_INACTIVO']);
  });

  it('el admin elimina un gasto ajeno: 204 y desaparece (CA-18.1)', async () => {
    const id = (await crear(igual(), tomi)).body.gasto.id;
    expect(
      (
        await request(ctx.app)
          .delete(url(`/${id}`))
          .set(auth(juli))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(ctx.app)
          .delete(url(`/${id}`))
          .set(auth(sofi))
      ).status,
    ).toBe(204);
    expect((await request(ctx.app).get(url()).set(auth(sofi))).body.total).toBe(0);
  });
});
