export type Usuario = { id: string; nombre: string; email: string };
export type UsuarioConHash = Usuario & { passwordHash: string };

export interface UsuarioRepository {
  findByEmail(email: string): Promise<UsuarioConHash | null>;
  findById(id: string): Promise<Usuario | null>;
  /** Tira AppError 409 EMAIL_EN_USO si el email ya existe. */
  create(data: { nombre: string; email: string; passwordHash: string }): Promise<Usuario>;
}
