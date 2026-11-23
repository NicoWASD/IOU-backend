import { Prisma, type PrismaClient } from '@prisma/client';
import type { UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';

const publico = { id: true, nombre: true, email: true } as const;

export function createPrismaUsuarioRepository(prisma: PrismaClient): UsuarioRepository {
  return {
    findByEmail(email) {
      return prisma.usuario.findUnique({
        where: { email },
        select: { ...publico, passwordHash: true },
      });
    },
    findById(id) {
      return prisma.usuario.findUnique({ where: { id }, select: publico });
    },
    async create(data) {
      try {
        return await prisma.usuario.create({ data, select: publico });
      } catch (err) {
        // Dos registros simultáneos con el mismo email: la restricción UNIQUE gana
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(409, 'EMAIL_EN_USO', 'El email ya está en uso');
        }
        throw err;
      }
    },
  };
}
