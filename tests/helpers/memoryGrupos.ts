import { randomUUID } from 'node:crypto';
import type { GrupoRepository, GrupoRow, Rol, UsuarioRef } from '../../src/domain/grupo.js';
import type { UsuarioConHash } from '../../src/domain/usuario.js';

type GrupoFila = Omit<GrupoRow, 'creadoPor'> & { creadoPorId: string };
type MiembroFila = {
  grupoId: string;
  usuarioId: string;
  rol: Rol;
  activo: boolean;
  fechaAlta: Date;
};

/**
 * Repositorio de grupos en memoria. Lee los usuarios del repositorio de usuarios en memoria.
 * Imita la PK compuesta (grupo, usuario) de `miembros_grupo`.
 */
export function createMemoryGrupoRepository(usuarios: { all(): UsuarioConHash[] }) {
  const grupos: GrupoFila[] = [];
  const miembros: MiembroFila[] = [];
  // Reloj que avanza 1 s por operación, para que el orden por fecha sea determinista
  let tick = Date.parse('2026-01-01T00:00:00Z');
  const ahora = () => new Date((tick += 1000));

  const usuario = (id: string) => {
    const u = usuarios.all().find((x) => x.id === id);
    if (!u) throw new Error(`Usuario inexistente: ${id}`);
    return u;
  };
  const ref = (id: string): UsuarioRef => ({ id, nombre: usuario(id).nombre });
  const toRow = ({ creadoPorId, ...g }: GrupoFila): GrupoRow => ({
    ...g,
    creadoPor: ref(creadoPorId),
  });
  const fila = (grupoId: string, usuarioId: string) =>
    miembros.find((m) => m.grupoId === grupoId && m.usuarioId === usuarioId);
  const insertarMiembro = (grupoId: string, usuarioId: string, rol: Rol, activo = true) => {
    if (fila(grupoId, usuarioId)) throw new Error('PK duplicada en miembros_grupo');
    miembros.push({ grupoId, usuarioId, rol, activo, fechaAlta: ahora() });
  };

  const repo: GrupoRepository = {
    async crear({ nombre, descripcion, creadoPorId }) {
      const g: GrupoFila = {
        id: randomUUID(),
        nombre,
        descripcion,
        moneda: 'ARS',
        archivado: false,
        creadoPorId,
        createdAt: ahora(),
      };
      grupos.push(g);
      insertarMiembro(g.id, creadoPorId, 'ADMIN');
      return toRow(g);
    },
    async listarDeUsuario(usuarioId) {
      return grupos
        .filter((g) => fila(g.id, usuarioId)?.activo === true)
        .map((g) => ({
          ...toRow(g),
          miembrosActivos: miembros
            .filter((m) => m.grupoId === g.id && m.activo)
            .map((m) => ref(m.usuarioId)),
        }));
    },
    async buscar(grupoId) {
      const g = grupos.find((x) => x.id === grupoId);
      return g ? toRow(g) : null;
    },
    async membresia(grupoId, usuarioId) {
      const m = fila(grupoId, usuarioId);
      return m ? { rol: m.rol, activo: m.activo } : null;
    },
    async miembros(grupoId) {
      return miembros
        .filter((m) => m.grupoId === grupoId)
        .map((m) => {
          const u = usuario(m.usuarioId);
          return { id: u.id, nombre: u.nombre, email: u.email, rol: m.rol, activo: m.activo };
        });
    },
    async actualizar(grupoId, d) {
      const g = grupos.find((x) => x.id === grupoId);
      if (!g) throw new Error(`Grupo inexistente: ${grupoId}`);
      if (d.nombre !== undefined) g.nombre = d.nombre;
      if (d.descripcion !== undefined) g.descripcion = d.descripcion;
      return toRow(g);
    },
  };

  return {
    ...repo,
    /** Solo para tests: fuerza el estado archivado (el archivado real llega en el H4). */
    archivar(grupoId: string) {
      const g = grupos.find((x) => x.id === grupoId);
      if (!g) throw new Error(`Grupo inexistente: ${grupoId}`);
      g.archivado = true;
    },
    /** Solo para tests: siembra una membresía con el rol y el estado que se pidan. */
    sembrarMiembro(grupoId: string, usuarioId: string, rol: Rol = 'MIEMBRO', activo = true) {
      insertarMiembro(grupoId, usuarioId, rol, activo);
    },
  };
}
