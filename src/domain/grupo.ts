// Tipos de grupos y miembros. Los de la API son idénticos a los de docs/api-contract.md (H2).

export type Money = string;
export type Rol = 'ADMIN' | 'MIEMBRO';
export type UsuarioRef = { id: string; nombre: string };

export type Miembro = UsuarioRef & { email: string; rol: Rol; activo: boolean };

export type GrupoResumen = {
  id: string;
  nombre: string;
  descripcion: string | null;
  archivado: boolean;
  miembros: UsuarioRef[]; // activos, para los avatares
  miBalance: Money; // "0.00" hasta el H4
};

export type GrupoDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  moneda: 'ARS';
  archivado: boolean;
  creadoPor: UsuarioRef;
  miRol: Rol;
  createdAt: string;
  miembros: Miembro[]; // activos e inactivos
};

export type GrupoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  moneda: 'ARS';
  archivado: boolean;
  creadoPor: UsuarioRef;
  createdAt: Date;
};

export interface GrupoRepository {
  /** Crea el grupo y al creador como ADMIN en la misma transacción. */
  crear(d: { nombre: string; descripcion: string | null; creadoPorId: string }): Promise<GrupoRow>;
  /** Solo los grupos donde el usuario es miembro activo. */
  listarDeUsuario(usuarioId: string): Promise<(GrupoRow & { miembrosActivos: UsuarioRef[] })[]>;
  /** `null` si no existe (o si el id no es un UUID). */
  buscar(grupoId: string): Promise<GrupoRow | null>;
  membresia(grupoId: string, usuarioId: string): Promise<{ rol: Rol; activo: boolean } | null>;
  /** Activos e inactivos, por fecha de alta. */
  miembros(grupoId: string): Promise<Miembro[]>;
  actualizar(
    grupoId: string,
    d: { nombre?: string; descripcion?: string | null; archivado?: boolean },
  ): Promise<GrupoRow>;
  /** Alta como MIEMBRO activo. Tira AppError 409 YA_ES_MIEMBRO si la membresía ya existe. */
  agregarMiembro(grupoId: string, usuarioId: string): Promise<Miembro>;
  /** Vuelve a activar una membresía existente, sin duplicarla (CB-14). */
  reactivarMiembro(grupoId: string, usuarioId: string): Promise<Miembro>;
  /** Baja lógica: `activo = false`. */
  desactivarMiembro(grupoId: string, usuarioId: string): Promise<void>;
  /** RN-22: ¿hay un grupo donde los dos son miembros activos? */
  compartenGrupoActivo(a: string, b: string): Promise<boolean>;
}

/** Saldo de un miembro en el grupo, en centavos. */
export interface SaldoProvider {
  saldoDe(grupoId: string, usuarioId: string): Promise<number>;
}
