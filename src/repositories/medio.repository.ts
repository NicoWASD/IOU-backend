import type { PrismaClient } from '@prisma/client';
import type { MedioRepository } from '../domain/medio.js';

const campos = { plataforma: true, valor: true, nota: true } as const;

export function createPrismaMedioRepository(prisma: PrismaClient): MedioRepository {
  const listar = (usuarioId: string) =>
    prisma.medioCobro.findMany({ where: { usuarioId }, orderBy: { orden: 'asc' }, select: campos });
  return {
    listar,
    async reemplazar(usuarioId, medios) {
      await prisma.$transaction([
        prisma.medioCobro.deleteMany({ where: { usuarioId } }),
        prisma.medioCobro.createMany({
          data: medios.map((m, orden) => ({ ...m, usuarioId, orden })),
        }),
      ]);
      return listar(usuarioId);
    },
  };
}
