import type { UsuarioRef } from './grupo.js';
import type { UsuarioBuscado } from './usuario.js';

export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA';

export type Invitacion = {
  id: string;
  grupo: { id: string; nombre: string };
  invitado: UsuarioBuscado;
  invitadoPor: UsuarioRef;
  createdAt: Date;
};

export type InvitacionFila = {
  id: string;
  grupoId: string;
  invitadoId: string;
  estado: EstadoInvitacion;
};

export interface InvitacionRepository {
  /** Tira AppError 409 YA_INVITADO si ya hay una pendiente (índice único parcial). */
  crear(d: { grupoId: string; invitadoId: string; invitadorId: string }): Promise<Invitacion>;
  hayPendiente(grupoId: string, invitadoId: string): Promise<boolean>;
  /** `null` si no existe (o si el id no es un UUID). */
  buscar(id: string): Promise<InvitacionFila | null>;
  pendientesDeGrupo(grupoId: string): Promise<Invitacion[]>;
  pendientesDe(usuarioId: string): Promise<Invitacion[]>;
  /** Cambia el estado solo si sigue PENDIENTE. `false` si ya no lo estaba. */
  cerrar(id: string, estado: 'RECHAZADA' | 'CANCELADA'): Promise<boolean>;
  /** En una transacción: ACEPTADA + alta o reactivación de la membresía. `false` si ya no estaba pendiente. */
  aceptar(inv: InvitacionFila): Promise<boolean>;
}
