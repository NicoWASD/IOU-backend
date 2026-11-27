import { Prisma, type PrismaClient } from '@prisma/client';
import type { GrupoRepository, GrupoRow, Miembro, Rol } from '../domain/grupo.js';
import { AppError } from '../lib/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres rechaza un id que no es UUID: para el dominio es simplemente "no existe". */
const esUuid = (id: string) => UUID.test(id);

const grupoSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  moneda: true,
  archivado: true,
  createdAt: true,
  creadoPor: { select: { id: true, nombre: true } },
} as const;

const miembroSelect = {
  rol: true,
  activo: true,
  usuario: { select: { id: true, nombre: true, email: true } },
} as const;

type GrupoSel = {
  id: string;
  nombre: string;
  descripcion: string | null;
  moneda: string;
  archivado: boolean;
  createdAt: Date;
  creadoPor: { id: string; nombre: string };
};

const toRow = (g: GrupoSel): GrupoRow => {
  // Un solo valor posible hasta que haya multimoneda (fuera de alcance)
  if (g.moneda !== 'ARS') throw new Error(`Moneda no soportada: ${g.moneda}`);
  return { ...g, moneda: 'ARS' };
};

const toMiembro = (m: {
  rol: Rol;
  activo: boolean;
  usuario: { id: string; nombre: string; email: string };
}): Miembro => ({ ...m.usuario, rol: m.rol, activo: m.activo });

export function createPrismaGrupoRepository(prisma: PrismaClient): GrupoRepository {
  return {
    crear({ nombre, descripcion, creadoPorId }) {
      return prisma.$transaction(async (tx) => {
        const g = await tx.grupo.create({
          data: { nombre, descripcion, creadoPorId },
          select: grupoSelect,
        });
        await tx.miembroGrupo.create({
          data: { grupoId: g.id, usuarioId: creadoPorId, rol: 'ADMIN' },
        });
        return toRow(g);
      });
    },

    async listarDeUsuario(usuarioId) {
      if (!esUuid(usuarioId)) return [];
      const filas = await prisma.grupo.findMany({
        where: { miembros: { some: { usuarioId, activo: true } } },
        orderBy: [{ archivado: 'asc' }, { createdAt: 'desc' }],
        select: {
          ...grupoSelect,
          miembros: {
            where: { activo: true },
            orderBy: { fechaAlta: 'asc' },
            select: { usuario: { select: { id: true, nombre: true } } },
          },
        },
      });
      return filas.map(({ miembros, ...g }) => ({
        ...toRow(g),
        miembrosActivos: miembros.map((m) => m.usuario),
      }));
    },

    async buscar(grupoId) {
      if (!esUuid(grupoId)) return null;
      const g = await prisma.grupo.findUnique({ where: { id: grupoId }, select: grupoSelect });
      return g ? toRow(g) : null;
    },

    async membresia(grupoId, usuarioId) {
      if (!esUuid(grupoId) || !esUuid(usuarioId)) return null;
      return prisma.miembroGrupo.findUnique({
        where: { grupoId_usuarioId: { grupoId, usuarioId } },
        select: { rol: true, activo: true },
      });
    },

    async miembros(grupoId) {
      if (!esUuid(grupoId)) return [];
      const filas = await prisma.miembroGrupo.findMany({
        where: { grupoId },
        orderBy: { fechaAlta: 'asc' },
        select: miembroSelect,
      });
      return filas.map(toMiembro);
    },

    async actualizar(grupoId, d) {
      const g = await prisma.grupo.update({ where: { id: grupoId }, data: d, select: grupoSelect });
      return toRow(g);
    },

    async agregarMiembro(grupoId, usuarioId) {
      try {
        const m = await prisma.miembroGrupo.create({
          data: { grupoId, usuarioId, rol: 'MIEMBRO' },
          select: miembroSelect,
        });
        return toMiembro(m);
      } catch (err) {
        // Dos altas simultáneas de la misma persona: la PK compuesta gana
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(409, 'YA_ES_MIEMBRO', 'Ya es miembro del grupo');
        }
        throw err;
      }
    },

    async reactivarMiembro(grupoId, usuarioId) {
      const m = await prisma.miembroGrupo.update({
        where: { grupoId_usuarioId: { grupoId, usuarioId } },
        data: { activo: true },
        select: miembroSelect,
      });
      return toMiembro(m);
    },

    async desactivarMiembro(grupoId, usuarioId) {
      await prisma.miembroGrupo.update({
        where: { grupoId_usuarioId: { grupoId, usuarioId } },
        data: { activo: false },
      });
    },

    async compartenGrupoActivo(a, b) {
      if (!esUuid(b)) return false;
      const n = await prisma.miembroGrupo.count({
        where: {
          usuarioId: a,
          activo: true,
          grupo: { miembros: { some: { usuarioId: b, activo: true } } },
        },
      });
      return n > 0;
    },
  };
}
