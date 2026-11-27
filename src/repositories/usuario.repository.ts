import { Prisma, type PrismaClient } from '@prisma/client';
import type { UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';

const publico = {
  id: true,
  nombre: true,
  usuario: true,
  email: true,
  nombreReal: true,
  apellido: true,
  tutorialVisto: true,
} as const;

const esUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** P2002 → 409 con el código del campo que chocó. */
function unico(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const campos = JSON.stringify(err.meta?.target ?? '');
    if (campos.includes('usuario'))
      throw new AppError(409, 'USUARIO_EN_USO', 'Ese nombre de usuario ya está en uso');
    throw new AppError(409, 'EMAIL_EN_USO', 'El email ya está en uso');
  }
  throw err;
}

export function createPrismaUsuarioRepository(prisma: PrismaClient): UsuarioRepository {
  return {
    findByEmail(email) {
      return prisma.usuario.findUnique({
        where: { email },
        select: { ...publico, passwordHash: true },
      });
    },
    findById(id) {
      if (!esUuid(id)) return Promise.resolve(null);
      return prisma.usuario.findUnique({ where: { id }, select: publico });
    },
    async create(data) {
      try {
        return await prisma.usuario.create({ data, select: publico });
      } catch (err) {
        return unico(err);
      }
    },
    async actualizar(id, d) {
      try {
        return await prisma.usuario.update({ where: { id }, data: d, select: publico });
      } catch (err) {
        return unico(err);
      }
    },
    buscar(q, { excluirId, grupoId }) {
      return prisma.usuario.findMany({
        where: {
          usuario: { startsWith: q },
          id: { not: excluirId },
          ...(grupoId && esUuid(grupoId)
            ? { membresias: { none: { grupoId, activo: true } } }
            : {}),
        },
        orderBy: { usuario: 'asc' },
        take: 8,
        select: { id: true, nombre: true, usuario: true },
      });
    },
  };
}
