/** Perfil del usuario (RN-19). `nombre` es el nombre visible que usa el resto de la app. */
export type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  email: string;
  nombreReal: string | null;
  apellido: string | null;
  tutorialVisto: boolean;
};
export type UsuarioConHash = Usuario & { passwordHash: string };
export type UsuarioBuscado = { id: string; nombre: string; usuario: string };

export type CambiosPerfil = {
  usuario?: string;
  nombreReal?: string | null;
  apellido?: string | null;
  tutorialVisto?: boolean;
};

/** RN-19: «Nombre Apellido» si los cargó; si no, el usuario. */
export const nombreVisible = (u: {
  usuario: string;
  nombreReal: string | null;
  apellido: string | null;
}) => [u.nombreReal, u.apellido].filter(Boolean).join(' ') || u.usuario;

export interface UsuarioRepository {
  findByEmail(email: string): Promise<UsuarioConHash | null>;
  findById(id: string): Promise<Usuario | null>;
  /** Tira AppError 409 EMAIL_EN_USO o USUARIO_EN_USO si ya existen. */
  create(data: {
    nombre: string;
    usuario: string;
    email: string;
    passwordHash: string;
  }): Promise<Usuario>;
  /** Tira AppError 409 USUARIO_EN_USO. */
  actualizar(id: string, d: CambiosPerfil & { nombre: string }): Promise<Usuario>;
  /** Por prefijo del usuario, sin el actor ni los miembros activos de `grupoId`. Máx. 8. */
  buscar(q: string, opts: { excluirId: string; grupoId?: string }): Promise<UsuarioBuscado[]>;
}
