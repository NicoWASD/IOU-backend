import type {
  GrupoDetalle,
  GrupoRepository,
  GrupoResumen,
  GrupoRow,
  Rol,
  SaldoProvider,
} from '../domain/grupo.js';
import { AppError } from '../lib/errors.js';
import { centsToMoney } from '../lib/money.js';

export const grupoNoEncontrado = () =>
  new AppError(404, 'GRUPO_NO_ENCONTRADO', 'Este grupo no existe o no sos parte');
export const soloAdmin = () =>
  new AppError(403, 'SOLO_ADMIN', 'Solo el admin del grupo puede hacer esto');
export const grupoArchivado = () =>
  new AppError(409, 'GRUPO_ARCHIVADO', 'El grupo está archivado: solo se puede consultar');

/** Saldo siempre en 0 hasta que el H4 calcule los balances reales. */
export const ceroSaldos: SaldoProvider = { saldoDe: async () => 0 };

export type CrearGrupoInput = { nombre: string; descripcion?: string | null };
export type EditarGrupoInput = { nombre?: string; descripcion?: string | null };

export type GrupoService = {
  listar(actorId: string): Promise<GrupoResumen[]>;
  crear(actorId: string, input: CrearGrupoInput): Promise<GrupoDetalle>;
  detalle(actorId: string, grupoId: string): Promise<GrupoDetalle>;
  editar(actorId: string, grupoId: string, input: EditarGrupoInput): Promise<GrupoDetalle>;
  /** Grupo y rol del actor. Tira GRUPO_NO_ENCONTRADO si no existe o el actor no es miembro activo. */
  contexto(actorId: string, grupoId: string): Promise<{ grupo: GrupoRow; rol: Rol }>;
};

/** Recibe datos ya validados y normalizados por el schema de la ruta. */
export function createGrupoService(deps: {
  grupos: GrupoRepository;
  saldos: SaldoProvider;
}): GrupoService {
  const { grupos, saldos } = deps;

  const contexto: GrupoService['contexto'] = async (actorId, grupoId) => {
    const grupo = await grupos.buscar(grupoId);
    const membresia = grupo ? await grupos.membresia(grupoId, actorId) : null;
    // RN-16: un no miembro (o uno dado de baja) no se entera de que el grupo existe
    if (!grupo || !membresia?.activo) throw grupoNoEncontrado();
    return { grupo, rol: membresia.rol };
  };

  const aDetalle = async (grupo: GrupoRow, miRol: Rol): Promise<GrupoDetalle> => ({
    id: grupo.id,
    nombre: grupo.nombre,
    descripcion: grupo.descripcion,
    moneda: grupo.moneda,
    archivado: grupo.archivado,
    creadoPor: grupo.creadoPor,
    miRol,
    createdAt: grupo.createdAt.toISOString(),
    miembros: await grupos.miembros(grupo.id),
  });

  return {
    contexto,

    async listar(actorId) {
      const filas = await grupos.listarDeUsuario(actorId);
      const ordenadas = [...filas].sort(
        (a, b) =>
          Number(a.archivado) - Number(b.archivado) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
      return Promise.all(
        ordenadas.map(async (g) => ({
          id: g.id,
          nombre: g.nombre,
          descripcion: g.descripcion,
          archivado: g.archivado,
          miembros: g.miembrosActivos,
          miBalance: centsToMoney(await saldos.saldoDe(g.id, actorId)),
        })),
      );
    },

    async crear(actorId, { nombre, descripcion }) {
      const grupo = await grupos.crear({
        nombre,
        descripcion: descripcion ?? null,
        creadoPorId: actorId,
      });
      return aDetalle(grupo, 'ADMIN');
    },

    async detalle(actorId, grupoId) {
      const { grupo, rol } = await contexto(actorId, grupoId);
      return aDetalle(grupo, rol);
    },

    async editar(actorId, grupoId, input) {
      const { rol, grupo } = await contexto(actorId, grupoId);
      if (rol !== 'ADMIN') throw soloAdmin();
      if (grupo.archivado) throw grupoArchivado(); // RN-15
      const cambios: EditarGrupoInput = {};
      if (input.nombre !== undefined) cambios.nombre = input.nombre;
      if (input.descripcion !== undefined) cambios.descripcion = input.descripcion;
      const actualizado = await grupos.actualizar(grupoId, cambios);
      return aDetalle(actualizado, rol);
    },
  };
}
