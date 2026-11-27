import { z } from 'zod';
import { PLATAFORMAS } from '../domain/medio.js';

export const invitarSchema = z.object({
  usuarioId: z.string({ error: 'Elegí a quién invitar' }).min(1, 'Elegí a quién invitar'),
});

const medio = z.object({
  plataforma: z.enum(PLATAFORMAS, { error: 'Elegí una plataforma' }),
  valor: z
    .string({ error: 'Ingresá el alias o CVU' })
    .trim()
    .min(1, 'Ingresá el alias o CVU')
    .max(60, 'Puede tener hasta 60 caracteres'),
  nota: z
    .string()
    .trim()
    .max(60, 'La nota puede tener hasta 60 caracteres')
    .transform((s) => s || null)
    .nullable()
    .optional()
    .transform((s) => s ?? null),
});

/** El tope de 5 (RN-21) lo aplica el service; acá solo se corta lo absurdo. */
export const mediosSchema = z.object({ medios: z.array(medio).max(20) });

export type InvitarBody = z.infer<typeof invitarSchema>;
export type MediosBody = z.infer<typeof mediosSchema>;
