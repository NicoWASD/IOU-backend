import { randomUUID } from 'node:crypto';
import type { UsuarioConHash, UsuarioRepository } from '../../src/domain/usuario.js';
import { AppError } from '../../src/lib/errors.js';

/** Repositorio en memoria con la misma unicidad de email que la base. */
export function createMemoryUsuarioRepository(): UsuarioRepository & { all(): UsuarioConHash[] } {
  const rows: UsuarioConHash[] = [];
  const pick = ({ id, nombre, email }: UsuarioConHash) => ({ id, nombre, email });
  return {
    all: () => [...rows],
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async findById(id) {
      const r = rows.find((x) => x.id === id);
      return r ? pick(r) : null;
    },
    async create(data) {
      if (rows.some((r) => r.email === data.email)) {
        throw new AppError(409, 'EMAIL_EN_USO', 'El email ya está en uso');
      }
      const row = { id: randomUUID(), ...data };
      rows.push(row);
      return pick(row);
    },
  };
}
