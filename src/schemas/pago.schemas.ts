import { z } from 'zod';
import { fecha, montoPositivo } from './gasto.schemas.js';

export const nuevoPagoSchema = z.object({
  de: z.string({ error: 'Elegí quién paga' }).min(1, 'Elegí quién paga'),
  a: z.string({ error: 'Elegí a quién le paga' }).min(1, 'Elegí a quién le paga'),
  monto: montoPositivo,
  fecha,
});

/** Body ya validado: `monto` en centavos. */
export type NuevoPagoBody = z.infer<typeof nuevoPagoSchema>;
