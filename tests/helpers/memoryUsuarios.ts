import { randomUUID } from 'node:crypto';
import type { UsuarioConHash, UsuarioRepository } from '../../src/domain/usuario.js';
import { AppError } from '../../src/lib/errors.js';

/** Repositorio en memoria con la misma unicidad de email y usuario que la base. */
export function createMemoryUsuarioRepository(
  esMiembroActivo: (grupoId: string, usuarioId: string) => boolean = () => false,
): UsuarioRepository & {
  all(): UsuarioConHash[];
  /** Lo conecta testApp cuando ya existe el repo de grupos. */
  setMiembroActivo(f: (grupoId: string, usuarioId: string) => boolean): void;
} {
  const rows: UsuarioConHash[] = [];
  let miembroActivo = esMiembroActivo;
  const pick = ({ passwordHash: _h, ...u }: UsuarioConHash) => u;
  const enUso = (campo: 'email' | 'usuario') =>
    campo === 'email'
      ? new AppError(409, 'EMAIL_EN_USO', 'El email ya está en uso')
      : new AppError(409, 'USUARIO_EN_USO', 'Ese nombre de usuario ya está en uso');
  return {
    all: () => [...rows],
    setMiembroActivo: (f) => {
      miembroActivo = f;
    },
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findById(id) {
      const r = rows.find((x) => x.id === id);
      return r ? pick(r) : null;
    },
    async create(data) {
      if (rows.some((r) => r.email === data.email)) throw enUso('email');
      if (rows.some((r) => r.usuario === data.usuario)) throw enUso('usuario');
      const row: UsuarioConHash = {
        id: randomUUID(),
        nombreReal: null,
        apellido: null,
        tutorialVisto: false,
        ...data,
      };
      rows.push(row);
      return pick(row);
    },
    async actualizar(id, d) {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error('Usuario inexistente');
      if (d.usuario && rows.some((r) => r.usuario === d.usuario && r.id !== id))
        throw enUso('usuario');
      Object.assign(row, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
      return pick(row);
    },
    async buscar(q, { excluirId, grupoId }) {
      return rows
        .filter(
          (r) =>
            r.usuario.startsWith(q) &&
            r.id !== excluirId &&
            !(grupoId && miembroActivo(grupoId, r.id)),
        )
        .sort((a, b) => a.usuario.localeCompare(b.usuario))
        .slice(0, 8)
        .map(({ id, nombre, usuario }) => ({ id, nombre, usuario }));
    },
  };
}
