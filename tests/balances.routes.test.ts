import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { liquidar } from '../src/domain/balances.js';
import { makeTestApp, registrar, unir } from './helpers/testApp.js';

type U = { token: string; id: string };
let ctx: ReturnType<typeof makeTestApp>;
let a: U, b: U, c: U;
let gid: string;
const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });
const get = (p: string, u: U = a) => request(ctx.app).get(`/api/grupos/${gid}${p}`).set(auth(u));
const post = (p: string, body: object, u: U = a) =>
  request(ctx.app).post(`/api/grupos/${gid}${p}`).set(auth(u)).send(body);
const pago = (over: object = {}) => ({
  de: b.id,
  a: a.id,
  monto: '100',
  fecha: '2026-06-15',
  ...over,
});

beforeEach(async () => {
  ctx = makeTestApp();
  a = await registrar(ctx.app, 'A', 'a@mail.com');
  b = await registrar(ctx.app, 'B', 'b@mail.com');
  c = await registrar(ctx.app, 'C', 'c@mail.com');
  gid = (await request(ctx.app).post('/api/grupos').set(auth(a)).send({ nombre: 'G' })).body.grupo
    .id;
  for (const u of [b, c]) await unir(ctx.app, gid, a, u);
  // CA-12.1: $300 entre A, B y C, pagado por A
  await post('/gastos', {
    descripcion: 'Super',
    monto: '300',
    fecha: '2026-06-15',
    pagadoPor: a.id,
    tipoDivision: 'IGUAL',
    participantes: [a, b, c].map((u) => ({ usuarioId: u.id })),
  });
});

const saldos = async () =>
  Object.fromEntries(
    (
      (await get('/balances')).body.balances as { usuario: { nombre: string }; balance: string }[]
    ).map((x) => [x.usuario.nombre, x.balance]),
  );

describe('balances y liquidación', () => {
  it('A +200, B −100, C −100 (CA-19.1) y B → A, C → A $100 (CA-21.1)', async () => {
    expect(await saldos()).toEqual({ A: '200.00', B: '-100.00', C: '-100.00' });
    const t = (await get('/liquidacion')).body.transferencias;
    expect(t).toEqual(
      [
        { de: { id: b.id, nombre: 'B' }, a: { id: a.id, nombre: 'A' }, monto: '100.00' },
        { de: { id: c.id, nombre: 'C' }, a: { id: a.id, nombre: 'A' }, monto: '100.00' },
      ].sort((x, y) => (x.de.id < y.de.id ? -1 : 1)),
    );
    expect((await request(ctx.app).get('/api/grupos').set(auth(b))).body.grupos[0].miBalance).toBe(
      '-100.00',
    ); // CA-20.1
  });

  it('liquidar: como máximo n − 1 transferencias y todos quedan en 0 (CA-21.2)', () => {
    const bal = new Map([
      ['a', 500],
      ['b', -120],
      ['c', -80],
      ['d', -300],
      ['e', 0],
    ]);
    const t = liquidar(bal);
    expect(t.length).toBeLessThanOrEqual(3);
    for (const { de, a: hacia, monto } of t) {
      bal.set(de, (bal.get(de) ?? 0) + monto);
      bal.set(hacia, (bal.get(hacia) ?? 0) - monto);
    }
    expect([...bal.values()].every((x) => x === 0)).toBe(true);
  });
});

describe('pagos', () => {
  it('B → A $100 deja a B en 0 (CA-22.1); un 2º pago excede (CA-22.2)', async () => {
    const res = await post('/pagos', pago(), b);
    expect(res.status).toBe(201);
    expect(res.body.pago).toMatchObject({ monto: '100.00', puedeEliminar: true });
    expect(await saldos()).toEqual({ A: '100.00', B: '0.00', C: '-100.00' });
    const otro = await post('/pagos', pago({ monto: '0.01' }), b);
    expect(otro.body.error).toMatchObject({
      code: 'PAGO_EXCEDE_DEUDA',
      details: { maximo: '0.00' },
    });
  });

  it.each([
    [{ a: '' }, 400, 'VALIDATION_ERROR'],
    [{ a: 'x' }, 422, 'PARTICIPANTES_INVALIDOS'],
    [{ de: 'x' }, 422, 'PARTICIPANTES_INVALIDOS'],
    [{ de: '__A__' }, 422, 'MISMO_USUARIO'], // CA-22.3
    [{ fecha: '2026-06-16' }, 422, 'FECHA_FUTURA'],
    [{ monto: '150' }, 422, 'PAGO_EXCEDE_DEUDA'],
  ])('rechaza %j con %i %s', async (over, status, code) => {
    const body = pago(over);
    if (body.de === '__A__') body.de = a.id;
    const res = await post('/pagos', body);
    expect([res.status, res.body.error.code]).toEqual([status, code]);
  });

  it('eliminar: 403 a quien no lo creó ni es admin (CA-24.2), 204 al creador (CA-24.1)', async () => {
    const id = (await post('/pagos', pago(), b)).body.pago.id;
    expect(
      (await request(ctx.app).delete(`/api/grupos/${gid}/pagos/${id}`).set(auth(c))).status,
    ).toBe(403);
    expect(
      (await request(ctx.app).delete(`/api/grupos/${gid}/pagos/${id}`).set(auth(b))).status,
    ).toBe(204);
    expect((await get('/pagos')).body.pagos).toEqual([]);
  });

  it('RN-12 con el saldo real: no se puede quitar a C mientras debe', async () => {
    const res = await request(ctx.app).delete(`/api/grupos/${gid}/miembros/${c.id}`).set(auth(a));
    expect(res.body.error).toMatchObject({
      code: 'SALDO_PENDIENTE',
      details: { saldo: '-100.00' },
    });
  });
});

describe('archivar', () => {
  it('409 con saldos (CA-25.2); con todo saldado archiva y queda en solo lectura (CA-25.1, CA-25.3)', async () => {
    expect((await post('/archivar', {})).body.error.code).toBe('SALDOS_PENDIENTES');
    expect((await post('/archivar', {}, b)).body.error.code).toBe('SOLO_ADMIN');
    await post('/pagos', pago());
    await post('/pagos', pago({ de: c.id }));
    const res = await post('/archivar', {});
    expect([res.status, res.body.grupo.archivado]).toEqual([200, true]);
    expect((await post('/pagos', pago())).body.error.code).toBe('GRUPO_ARCHIVADO');
  });
});
