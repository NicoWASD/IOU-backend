import type { GrupoRepository } from '../domain/grupo.js';
import { MAX_MEDIOS, type MedioCobro, type MedioRepository } from '../domain/medio.js';
import { AppError } from '../lib/errors.js';

export type MedioService = {
  mios(actorId: string): Promise<MedioCobro[]>;
  reemplazar(actorId: string, medios: MedioCobro[]): Promise<MedioCobro[]>;
  deUsuario(actorId: string, usuarioId: string): Promise<MedioCobro[]>;
};

/** HU-35 (RN-21, RN-22). */
export function createMedioService(deps: {
  medios: MedioRepository;
  grupos: Pick<GrupoRepository, 'compartenGrupoActivo'>;
}): MedioService {
  const { medios, grupos } = deps;
  return {
    mios: (actorId) => medios.listar(actorId),

    async reemplazar(actorId, lista) {
      if (lista.length > MAX_MEDIOS)
        throw new AppError(
          422,
          'DEMASIADOS_MEDIOS',
          `Podés cargar hasta ${MAX_MEDIOS} medios de cobro`,
        );
      return medios.reemplazar(actorId, lista);
    },

    async deUsuario(actorId, usuarioId) {
      // RN-22: sin un grupo activo en común, la persona "no existe" para el actor
      if (usuarioId !== actorId && !(await grupos.compartenGrupoActivo(actorId, usuarioId)))
        throw new AppError(404, 'USUARIO_NO_ENCONTRADO', 'No encontramos a ese usuario');
      return medios.listar(usuarioId);
    },
  };
}
