import { z } from 'zod';

const corsList = z
  .string()
  .transform((raw) =>
    raw
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  )
  .pipe(z.array(z.string()).min(1, 'tiene que tener al menos un origen'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ message: 'tiene que ser una URL de conexión válida' }),
  DIRECT_URL: z.url().optional(),
  CORS_ORIGIN: corsList,
});

export type Env = z.infer<typeof schema>;

/** Valida las variables de entorno. Tira un Error que nombra cada variable inválida. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${detail}`);
  }
  return parsed.data;
}
