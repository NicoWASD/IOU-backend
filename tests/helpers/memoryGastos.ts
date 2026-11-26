import { randomUUID } from 'node:crypto';
import type { GastoData, GastoRepository, GastoRow } from '../../src/domain/gasto.js';
import type { UsuarioConHash } from '../../src/domain/usuario.js';

type Fila = GastoData & { id: string; grupoId: string; creadoPorId: string; createdAt: Date };

/** Repositorio de gastos en memoria. Lee los nombres del repositorio de usuarios en memoria. */
export function createMemoryGastoRepository(usuarios: { all(): UsuarioConHash[] }) {
  const filas: Fila[] = [];
  let tick = Date.parse('2026-01-01T00:00:00Z');
  const ref = (id: string) => ({
    id,
    nombre: usuarios.all().find((u) => u.id === id)?.nombre ?? '?',
  });
  const toRow = (f: Fila): GastoRow => ({
    id: f.id,
    grupoId: f.grupoId,
    descripcion: f.descripcion,
    montoCentavos: f.montoCentavos,
    fecha: f.fecha,
    tipoDivision: f.tipoDivision,
    pagadoPor: ref(f.pagadoPorId),
    creadoPor: ref(f.creadoPorId),
    createdAt: f.createdAt,
    participaciones: [...f.participaciones]
      .sort((a, b) => (a.usuarioId < b.usuarioId ? -1 : 1))
      .map((p) => ({ usuario: ref(p.usuarioId), montoCentavos: p.montoCentavos, pct: p.pct })),
  });

  const repo: GastoRepository = {
    async listar(grupoId, { skip, take }) {
      const del = filas
        .filter((f) => f.grupoId === grupoId)
        .sort(
          (a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.getTime() - a.createdAt.getTime(),
        );
      return { filas: del.slice(skip, skip + take).map(toRow), total: del.length };
    },
    async buscar(grupoId, gastoId) {
      const f = filas.find((x) => x.id === gastoId && x.grupoId === grupoId);
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
    async reemplazar(gastoId, d) {
      const f = filas.find((x) => x.id === gastoId);
      if (!f) throw new Error('No existe');
      Object.assign(f, d);
      return toRow(f);
    },
    async eliminar(gastoId) {
      filas.splice(
        filas.findIndex((x) => x.id === gastoId),
        1,
      );
    },
  };
  return { ...repo, all: () => filas };
}
