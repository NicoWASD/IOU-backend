import type {
  GastoData,
  GastoDetalle,
  GastoRepository,
  GastoResumen,
  GastoRow,
} from '../domain/gasto.js';
import type { GrupoRepository, Rol } from '../domain/grupo.js';
import { formatPorcentaje, splitEqual, splitPct } from '../domain/reparto.js';
import { AppError } from '../lib/errors.js';
import { centsToMoney, formatARS } from '../lib/money.js';
import type { NuevoGastoBody } from '../schemas/gasto.schemas.js';
import { grupoArchivado, type GrupoService } from './grupo.service.js';

const gastoNoEncontrado = () => new AppError(404, 'GASTO_NO_ENCONTRADO', 'Este gasto no existe');
export const sinPermiso = () =>
  new AppError(403, 'SIN_PERMISO', 'Solo quien cargó el gasto o el admin pueden modificarlo');
const regla = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);

/** Fecha de hoy (YYYY-MM-DD) en Buenos Aires (RN-07). */
export const hoyEnBuenosAires = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(
    new Date(),
  );

export type GastoService = {
  listar(
    actorId: string,
    grupoId: string,
    page: number,
    pageSize: number,
  ): Promise<{ gastos: GastoResumen[]; page: number; pageSize: number; total: number }>;
  detalle(actorId: string, grupoId: string, gastoId: string): Promise<GastoDetalle>;
  crear(actorId: string, grupoId: string, body: NuevoGastoBody): Promise<GastoDetalle>;
  editar(
    actorId: string,
    grupoId: string,
    gastoId: string,
    body: NuevoGastoBody,
  ): Promise<GastoDetalle>;
  eliminar(actorId: string, grupoId: string, gastoId: string): Promise<void>;
};

export function createGastoService(deps: {
  grupoService: GrupoService;
  grupos: GrupoRepository;
  gastos: GastoRepository;
  hoy?: () => string;
}): GastoService {
  const { grupoService, grupos, gastos, hoy = hoyEnBuenosAires } = deps;

  const activos = async (grupoId: string) =>
    new Set((await grupos.miembros(grupoId)).filter((m) => m.activo).map((m) => m.id));

  const involucrados = (g: GastoRow) => [
    g.pagadoPor.id,
    ...g.participaciones.map((p) => p.usuario.id),
  ];

  const miParte = (g: GastoRow, actorId: string) =>
    centsToMoney(g.participaciones.find((p) => p.usuario.id === actorId)?.montoCentavos ?? 0);

  const aResumen = (g: GastoRow, actorId: string): GastoResumen => ({
    id: g.id,
    descripcion: g.descripcion,
    monto: centsToMoney(g.montoCentavos),
    fecha: g.fecha,
    tipoDivision: g.tipoDivision,
    pagadoPor: g.pagadoPor,
    miParte: miParte(g, actorId),
  });

  const puede = (g: GastoRow, actorId: string, rol: Rol) =>
    g.creadoPor.id === actorId || rol === 'ADMIN';

  const aDetalle = (
    g: GastoRow,
    actorId: string,
    rol: Rol,
    archivado: boolean,
    act: Set<string>,
  ): GastoDetalle => ({
    ...aResumen(g, actorId),
    creadoPor: g.creadoPor,
    participaciones: g.participaciones.map((p) => ({
      usuario: p.usuario,
      monto: centsToMoney(p.montoCentavos),
      porcentaje: p.pct === null ? null : formatPorcentaje(p.pct),
    })),
    // RN-08, RN-15 y RN-17
    puedeEditar: puede(g, actorId, rol) && !archivado && involucrados(g).every((id) => act.has(id)),
    createdAt: g.createdAt.toISOString(),
  });

  /** Reglas RN-02 a RN-07 y cálculo de las participaciones. */
  const validar = (body: NuevoGastoBody, act: Set<string>): GastoData => {
    if (body.fecha > hoy()) throw regla('FECHA_FUTURA', 'La fecha no puede ser futura');
    if (!act.has(body.pagadoPor))
      throw regla('PAGADOR_NO_MIEMBRO', 'Quien pagó tiene que ser miembro activo del grupo');
    const ids = body.participantes.map((p) => p.usuarioId);
    if (ids.length === 0 || new Set(ids).size !== ids.length || ids.some((id) => !act.has(id)))
      throw regla(
        'PARTICIPANTES_INVALIDOS',
        'Elegí al menos un participante, sin repetir, entre los miembros activos',
      );

    const total = body.monto;
    let participaciones: GastoData['participaciones'];
    if (body.tipoDivision === 'IGUAL') {
      const r = splitEqual(total, ids);
      participaciones = ids.map((id) => ({
        usuarioId: id,
        montoCentavos: r.get(id) ?? 0,
        pct: null,
      }));
    } else if (body.tipoDivision === 'MONTOS') {
      const diferencia = total - body.participantes.reduce((s, p) => s + p.monto, 0);
      if (diferencia !== 0)
        throw regla(
          'SUMA_PARTICIPACIONES_INVALIDA',
          `Los montos tienen que sumar el total (${diferencia > 0 ? 'faltan' : 'sobran'} ${formatARS(Math.abs(diferencia))})`,
          { diferencia: centsToMoney(diferencia) },
        );
      participaciones = body.participantes.map((p) => ({
        usuarioId: p.usuarioId,
        montoCentavos: p.monto,
        pct: null,
      }));
    } else {
      const suma = body.participantes.reduce((s, p) => s + p.porcentaje, 0);
      if (suma !== 10000)
        throw regla(
          'SUMA_PORCENTAJES_INVALIDA',
          `Los porcentajes tienen que sumar 100 % (suman ${formatPorcentaje(suma).replace('.', ',')} %)`,
          { suma: formatPorcentaje(suma) },
        );
      const r = splitPct(
        total,
        body.participantes.map((p) => ({ id: p.usuarioId, pct: p.porcentaje })),
      );
      participaciones = body.participantes.map((p) => ({
        usuarioId: p.usuarioId,
        montoCentavos: r.get(p.usuarioId) ?? 0,
        pct: p.porcentaje,
      }));
    }
    return {
      descripcion: body.descripcion,
      montoCentavos: total,
      fecha: body.fecha,
      pagadoPorId: body.pagadoPor,
      tipoDivision: body.tipoDivision,
      participaciones,
    };
  };

  /** Contexto de una escritura sobre un gasto existente: 404 → 409 archivado → 403. */
  const paraModificar = async (actorId: string, grupoId: string, gastoId: string) => {
    const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
    const gasto = await gastos.buscar(grupoId, gastoId);
    if (!gasto) throw gastoNoEncontrado();
    if (grupo.archivado) throw grupoArchivado();
    if (!puede(gasto, actorId, rol)) throw sinPermiso();
    return { rol, gasto };
  };

  return {
    async listar(actorId, grupoId, page, pageSize) {
      await grupoService.contexto(actorId, grupoId);
      const { filas, total } = await gastos.listar(grupoId, {
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return { gastos: filas.map((g) => aResumen(g, actorId)), page, pageSize, total };
    },

    async detalle(actorId, grupoId, gastoId) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      const gasto = await gastos.buscar(grupoId, gastoId);
      if (!gasto) throw gastoNoEncontrado();
      return aDetalle(gasto, actorId, rol, grupo.archivado, await activos(grupoId));
    },

    async crear(actorId, grupoId, body) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      if (grupo.archivado) throw grupoArchivado(); // RN-15
      const act = await activos(grupoId);
      const gasto = await gastos.crear(grupoId, actorId, validar(body, act));
      return aDetalle(gasto, actorId, rol, false, act);
    },

    async editar(actorId, grupoId, gastoId, body) {
      const { rol, gasto } = await paraModificar(actorId, grupoId, gastoId);
      const act = await activos(grupoId);
      if (!involucrados(gasto).every((id) => act.has(id)))
        throw new AppError(
          409,
          'GASTO_CON_MIEMBRO_INACTIVO',
          'No se puede editar: alguien del gasto ya no es miembro del grupo',
        ); // RN-17
      const actualizado = await gastos.reemplazar(gastoId, validar(body, act));
      return aDetalle(actualizado, actorId, rol, false, act);
    },

    async eliminar(actorId, grupoId, gastoId) {
      await paraModificar(actorId, grupoId, gastoId);
      await gastos.eliminar(gastoId);
    },
  };
}
