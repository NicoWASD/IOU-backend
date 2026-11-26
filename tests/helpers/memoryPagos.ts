import { randomUUID } from 'node:crypto';
import type {
  Aportes,
  BalanceRepository,
  PagoRepository,
  PagoRow,
} from '../../src/domain/balances.js';
import type { GastoData } from '../../src/domain/gasto.js';
import type { UsuarioConHash } from '../../src/domain/usuario.js';

type Fila = {
  id: string;
  grupoId: string;
  deId: string;
  aId: string;
  montoCentavos: number;
  fecha: string;
  creadoPorId: string;
  createdAt: Date;
};

export function createMemoryPagoRepository(usuarios: { all(): UsuarioConHash[] }) {
  const filas: Fila[] = [];
  let tick = Date.parse('2026-01-01T00:00:00Z');
  const ref = (id: string) => ({
    id,
    nombre: usuarios.all().find((u) => u.id === id)?.nombre ?? '?',
  });
  const toRow = (f: Fila): PagoRow => ({
    id: f.id,
    grupoId: f.grupoId,
    de: ref(f.deId),
    a: ref(f.aId),
    montoCentavos: f.montoCentavos,
    fecha: f.fecha,
    creadoPor: ref(f.creadoPorId),
  });
  const repo: PagoRepository = {
    async listar(grupoId) {
      return filas
        .filter((f) => f.grupoId === grupoId)
        .sort(
          (a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.getTime() - a.createdAt.getTime(),
        )
        .map(toRow);
    },
    async buscar(grupoId, pagoId) {
      const f = filas.find((x) => x.id === pagoId && x.grupoId === grupoId);
      return f ? toRow(f) : null;
    },
    async crear(grupoId, creadoPorId, d) {
      const f: Fila = {
        ...d,
        id: randomUUID(),
        grupoId,
        creadoPorId,
        createdAt: new Date((tick += 1000)),
      };
      filas.push(f);
      return toRow(f);
    },
    async eliminar(pagoId) {
      filas.splice(
        filas.findIndex((x) => x.id === pagoId),
        1,
      );
    },
  };
  return { ...repo, all: () => filas };
}

/** Las mismas sumas que el `groupBy` de Prisma, sobre los repos en memoria. */
export function createMemoryBalanceRepository(
  gastos: { all(): (GastoData & { grupoId: string })[] },
  pagos: { all(): Fila[] },
): BalanceRepository {
  return {
    async aportes(grupoId) {
      const a: Aportes = {
        pagado: new Map(),
        consumido: new Map(),
        enviado: new Map(),
        recibido: new Map(),
      };
      const sumar = (m: Map<string, number>, id: string, c: number) =>
        m.set(id, (m.get(id) ?? 0) + c);
      for (const g of gastos.all().filter((x) => x.grupoId === grupoId)) {
        sumar(a.pagado, g.pagadoPorId, g.montoCentavos);
        for (const p of g.participaciones) sumar(a.consumido, p.usuarioId, p.montoCentavos);
      }
      for (const p of pagos.all().filter((x) => x.grupoId === grupoId)) {
        sumar(a.enviado, p.deId, p.montoCentavos);
        sumar(a.recibido, p.aId, p.montoCentavos);
      }
      return a;
    },
  };
}
