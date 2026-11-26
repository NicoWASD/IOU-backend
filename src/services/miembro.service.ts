import type { GrupoRepository, GrupoRow, Miembro, Rol, SaldoProvider } from '../domain/grupo.js';
import type { UsuarioRepository } from '../domain/usuario.js';
import { AppError } from '../lib/errors.js';
import { centsToMoney, formatARS } from '../lib/money.js';
import { grupoArchivado, soloAdmin, type GrupoService } from './grupo.service.js';

const usuarioNoEncontrado = () =>
  new AppError(404, 'USUARIO_NO_ENCONTRADO', 'No existe un usuario con ese email');
const yaEsMiembro = () => new AppError(409, 'YA_ES_MIEMBRO', 'Ya es miembro del grupo');
const miembroNoEncontrado = () =>
  new AppError(404, 'MIEMBRO_NO_ENCONTRADO', 'Esa persona no es miembro del grupo');
const adminNoPuedeSalir = () =>
  new AppError(409, 'ADMIN_NO_PUEDE_SALIR', 'El admin no puede quitarse del grupo');
const saldoPendiente = (nombre: string, saldo: number) =>
  new AppError(
    409,
    'SALDO_PENDIENTE',
    `No se puede quitar a ${nombre}: tiene saldo pendiente de ${formatARS(Math.abs(saldo))}`,
    { saldo: centsToMoney(saldo) },
  );

export type MiembroService = {
  listar(actorId: string, grupoId: string): Promise<Miembro[]>;
  agregar(actorId: string, grupoId: string, email: string): Promise<Miembro>;
  quitar(actorId: string, grupoId: string, usuarioId: string): Promise<void>;
};

/** Permiso antes que estado: 404 (no miembro) → 403 (no admin) → 409 (archivado). */
const exigirAdminEnGrupoActivo = ({ grupo, rol }: { grupo: GrupoRow; rol: Rol }) => {
  if (rol !== 'ADMIN') throw soloAdmin(); // RN-11
  if (grupo.archivado) throw grupoArchivado(); // RN-15
};

export function createMiembroService(deps: {
  grupoService: Pick<GrupoService, 'contexto'>;
  grupos: GrupoRepository;
  usuarios: Pick<UsuarioRepository, 'findByEmail'>;
  saldos: SaldoProvider;
}): MiembroService {
  const { grupoService, grupos, usuarios, saldos } = deps;

  return {
    async listar(actorId, grupoId) {
      await grupoService.contexto(actorId, grupoId);
      return grupos.miembros(grupoId);
    },

    async agregar(actorId, grupoId, email) {
      exigirAdminEnGrupoActivo(await grupoService.contexto(actorId, grupoId));
      const usuario = await usuarios.findByEmail(email.trim().toLowerCase());
      if (!usuario) throw usuarioNoEncontrado();
      const membresia = await grupos.membresia(grupoId, usuario.id);
      if (membresia?.activo) throw yaEsMiembro(); // también cubre agregarse a uno mismo
      // CB-14: si había sido quitado, se reactiva la misma membresía
      return membresia
        ? grupos.reactivarMiembro(grupoId, usuario.id)
        : grupos.agregarMiembro(grupoId, usuario.id);
    },

    async quitar(actorId, grupoId, usuarioId) {
      exigirAdminEnGrupoActivo(await grupoService.contexto(actorId, grupoId));
      const membresia = await grupos.membresia(grupoId, usuarioId);
      if (!membresia?.activo) throw miembroNoEncontrado();
      if (usuarioId === actorId) throw adminNoPuedeSalir(); // RN-13
      const saldo = await saldos.saldoDe(grupoId, usuarioId);
      if (saldo !== 0) {
        // M5: el mensaje nombra a la persona
        const nombre = (await grupos.miembros(grupoId)).find((m) => m.id === usuarioId)?.nombre;
        throw saldoPendiente(nombre ?? 'esta persona', saldo); // RN-12, CB-09
      }
      await grupos.desactivarMiembro(grupoId, usuarioId);
    },
  };
}
