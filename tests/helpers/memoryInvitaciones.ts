import { randomUUID } from 'node:crypto';
import type { GrupoRepository } from '../../src/domain/grupo.js';
import type {
  EstadoInvitacion,
  Invitacion,
  InvitacionRepository,
} from '../../src/domain/invitacion.js';
import type { MedioCobro, MedioRepository } from '../../src/domain/medio.js';
import type { UsuarioConHash } from '../../src/domain/usuario.js';

type Fila = {
  id: string;
  grupoId: string;
  invitadoId: string;
  invitadorId: string;
  estado: EstadoInvitacion;
  createdAt: Date;
};

/** Invitaciones en memoria; aceptar usa el repo de grupos en memoria (alta o reactivación). */
export function createMemoryInvitacionRepository(
  usuarios: { all(): UsuarioConHash[] },
  grupos: GrupoRepository,
): InvitacionRepository {
  const filas: Fila[] = [];
  const u = (id: string) => {
    const x = usuarios.all().find((r) => r.id === id);
    if (!x) throw new Error(`Usuario inexistente: ${id}`);
    return x;
  };
  const vista = async (f: Fila): Promise<Invitacion> => {
    const g = await grupos.buscar(f.grupoId);
    const inv = u(f.invitadoId);
    return {
      id: f.id,
      grupo: { id: f.grupoId, nombre: g?.nombre ?? '' },
      invitado: { id: inv.id, nombre: inv.nombre, usuario: inv.usuario },
      invitadoPor: { id: f.invitadorId, nombre: u(f.invitadorId).nombre },
      createdAt: f.createdAt,
    };
  };
  const pendiente = (id: string) => filas.find((f) => f.id === id && f.estado === 'PENDIENTE');

  return {
    async crear(d) {
      const f: Fila = { id: randomUUID(), ...d, estado: 'PENDIENTE', createdAt: new Date() };
      filas.push(f);
      return vista(f);
    },
    async hayPendiente(grupoId, invitadoId) {
      return filas.some(
        (f) => f.grupoId === grupoId && f.invitadoId === invitadoId && f.estado === 'PENDIENTE',
      );
    },
    async buscar(id) {
      const f = filas.find((x) => x.id === id);
      return f
        ? { id: f.id, grupoId: f.grupoId, invitadoId: f.invitadoId, estado: f.estado }
        : null;
    },
    async pendientesDeGrupo(grupoId) {
      return Promise.all(
        filas.filter((f) => f.grupoId === grupoId && f.estado === 'PENDIENTE').map(vista),
      );
    },
    async pendientesDe(usuarioId) {
      return Promise.all(
        filas.filter((f) => f.invitadoId === usuarioId && f.estado === 'PENDIENTE').map(vista),
      );
    },
    async cerrar(id, estado) {
      const f = pendiente(id);
      if (!f) return false;
      f.estado = estado;
      return true;
    },
    async aceptar({ id, grupoId, invitadoId }) {
      const f = pendiente(id);
      if (!f) return false;
      f.estado = 'ACEPTADA';
      if (await grupos.membresia(grupoId, invitadoId))
        await grupos.reactivarMiembro(grupoId, invitadoId);
      else await grupos.agregarMiembro(grupoId, invitadoId);
      return true;
    },
  };
}

export function createMemoryMedioRepository(): MedioRepository {
  const porUsuario = new Map<string, MedioCobro[]>();
  return {
    async listar(usuarioId) {
      return [...(porUsuario.get(usuarioId) ?? [])];
    },
    async reemplazar(usuarioId, medios) {
      porUsuario.set(
        usuarioId,
        medios.map((m) => ({ ...m, nota: m.nota ?? null })),
      );
      return [...(porUsuario.get(usuarioId) ?? [])];
    },
  };
}
