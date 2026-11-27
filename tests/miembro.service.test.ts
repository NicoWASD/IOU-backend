import { beforeEach, describe, expect, it } from 'vitest';
import type { SaldoProvider } from '../src/domain/grupo.js';
import { ceroSaldos, createGrupoService } from '../src/services/grupo.service.js';
import { createMiembroService } from '../src/services/miembro.service.js';
import { createMemoryGrupoRepository } from './helpers/memoryGrupos.js';
import { createMemoryUsuarioRepository } from './helpers/memoryUsuarios.js';

let usuarios: ReturnType<typeof createMemoryUsuarioRepository>;
let grupos: ReturnType<typeof createMemoryGrupoRepository>;
let grupoService: ReturnType<typeof createGrupoService>;
let service: ReturnType<typeof createMiembroService>;
let sofi: string;
let tomi: string;
let juli: string;
let grupoId: string;

const nuevo = (nombre: string, email: string) =>
  usuarios
    .create({ nombre, usuario: email.split('@')[0]!, email, passwordHash: 'hash' })
    .then((u) => u.id);

const conSaldos = (saldos: SaldoProvider) => createMiembroService({ grupoService, grupos, saldos });

beforeEach(async () => {
  usuarios = createMemoryUsuarioRepository();
  grupos = createMemoryGrupoRepository(usuarios);
  grupoService = createGrupoService({ grupos, saldos: ceroSaldos });
  service = conSaldos(ceroSaldos);
  sofi = await nuevo('Sofía', 'sofi@mail.com');
  tomi = await nuevo('Tomi', 'tomi@mail.com');
  juli = await nuevo('Juli', 'juli@mail.com');
  grupoId = (await grupoService.crear(sofi, { nombre: 'Depto' })).id;
});

describe('quitar', () => {
  beforeEach(async () => {
    grupos.sembrarMiembro(grupoId, tomi);
  });

  it('con saldo 0 → queda inactivo y sigue en listar con activo: false (CA-11.1)', async () => {
    await service.quitar(sofi, grupoId, tomi);
    expect(await service.listar(sofi, grupoId)).toContainEqual({
      id: tomi,
      nombre: 'Tomi',
      email: 'tomi@mail.com',
      rol: 'MIEMBRO',
      activo: false,
    });
    await expect(grupoService.detalle(tomi, grupoId)).rejects.toMatchObject({
      code: 'GRUPO_NO_ENCONTRADO',
    });
  });

  it('con 1 centavo de saldo → SALDO_PENDIENTE con details.saldo "0.01" (CA-11.2, CB-09)', async () => {
    const pedidos: [string, string][] = [];
    const s = conSaldos({
      saldoDe: async (g, u) => {
        pedidos.push([g, u]);
        return 1;
      },
    });
    await expect(s.quitar(sofi, grupoId, tomi)).rejects.toMatchObject({
      status: 409,
      code: 'SALDO_PENDIENTE',
      message: 'No se puede quitar a Tomi: tiene saldo pendiente de $ 0,01',
      details: { saldo: '0.01' },
    });
    expect(pedidos).toEqual([[grupoId, tomi]]);
    expect(await grupos.membresia(grupoId, tomi)).toEqual({ rol: 'MIEMBRO', activo: true });
  });

  it('con deuda (saldo negativo) también rechaza, con el saldo con signo en details', async () => {
    const s = conSaldos({ saldoDe: async () => -123456 });
    await expect(s.quitar(sofi, grupoId, tomi)).rejects.toMatchObject({
      code: 'SALDO_PENDIENTE',
      message: 'No se puede quitar a Tomi: tiene saldo pendiente de $ 1.234,56',
      details: { saldo: '-1234.56' },
    });
  });

  it('al admin mismo → ADMIN_NO_PUEDE_SALIR (CA-11.3)', async () => {
    await expect(service.quitar(sofi, grupoId, sofi)).rejects.toMatchObject({
      status: 409,
      code: 'ADMIN_NO_PUEDE_SALIR',
      message: 'El admin no puede quitarse del grupo',
    });
    expect(await grupos.membresia(grupoId, sofi)).toEqual({ rol: 'ADMIN', activo: true });
  });

  it('un usuarioId que no es miembro → MIEMBRO_NO_ENCONTRADO', async () => {
    const esperado = {
      status: 404,
      code: 'MIEMBRO_NO_ENCONTRADO',
      message: 'Esa persona no es miembro del grupo',
    };
    await expect(service.quitar(sofi, grupoId, juli)).rejects.toMatchObject(esperado);
    await expect(service.quitar(sofi, grupoId, 'no-existe')).rejects.toMatchObject(esperado);
  });

  it('a alguien que ya estaba inactivo → MIEMBRO_NO_ENCONTRADO', async () => {
    await service.quitar(sofi, grupoId, tomi);
    await expect(service.quitar(sofi, grupoId, tomi)).rejects.toMatchObject({
      code: 'MIEMBRO_NO_ENCONTRADO',
    });
  });

  it('por quien no es admin → SOLO_ADMIN', async () => {
    grupos.sembrarMiembro(grupoId, juli);
    await expect(service.quitar(tomi, grupoId, juli)).rejects.toMatchObject({
      status: 403,
      code: 'SOLO_ADMIN',
    });
    await expect(service.quitar(tomi, grupoId, tomi)).rejects.toMatchObject({
      code: 'SOLO_ADMIN',
    });
  });

  it('sobre un grupo archivado → GRUPO_ARCHIVADO aunque lo pida el admin (Review Focus 4)', async () => {
    grupos.archivar(grupoId);
    await expect(service.quitar(sofi, grupoId, tomi)).rejects.toMatchObject({
      status: 409,
      code: 'GRUPO_ARCHIVADO',
    });
    expect(await grupos.membresia(grupoId, tomi)).toEqual({ rol: 'MIEMBRO', activo: true });
  });
});

describe('precedencia de reglas', () => {
  beforeEach(async () => {
    grupos.sembrarMiembro(grupoId, tomi);
  });

  it('el admin quitándose con saldo ≠ 0 → ADMIN_NO_PUEDE_SALIR, no SALDO_PENDIENTE', async () => {
    const s = conSaldos({ saldoDe: async () => 500 });
    await expect(s.quitar(sofi, grupoId, sofi)).rejects.toMatchObject({
      code: 'ADMIN_NO_PUEDE_SALIR',
    });
  });

  it('un no-admin sobre un grupo archivado → SOLO_ADMIN (quitar)', async () => {
    grupos.archivar(grupoId);
    await expect(service.quitar(tomi, grupoId, sofi)).rejects.toMatchObject({
      code: 'SOLO_ADMIN',
    });
  });

  it('un no-admin quitando a un no miembro → SOLO_ADMIN, no MIEMBRO_NO_ENCONTRADO', async () => {
    await expect(service.quitar(tomi, grupoId, juli)).rejects.toMatchObject({
      code: 'SOLO_ADMIN',
    });
  });
});

describe('listar', () => {
  it('cualquier miembro activo ve a todos, activos e inactivos', async () => {
    grupos.sembrarMiembro(grupoId, tomi);
    grupos.sembrarMiembro(grupoId, juli);
    await service.quitar(sofi, grupoId, juli);
    expect((await service.listar(tomi, grupoId)).map((m) => [m.nombre, m.activo])).toEqual([
      ['Sofía', true],
      ['Tomi', true],
      ['Juli', false],
    ]);
  });

  it('un no miembro → GRUPO_NO_ENCONTRADO', async () => {
    await expect(service.listar(juli, grupoId)).rejects.toMatchObject({
      status: 404,
      code: 'GRUPO_NO_ENCONTRADO',
    });
  });
});
