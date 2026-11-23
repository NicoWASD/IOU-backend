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

export const registerSchema = z.object({
  nombre: z
    .string({ error: 'Ingresá tu nombre' })
    .trim()
    .min(1, 'Ingresá tu nombre')
    .max(80, 'El nombre puede tener hasta 80 caracteres'),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
