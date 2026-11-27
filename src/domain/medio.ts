export const PLATAFORMAS = ['MERCADO_PAGO', 'UALA', 'BRUBANK', 'BANCO', 'OTRO'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];
export type MedioCobro = { plataforma: Plataforma; valor: string; nota: string | null };

/** RN-21 */
export const MAX_MEDIOS = 5;

export interface MedioRepository {
  /** En el orden en que se cargaron. */
  listar(usuarioId: string): Promise<MedioCobro[]>;
  /** Reemplaza la lista completa en una transacción. */
  reemplazar(usuarioId: string, medios: MedioCobro[]): Promise<MedioCobro[]>;
}
