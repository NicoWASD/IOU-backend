import type { GrupoRepository } from '../domain/grupo.js';
import type { Invitacion, InvitacionRepository } from '../domain/invitacion.js';
import type { UsuarioBuscado, UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';
import { grupoArchivado as archivado, soloAdmin, type GrupoService } from './grupo.service.js';
const noEncontrada = () =>
  new AppError(404, 'INVITACION_NO_ENCONTRADA', 'La invitación no existe o ya fue respondida');

export type InvitacionService = {
  buscar(actorId: string, q: string, grupoId?: string): Promise<UsuarioBuscado[]>;
  invitar(actorId: string, grupoId: string, usuarioId: string): Promise<Invitacion>;
  pendientesDeGrupo(actorId: string, grupoId: string): Promise<Invitacion[]>;
  cancelar(actorId: string, grupoId: string, invitacionId: string): Promise<void>;
  mias(actorId: string): Promise<Invitacion[]>;
  aceptar(actorId: string, invitacionId: string): Promise<{ grupoId: string }>;
  rechazar(actorId: string, invitacionId: string): Promise<void>;
};

/** HU-32 y HU-33 (RN-20). Permiso antes que estado: 404 → 403 → 409. */
export function createInvitacionService(deps: {
  grupoService: Pick<GrupoService, 'contexto'>;
  grupos: Pick<GrupoRepository, 'membresia' | 'buscar'>;
  usuarios: Pick<UsuarioRepository, 'buscar' | 'findById'>;
  invitaciones: InvitacionRepository;
}): InvitacionService {
  const { grupoService, grupos, usuarios, invitaciones } = deps;

  const comoAdmin = async (actorId: string, grupoId: string, escritura: boolean) => {
    const { grupo, rol } = await grupoService.contexto(actorId, grupoId);
    if (rol !== 'ADMIN') throw soloAdmin();
    if (escritura && grupo.archivado) throw archivado();
  };
  /** Solo el invitado ve su invitación pendiente; para el resto no existe. */
  const mia = async (actorId: string, id: string) => {
    const inv = await invitaciones.buscar(id);
    if (!inv || inv.invitadoId !== actorId || inv.estado !== 'PENDIENTE') throw noEncontrada();
    return inv;
  };

  return {
    async buscar(actorId, q, grupoId) {
      if (grupoId) await grupoService.contexto(actorId, grupoId); // RN-16
      return usuarios.buscar(q, { excluirId: actorId, ...(grupoId && { grupoId }) });
    },

    async invitar(actorId, grupoId, usuarioId) {
      await comoAdmin(actorId, grupoId, true);
      const invitado = await usuarios.findById(usuarioId);
      if (!invitado)
        throw new AppError(404, 'USUARIO_NO_ENCONTRADO', 'No encontramos a ese usuario');
      if ((await grupos.membresia(grupoId, usuarioId))?.activo)
        throw new AppError(409, 'YA_ES_MIEMBRO', 'Ya es miembro del grupo');
      if (await invitaciones.hayPendiente(grupoId, usuarioId))
        throw new AppError(409, 'YA_INVITADO', `Ya invitaste a @${invitado.usuario}`);
      return invitaciones.crear({ grupoId, invitadoId: usuarioId, invitadorId: actorId });
    },

    async pendientesDeGrupo(actorId, grupoId) {
      await comoAdmin(actorId, grupoId, false);
      return invitaciones.pendientesDeGrupo(grupoId);
    },

    async cancelar(actorId, grupoId, invitacionId) {
      await comoAdmin(actorId, grupoId, false);
      const inv = await invitaciones.buscar(invitacionId);
      if (!inv || inv.grupoId !== grupoId || inv.estado !== 'PENDIENTE') throw noEncontrada();
      if (!(await invitaciones.cerrar(inv.id, 'CANCELADA'))) throw noEncontrada();
    },

    mias: (actorId) => invitaciones.pendientesDe(actorId),

    async aceptar(actorId, invitacionId) {
      const inv = await mia(actorId, invitacionId);
      if ((await grupos.buscar(inv.grupoId))?.archivado) throw archivado(); // CB-16
      // Doble clic: la segunda llamada ya no la encuentra pendiente
      if (!(await invitaciones.aceptar(inv))) throw noEncontrada();
      return { grupoId: inv.grupoId };
    },

    async rechazar(actorId, invitacionId) {
      const inv = await mia(actorId, invitacionId);
      if (!(await invitaciones.cerrar(inv.id, 'RECHAZADA'))) throw noEncontrada();
    },
  };
}
