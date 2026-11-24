import type { Prisma, PrismaClient } from '@prisma/client';
import type { GastoData, GastoRepository, GastoRow } from '../domain/gasto.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = { select: { id: true, nombre: true } } as const;

const gastoSelect = {
  id: true,
  grupoId: true,
  descripcion: true,
  montoCentavos: true,
  fecha: true,
  tipoDivision: true,
  createdAt: true,
  pagadoPor: ref,
  creadoPor: ref,
  participaciones: {
    orderBy: { usuarioId: 'asc' },
    select: { montoCentavos: true, porcentaje: true, usuario: ref },
  },
} satisfies Prisma.GastoSelect;

type GastoSel = Prisma.GastoGetPayload<{ select: typeof gastoSelect }>;

const toRow = (g: GastoSel): GastoRow => ({
  ...g,
  montoCentavos: Number(g.montoCentavos),
  fecha: g.fecha.toISOString().slice(0, 10),
  participaciones: g.participaciones.map((p) => ({
    usuario: p.usuario,
    montoCentavos: Number(p.montoCentavos),
    // Decimal(5,2) → centésimos enteros, sin pasar por float
    pct: p.porcentaje === null ? null : Number(p.porcentaje.mul(100).toFixed(0)),
  })),
});

const datos = (d: GastoData) => ({
  descripcion: d.descripcion,
  montoCentavos: BigInt(d.montoCentavos),
  fecha: new Date(`${d.fecha}T00:00:00Z`),
  pagadoPorId: d.pagadoPorId,
  tipoDivision: d.tipoDivision,
});

const participaciones = (d: GastoData) =>
  d.participaciones.map((p) => ({
    usuarioId: p.usuarioId,
    montoCentavos: BigInt(p.montoCentavos),
    porcentaje: p.pct === null ? null : (p.pct / 100).toFixed(2),
  }));

export function createPrismaGastoRepository(prisma: PrismaClient): GastoRepository {
  return {
    async listar(grupoId, { skip, take }) {
      const where = { grupoId };
      const [filas, total] = await prisma.$transaction([
        prisma.gasto.findMany({
          where,
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
          select: gastoSelect,
        }),
        prisma.gasto.count({ where }),
      ]);
      return { filas: filas.map(toRow), total };
    },

    async buscar(grupoId, gastoId) {
      if (!UUID.test(gastoId)) return null;
      const g = await prisma.gasto.findFirst({
        where: { id: gastoId, grupoId },
        select: gastoSelect,
      });
      return g ? toRow(g) : null;
    },

    async crear(grupoId, creadoPorId, d) {
      const g = await prisma.gasto.create({
        data: {
          ...datos(d),
          grupoId,
          creadoPorId,
          participaciones: { create: participaciones(d) },
        },
        select: gastoSelect,
      });
      return toRow(g);
    },

    async reemplazar(gastoId, d) {
      const g = await prisma.gasto.update({
        where: { id: gastoId },
        data: { ...datos(d), participaciones: { deleteMany: {}, create: participaciones(d) } },
        select: gastoSelect,
      });
      return toRow(g);
    },

    async eliminar(gastoId) {
      await prisma.gasto.delete({ where: { id: gastoId } });
    },
  };
}
