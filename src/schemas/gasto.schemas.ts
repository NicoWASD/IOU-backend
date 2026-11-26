import { z } from 'zod';
import { MONTO_MAXIMO_CENTAVOS, parseMoney, parsePorcentaje } from '../domain/reparto.js';

const MENSAJE_MONTO = 'Ingresá un monto mayor a 0, con hasta 2 decimales';

/** Money del contrato (`"12500.50"`) → centavos. */
export const montoPositivo = z.string({ error: MENSAJE_MONTO }).transform((s, ctx) => {
  const c = parseMoney(s);
  if (c === null || c <= 0 || c > MONTO_MAXIMO_CENTAVOS) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_MONTO });
    return z.NEVER;
  }
  return c;
});

const montoParte = z
  .string({ error: 'Ingresá un monto con hasta 2 decimales' })
  .transform((s, ctx) => {
    const c = parseMoney(s);
    if (c === null || c > MONTO_MAXIMO_CENTAVOS) {
      ctx.addIssue({ code: 'custom', message: 'Ingresá un monto con hasta 2 decimales' });
      return z.NEVER;
    }
    return c;
  });

const porcentaje = z.string({ error: 'Ingresá un porcentaje' }).transform((s, ctx) => {
  const p = parsePorcentaje(s);
  if (p === null || p <= 0 || p > 10000) {
    ctx.addIssue({
      code: 'custom',
      message: 'Cada porcentaje tiene que ser mayor a 0 y hasta 100',
    });
    return z.NEVER;
  }
  return p;
});

export const fecha = z
  .string({ error: 'Ingresá una fecha' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que tener el formato AAAA-MM-DD')
  .refine((f) => {
    const d = new Date(`${f}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(f);
  }, 'La fecha no es válida');

const usuarioId = z.string({ error: 'Falta el participante' }).min(1);

const base = {
  descripcion: z
    .string({ error: 'Poné una descripción de hasta 100 caracteres' })
    .trim()
    .min(1, 'Poné una descripción de hasta 100 caracteres')
    .max(100, 'Poné una descripción de hasta 100 caracteres'),
  monto: montoPositivo,
  fecha,
  pagadoPor: z.string({ error: 'Elegí quién pagó' }).min(1, 'Elegí quién pagó'),
};

export const nuevoGastoSchema = z.discriminatedUnion(
  'tipoDivision',
  [
    z.object({
      ...base,
      tipoDivision: z.literal('IGUAL'),
      participantes: z.array(z.object({ usuarioId })),
    }),
    z.object({
      ...base,
      tipoDivision: z.literal('MONTOS'),
      participantes: z.array(z.object({ usuarioId, monto: montoParte })),
    }),
    z.object({
      ...base,
      tipoDivision: z.literal('PORCENTAJE'),
      participantes: z.array(z.object({ usuarioId, porcentaje })),
    }),
  ],
  { error: 'Elegí cómo se divide el gasto' },
);

export const paginaSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Body ya validado: montos en centavos y porcentajes en centésimos. */
export type NuevoGastoBody = z.infer<typeof nuevoGastoSchema>;
