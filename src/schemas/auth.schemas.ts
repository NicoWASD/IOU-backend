import { z } from 'zod';

/** Email con las reglas del H1 (trim, minúsculas, hasta 120). `faltante` es el mensaje si no viene. */
export const emailSchema = (faltante = 'Ingresá tu email') =>
  z
    .string({ error: faltante })
    .trim()
    .toLowerCase()
    .max(120, 'El email puede tener hasta 120 caracteres')
    .pipe(z.email({ error: 'El email no es válido' }));

const email = emailSchema();

/** RN-19: 3 a 20 caracteres a-z 0-9 _ . (se guarda en minúsculas; acepta una @ adelante). */
export const usuarioSchema = z
  .string({ error: 'Elegí un nombre de usuario' })
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^@/, ''))
  .pipe(
    z
      .string()
      .min(3, 'El usuario tiene que tener al menos 3 caracteres')
      .max(20, 'El usuario puede tener hasta 20 caracteres')
      .regex(/^[a-z0-9_.]+$/, 'Usá solo letras, números, punto o guion bajo'),
  );

const textoOpcional = (campo: string) =>
  z
    .string()
    .trim()
    .max(40, `${campo} puede tener hasta 40 caracteres`)
    .transform((s) => s || null)
    .nullable()
    .optional();

export const registerSchema = z.object({
  usuario: usuarioSchema,
  email,
  password: z
    .string({ error: 'Ingresá una contraseña' })
    .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
    .max(72, 'La contraseña puede tener hasta 72 caracteres'),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Ingresá tu contraseña' }).min(1, 'Ingresá tu contraseña'),
});

export const perfilSchema = z.object({
  usuario: usuarioSchema.optional(),
  nombre: textoOpcional('El nombre'),
  apellido: textoOpcional('El apellido'),
  tutorialVisto: z.boolean().optional(),
});

export type PerfilInput = z.infer<typeof perfilSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
