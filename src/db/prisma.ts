import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Consulta mínima para verificar que la base responde. */
export async function checkDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
