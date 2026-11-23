import { z } from 'zod';
import { emailSchema } from './auth.schemas.js';

const MENSAJE_NOMBRE = 'Poné un nombre de hasta 60 caracteres';

const nombre = z
  .string({ error: MENSAJE_NOMBRE })
  .trim()
  .min(1, MENSAJE_NOMBRE)
  .max(60, MENSAJE_NOMBRE);

/** Trim, hasta 200; vacía (o `null`) pasa a ser `null`. */
const descripcion = z
  .string({ error: 'La descripción tiene que ser un texto' })
  .trim()
  .max(200, 'La descripción puede tener hasta 200 caracteres')
  .nullable()
  .transform((d) => (d ? d : null));

export const crearGrupoSchema = z.object({
  nombre,
  descripcion: descripcion.optional(),
});

export const editarGrupoSchema = z.object({
  nombre: nombre.optional(),
  descripcion: descripcion.optional(),
});

export const agregarMiembroSchema = z.object({
  email: emailSchema('Ingresá el email de la persona'),
});

export type CrearGrupoBody = z.infer<typeof crearGrupoSchema>;
export type EditarGrupoBody = z.infer<typeof editarGrupoSchema>;
export type AgregarMiembroBody = z.infer<typeof agregarMiembroSchema>;
