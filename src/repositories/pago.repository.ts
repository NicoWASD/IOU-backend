import type { Prisma, PrismaClient } from '@prisma/client';
import type { Aportes, BalanceRepository, PagoRepository, PagoRow } from '../domain/balances.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = { select: { id: true, nombre: true } } as const;

const pagoSelect = {
  id: true,
  grupoId: true,
  montoCentavos: true,
  fecha: true,
  de: ref,
  a: ref,
  creadoPor: ref,
} satisfies Prisma.PagoSelect;

const toRow = (p: Prisma.PagoGetPayload<{ select: typeof pagoSelect }>): PagoRow => ({
  ...p,
  montoCentavos: Number(p.montoCentavos),
  fecha: p.fecha.toISOString().slice(0, 10),
});

export function createPrismaPagoRepository(prisma: PrismaClient): PagoRepository {
  return {
    async listar(grupoId) {
      const filas = await prisma.pago.findMany({
        where: { grupoId },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        select: pagoSelect,
      });
      return filas.map(toRow);
    },
    async buscar(grupoId, pagoId) {
      if (!UUID.test(pagoId)) return null;
      const p = await prisma.pago.findFirst({ where: { id: pagoId, grupoId }, select: pagoSelect });
      return p ? toRow(p) : null;
    },
    async crear(grupoId, creadoPorId, d) {
      const p = await prisma.pago.create({
        data: {
          grupoId,
          creadoPorId,
          deId: d.deId,
          aId: d.aId,
          montoCentavos: BigInt(d.montoCentavos),
          fecha: new Date(`${d.fecha}T00:00:00Z`),
        },
        select: pagoSelect,
      });
      return toRow(p);
    },
    async eliminar(pagoId) {
      await prisma.pago.delete({ where: { id: pagoId } });
    },
  };
}

const aMapa = <K extends string>(
  filas: ({ [k in K]: string } & { _sum: { montoCentavos: bigint | null } })[],
  k: K,
) => new Map(filas.map((f) => [f[k], Number(f._sum.montoCentavos ?? 0n)]));

/** Cuatro sumas agrupadas en una sola transacción de lectura. */
export function createPrismaBalanceRepository(prisma: PrismaClient): BalanceRepository {
  return {
    async aportes(grupoId): Promise<Aportes> {
      if (!UUID.test(grupoId))
        return { pagado: new Map(), consumido: new Map(), enviado: new Map(), recibido: new Map() };
      const [pagado, consumido, enviado, recibido] = await prisma.$transaction([
        prisma.gasto.groupBy({
          by: ['pagadoPorId'],
          where: { grupoId },
          orderBy: { pagadoPorId: 'asc' },
          _sum: { montoCentavos: true },
        }),
        prisma.participacionGasto.groupBy({
          by: ['usuarioId'],
          where: { gasto: { grupoId } },
          orderBy: { usuarioId: 'asc' },
          _sum: { montoCentavos: true },
        }),
        prisma.pago.groupBy({
          by: ['deId'],
          where: { grupoId },
          orderBy: { deId: 'asc' },
          _sum: { montoCentavos: true },
        }),
        prisma.pago.groupBy({
          by: ['aId'],
          where: { grupoId },
          orderBy: { aId: 'asc' },
          _sum: { montoCentavos: true },
        }),
      ]);
      return {
        pagado: aMapa(pagado, 'pagadoPorId'),
        consumido: aMapa(consumido, 'usuarioId'),
        enviado: aMapa(enviado, 'deId'),
        recibido: aMapa(recibido, 'aId'),
      };
    },
  };
}
