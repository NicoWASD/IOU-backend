import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

/** Valida y normaliza req.body. Tira 400 VALIDATION_ERROR con { campo: mensaje }. */
export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const details: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path.join('.') || '_';
        details[campo] ??= issue.message;
      }
      next(new AppError(400, 'VALIDATION_ERROR', 'Revisá los datos ingresados', details));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
