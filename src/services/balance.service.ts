import {
  calcularBalances,
  liquidar,
  type Balance,
  type BalanceRepository,
  type Pago,
  type PagoRepository,
  type PagoRow,
  type Transferencia,
} from '../domain/balances.js';
import type {
  GrupoDetalle,
  GrupoRepository,
  Rol,
  SaldoProvider,
  UsuarioRef,
} from '../domain/grupo.js';
import { AppError } from '../lib/errors.js';
import { centsToMoney, formatARS } from '../lib/money.js';
import { hoyEnBuenosAires, sinPermiso } from './gasto.service.js';
import { grupoArchivado, soloAdmin, type GrupoService } from './grupo.service.js';

const regla = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);

/** RN-12 y `miBalance`: el saldo real de un miembro, calculado de los gastos y pagos. */
export function createSaldoProvider(balances: BalanceRepository): SaldoProvider {
  return {
    async saldoDe(grupoId, usuarioId) {
      return calcularBalances(await balances.aportes(grupoId)).get(usuarioId) ?? 0;
    },
  };
}

export type BalanceService = {
  balances(actorId: string, grupoId: string): Promise<Balance[]>;
  liquidacion(actorId: string, grupoId: string): Promise<Transferencia[]>;
  archivar(actorId: string, grupoId: string): Promise<GrupoDetalle>;
  listarPagos(actorId: string, grupoId: string): Promise<Pago[]>;
  crearPago(
    actorId: string,
    grupoId: string,
    body: { de: string; a: string; monto: number; fecha: string },
  ): Promise<Pago>;
  eliminarPago(actorId: string, grupoId: string, pagoId: string): Promise<void>;
};

export function createBalanceService(deps: {
  grupoService: GrupoService;
  grupos: GrupoRepository;
  balances: BalanceRepository;
  pagos: PagoRepository;
  hoy?: () => string;
}): BalanceService {
  const { grupoService, grupos, balances, pagos, hoy = hoyEnBuenosAires } = deps;

  /** Balance de cada miembro: los activos siempre; los inactivos, solo si tienen saldo. */
  const calcular = async (grupoId: string) => {
    const [miembros, aportes] = await Promise.all([
      grupos.miembros(grupoId),
      balances.aportes(grupoId),
    ]);
    const saldos = calcularBalances(aportes);
    const filas = miembros
      .map((m) => ({ m, b: saldos.get(m.id) ?? 0 }))
      .filter(({ m, b }) => m.activo || b !== 0);
    const refs = new Map<string, UsuarioRef>(
      miembros.map((m) => [m.id, { id: m.id, nombre: m.nombre }]),
    );
    return {
      filas,
      saldos,
      refs,
      activos: new Set(miembros.filter((m) => m.activo).map((m) => m.id)),
    };
  };

  const puede = (p: PagoRow, actorId: string, rol: Rol) =>
    p.creadoPor.id === actorId || rol === 'ADMIN';
  const aPago = (p: PagoRow, actorId: string, rol: Rol, archivado: boolean): Pago => ({
    id: p.id,
    de: p.de,
    a: p.a,
    monto: centsToMoney(p.montoCentavos),
    fecha: p.fecha,
    creadoPor: p.creadoPor,
    puedeEliminar: puede(p, actorId, rol) && !archivado,
  });

  return {
    async balances(actorId, grupoId) {
      await grupoService.contexto(actorId, grupoId);
      const { filas } = await calcular(grupoId);
      return filas.map(({ m, b }) => ({
        usuario: { id: m.id, nombre: m.nombre },
        balance: centsToMoney(b),
      }));
    },

    async liquidacion(actorId, grupoId) {
      await grupoService.contexto(actorId, grupoId);
      const { saldos, refs } = await calcular(grupoId);
      const ref = (id: string) => refs.get(id) ?? { id, nombre: '?' };
      return liquidar(saldos).map((t) => ({
        de: ref(t.de),
        a: ref(t.a),
        monto: centsToMoney(t.monto),
      }));
    },

    async archivar(actorId, grupoId) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      if (rol !== 'ADMIN') throw soloAdmin();
      if (grupo.archivado) throw grupoArchivado();
      const { saldos } = await calcular(grupoId);
      if ([...saldos.values()].some((b) => b !== 0))
        // RN-14
        throw new AppError(409, 'SALDOS_PENDIENTES', 'No se puede archivar: hay saldos pendientes');
      await grupos.actualizar(grupoId, { archivado: true });
      return grupoService.detalle(actorId, grupoId);
    },

    async listarPagos(actorId, grupoId) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      return (await pagos.listar(grupoId)).map((p) => aPago(p, actorId, rol, grupo.archivado));
    },

    async crearPago(actorId, grupoId, { de, a, monto, fecha }) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      if (grupo.archivado) throw grupoArchivado(); // RN-15
      if (fecha > hoy()) throw regla('FECHA_FUTURA', 'La fecha no puede ser futura'); // RN-07
      if (de === a)
        throw regla('MISMO_USUARIO', 'Quien paga y quien recibe tienen que ser personas distintas'); // RN-09
      const { saldos, activos } = await calcular(grupoId);
      if (!activos.has(de) || !activos.has(a))
        throw regla(
          'PARTICIPANTES_INVALIDOS',
          'Quien paga y quien recibe tienen que ser miembros activos del grupo',
        );
      // RN-10: ni más de lo que debe quien paga, ni más de lo que le deben a quien recibe
      const maximo = Math.max(0, Math.min(-(saldos.get(de) ?? 0), saldos.get(a) ?? 0));
      if (monto > maximo)
        throw regla('PAGO_EXCEDE_DEUDA', `El pago no puede superar ${formatARS(maximo)}`, {
          maximo: centsToMoney(maximo),
        });
      const p = await pagos.crear(grupoId, actorId, {
        deId: de,
        aId: a,
        montoCentavos: monto,
        fecha,
      });
      return aPago(p, actorId, rol, false);
    },

    async eliminarPago(actorId, grupoId, pagoId) {
      const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
      const p = await pagos.buscar(grupoId, pagoId);
      if (!p) throw new AppError(404, 'PAGO_NO_ENCONTRADO', 'Este pago no existe');
      if (grupo.archivado) throw grupoArchivado();
      if (!puede(p, actorId, rol)) throw sinPermiso();
      await pagos.eliminar(pagoId);
    },
  };
}
