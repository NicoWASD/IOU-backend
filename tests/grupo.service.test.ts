import { beforeEach, describe, expect, it } from 'vitest';
import type { SaldoProvider } from '../src/domain/grupo.js';
import { ceroSaldos, createGrupoService } from '../src/services/grupo.service.js';
import { createMemoryGrupoRepository } from './helpers/memoryGrupos.js';
import { createMemoryUsuarioRepository } from './helpers/memoryUsuarios.js';

let usuarios: ReturnType<typeof createMemoryUsuarioRepository>;
let grupos: ReturnType<typeof createMemoryGrupoRepository>;
let service: ReturnType<typeof createGrupoService>;
let sofi: string;
let tomi: string;
let juli: string;

const nuevo = (nombre: string, email: string) =>
  usuarios
    .create({ nombre, usuario: email.split('@')[0]!, email, passwordHash: 'hash' })
    .then((u) => u.id);

beforeEach(async () => {
  usuarios = createMemoryUsuarioRepository();
  grupos = createMemoryGrupoRepository(usuarios);
  service = createGrupoService({ grupos, saldos: ceroSaldos });
  sofi = await nuevo('Sofía', 'sofi@mail.com');
  tomi = await nuevo('Tomi', 'tomi@mail.com');
  juli = await nuevo('Juli', 'juli@mail.com');
});

describe('crear', () => {
  it('deja al actor como ADMIN y devuelve el detalle con miRol ADMIN (CA-06.1)', async () => {
    const g = await service.crear(sofi, { nombre: 'Bariloche', descripcion: 'Viaje de egresados' });
    expect(g).toEqual({
      id: expect.any(String),
      nombre: 'Bariloche',
      descripcion: 'Viaje de egresados',
      moneda: 'ARS',
      archivado: false,
      creadoPor: { id: sofi, nombre: 'Sofía' },
      miRol: 'ADMIN',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      miembros: [{ id: sofi, nombre: 'Sofía', email: 'sofi@mail.com', rol: 'ADMIN', activo: true }],
    });
    expect(await grupos.membresia(g.id, sofi)).toEqual({ rol: 'ADMIN', activo: true });
  });

  it('sin descripción queda en null', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    expect(g.descripcion).toBeNull();
  });
});

describe('listar', () => {
  it('solo los grupos donde el actor está activo, con miembros activos y miBalance "0.00" (CA-07.1)', async () => {
    const depto = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(depto.id, tomi);
    grupos.sembrarMiembro(depto.id, juli, 'MIEMBRO', false);
    await service.crear(tomi, { nombre: 'Fútbol' }); // Sofi no es parte

    expect(await service.listar(sofi)).toEqual([
      {
        id: depto.id,
        nombre: 'Depto',
        descripcion: null,
        archivado: false,
        miembros: [
          { id: sofi, nombre: 'Sofía' },
          { id: tomi, nombre: 'Tomi' },
        ],
        miBalance: '0.00',
      },
    ]);
  });

  it('primero los activos y después los archivados, cada uno por createdAt desc (CA-07.3)', async () => {
    const a = await service.crear(sofi, { nombre: 'A' });
    await service.crear(sofi, { nombre: 'B' });
    const c = await service.crear(sofi, { nombre: 'C' });
    await service.crear(sofi, { nombre: 'D' });
    grupos.archivar(a.id);
    grupos.archivar(c.id);
    const lista = await service.listar(sofi);
    expect(lista.map((g) => g.nombre)).toEqual(['D', 'B', 'C', 'A']);
    expect(lista.map((g) => g.archivado)).toEqual([false, false, true, true]);
  });

  it('un miembro dado de baja no ve el grupo en su lista (Review Focus 2)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi, 'MIEMBRO', false);
    expect(await service.listar(tomi)).toEqual([]);
  });

  it('miBalance sale del SaldoProvider, para el actor, convertido a Money', async () => {
    const pedidos: [string, string][] = [];
    const saldos: SaldoProvider = {
      saldoDe: async (grupoId, usuarioId) => {
        pedidos.push([grupoId, usuarioId]);
        return -10000;
      },
    };
    const s = createGrupoService({ grupos, saldos });
    const g = await s.crear(sofi, { nombre: 'Depto' });
    expect((await s.listar(sofi))[0]?.miBalance).toBe('-100.00');
    expect(pedidos).toEqual([[g.id, sofi]]);
  });
});

describe('detalle', () => {
  it('un miembro ve el grupo con su rol y todos los miembros, activos e inactivos (CA-08.1)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi);
    grupos.sembrarMiembro(g.id, juli, 'MIEMBRO', false);
    const d = await service.detalle(tomi, g.id);
    expect(d.miRol).toBe('MIEMBRO');
    expect(d.miembros.map((m) => [m.nombre, m.rol, m.activo])).toEqual([
      ['Sofía', 'ADMIN', true],
      ['Tomi', 'MIEMBRO', true],
      ['Juli', 'MIEMBRO', false],
    ]);
  });

  it('un no miembro recibe GRUPO_NO_ENCONTRADO, igual que si no existiera (CA-08.2)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    const esperado = {
      status: 404,
      code: 'GRUPO_NO_ENCONTRADO',
      message: 'Este grupo no existe o no sos parte',
    };
    await expect(service.detalle(tomi, g.id)).rejects.toMatchObject(esperado);
    await expect(
      service.detalle(tomi, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject(esperado);
  });

  it('un miembro inactivo recibe GRUPO_NO_ENCONTRADO (Review Focus 2)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi, 'MIEMBRO', false);
    await expect(service.detalle(tomi, g.id)).rejects.toMatchObject({
      status: 404,
      code: 'GRUPO_NO_ENCONTRADO',
    });
  });
});

describe('editar', () => {
  it('el admin cambia nombre y descripción (CA-09.1)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto', descripcion: 'Viejo' });
    const editado = await service.editar(sofi, g.id, {
      nombre: 'Depto Palermo',
      descripcion: null,
    });
    expect(editado).toMatchObject({ nombre: 'Depto Palermo', descripcion: null, miRol: 'ADMIN' });
    expect((await service.detalle(sofi, g.id)).nombre).toBe('Depto Palermo');
  });

  it('solo cambia los campos que vienen', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto', descripcion: 'Se queda' });
    const editado = await service.editar(sofi, g.id, { nombre: 'Otro' });
    expect(editado.descripcion).toBe('Se queda');
  });

  it('un miembro que no es admin recibe SOLO_ADMIN y no cambia nada (CA-09.2)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi);
    await expect(service.editar(tomi, g.id, { nombre: 'Mío' })).rejects.toMatchObject({
      status: 403,
      code: 'SOLO_ADMIN',
      message: 'Solo el admin del grupo puede hacer esto',
    });
    expect((await service.detalle(sofi, g.id)).nombre).toBe('Depto');
  });

  it('sobre un grupo archivado da GRUPO_ARCHIVADO aunque lo pida el admin (Review Focus 4)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.archivar(g.id);
    await expect(service.editar(sofi, g.id, { nombre: 'Otro' })).rejects.toMatchObject({
      status: 409,
      code: 'GRUPO_ARCHIVADO',
      message: 'El grupo está archivado: solo se puede consultar',
    });
    expect((await service.detalle(sofi, g.id)).nombre).toBe('Depto');
  });

  it('un no miembro recibe GRUPO_NO_ENCONTRADO, no SOLO_ADMIN', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    await expect(service.editar(tomi, g.id, { nombre: 'X' })).rejects.toMatchObject({
      status: 404,
      code: 'GRUPO_NO_ENCONTRADO',
    });
  });
});

describe('casos borde', () => {
  it('listar de un usuario sin grupos devuelve []', async () => {
    expect(await service.listar(juli)).toEqual([]);
  });

  it('un grupo archivado se sigue pudiendo consultar (RN-15: solo lectura)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.archivar(g.id);
    expect((await service.detalle(sofi, g.id)).archivado).toBe(true);
  });

  it('un miembro común que edita un archivado recibe SOLO_ADMIN (permiso antes que estado)', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi);
    grupos.archivar(g.id);
    await expect(service.editar(tomi, g.id, { nombre: 'X' })).rejects.toMatchObject({
      code: 'SOLO_ADMIN',
    });
  });

  it('un admin dado de baja recibe GRUPO_NO_ENCONTRADO al editar', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    grupos.sembrarMiembro(g.id, tomi, 'ADMIN', false);
    await expect(service.editar(tomi, g.id, { nombre: 'X' })).rejects.toMatchObject({
      status: 404,
      code: 'GRUPO_NO_ENCONTRADO',
    });
  });

  it('editar sin campos devuelve el grupo sin cambios', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto', descripcion: 'd' });
    expect(await service.editar(sofi, g.id, {})).toMatchObject({
      nombre: 'Depto',
      descripcion: 'd',
    });
  });
});

describe('contexto', () => {
  it('devuelve el grupo y el rol del actor activo', async () => {
    const g = await service.crear(sofi, { nombre: 'Depto' });
    const ctx = await service.contexto(sofi, g.id);
    expect(ctx.rol).toBe('ADMIN');
    expect(ctx.grupo.id).toBe(g.id);
  });
});
