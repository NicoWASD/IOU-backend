// Tipos de gastos. Los de la API son idénticos a los de docs/api-contract.md (H3).
import type { Money, UsuarioRef } from './grupo.js';

export type TipoDivision = 'IGUAL' | 'MONTOS' | 'PORCENTAJE';

export type Participacion = { usuario: UsuarioRef; monto: Money; porcentaje: string | null };

export type GastoResumen = {
  id: string;
  descripcion: string;
  monto: Money;
  fecha: string;
  tipoDivision: TipoDivision;
  pagadoPor: UsuarioRef;
  miParte: Money;
};

export type GastoDetalle = GastoResumen & {
  creadoPor: UsuarioRef;
  participaciones: Participacion[];
  puedeEditar: boolean;
  createdAt: string;
};

/** Participación guardada: centavos y porcentaje en centésimos (solo en PORCENTAJE). */
export type ParticipacionRow = { usuario: UsuarioRef; montoCentavos: number; pct: number | null };

export type GastoRow = {
  id: string;
  grupoId: string;
  descripcion: string;
  montoCentavos: number;
  fecha: string; // YYYY-MM-DD
  tipoDivision: TipoDivision;
  pagadoPor: UsuarioRef;
  creadoPor: UsuarioRef;
  createdAt: Date;
  participaciones: ParticipacionRow[];
};

export type GastoData = {
  descripcion: string;
  montoCentavos: number;
  fecha: string;
  pagadoPorId: string;
  tipoDivision: TipoDivision;
  participaciones: { usuarioId: string; montoCentavos: number; pct: number | null }[];
};

export interface GastoRepository {
  /** Por `fecha` desc y después `createdAt` desc. */
  listar(
    grupoId: string,
    page: { skip: number; take: number },
  ): Promise<{ filas: GastoRow[]; total: number }>;
  /** `null` si no existe en ese grupo (o si el id no es un UUID). */
  buscar(grupoId: string, gastoId: string): Promise<GastoRow | null>;
  crear(grupoId: string, creadoPorId: string, d: GastoData): Promise<GastoRow>;
  /** Reemplaza los datos y las participaciones en una transacción. */
  reemplazar(gastoId: string, d: GastoData): Promise<GastoRow>;
  eliminar(gastoId: string): Promise<void>;
}
