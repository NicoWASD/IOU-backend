import { Prisma, type PrismaClient } from '@prisma/client';
import type { Invitacion, InvitacionRepository } from '../domain/invitacion.js';
import { AppError } from '../lib/errors.js';

const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

const vista = {
  id: true,
  createdAt: true,
  grupo: { select: { id: true, nombre: true } },
  invitado: { select: { id: true, nombre: true, usuario: true } },
  invitador: { select: { id: true, nombre: true } },
} as const;

type Fila = Prisma.InvitacionGetPayload<{ select: typeof vista }>;
const toVista = ({ invitador, ...f }: Fila): Invitacion => ({ ...f, invitadoPor: invitador });

export function createPrismaInvitacionRepository(prisma: PrismaClient): InvitacionRepository {
  return {
    async crear(data) {
      try {
        return toVista(await prisma.invitacion.create({ data, select: vista }));
      } catch (err) {
        // Dos invitaciones simultáneas: gana el índice único parcial
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          throw new AppError(409, 'YA_INVITADO', 'Esa persona ya tiene una invitación pendiente');
        throw err;
      }
    },
    async hayPendiente(grupoId, invitadoId) {
      const n = await prisma.invitacion.count({
        where: { grupoId, invitadoId, estado: 'PENDIENTE' },
      });
      return n > 0;
    },
    buscar(id) {
      if (!esUuid(id)) return Promise.resolve(null);
      return prisma.invitacion.findUnique({
        where: { id },
        select: { id: true, grupoId: true, invitadoId: true, estado: true },
      });
    },
    async pendientesDeGrupo(grupoId) {
      const filas = await prisma.invitacion.findMany({
        where: { grupoId, estado: 'PENDIENTE' },
        orderBy: { createdAt: 'asc' },
        select: vista,
      });
      return filas.map(toVista);
    },
    async pendientesDe(usuarioId) {
      const filas = await prisma.invitacion.findMany({
        where: { invitadoId: usuarioId, estado: 'PENDIENTE', grupo: { archivado: false } },
        orderBy: { createdAt: 'desc' },
        select: vista,
      });
      return filas.map(toVista);
    },
    async cerrar(id, estado) {
      const r = await prisma.invitacion.updateMany({
        where: { id, estado: 'PENDIENTE' },
        data: { estado },
      });
      return r.count === 1;
    },
    aceptar({ id, grupoId, invitadoId }) {
      return prisma.$transaction(async (tx) => {
        const r = await tx.invitacion.updateMany({
          where: { id, estado: 'PENDIENTE' },
          data: { estado: 'ACEPTADA' },
        });
        if (r.count !== 1) return false;
        // CB-15: si había sido miembro, se reactiva la misma membresía
        await tx.miembroGrupo.upsert({
          where: { grupoId_usuarioId: { grupoId, usuarioId: invitadoId } },
          create: { grupoId, usuarioId: invitadoId, rol: 'MIEMBRO' },
          update: { activo: true },
        });
        return true;
      });
    },
  };
}
