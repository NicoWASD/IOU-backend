import type { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

const isJsonParseError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  (err as { type?: string }).type === 'entity.parse.failed';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }
  if (isJsonParseError(err)) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es JSON válido' },
    });
    return;
  }
  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
};
