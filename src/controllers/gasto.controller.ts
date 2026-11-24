import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { paginaSchema, type NuevoGastoBody } from '../schemas/gasto.schemas.js';
import type { GastoService } from '../services/gasto.service.js';

const actor = (res: Response) => res.locals.userId as string;
const param = (req: Request, nombre: string) => String(req.params[nombre]);

/** HTTP puro: lee la request validada, llama al servicio y responde. */
export function createGastoController(gastos: GastoService) {
  const listar: RequestHandler = async (req, res) => {
    const q = paginaSchema.safeParse(req.query);
    if (!q.success)
      throw new AppError(400, 'VALIDATION_ERROR', 'Revisá los datos ingresados', {
        page: 'Página inválida',
      });
    res.json(await gastos.listar(actor(res), param(req, 'id'), q.data.page, q.data.pageSize));
  };
  const crear: RequestHandler = async (req, res) => {
    const gasto = await gastos.crear(actor(res), param(req, 'id'), req.body as NuevoGastoBody);
    res.status(201).json({ gasto });
  };
  const detalle: RequestHandler = async (req, res) => {
    res.json({ gasto: await gastos.detalle(actor(res), param(req, 'id'), param(req, 'gastoId')) });
  };
  const editar: RequestHandler = async (req, res) => {
    const body = req.body as NuevoGastoBody;
    res.json({
      gasto: await gastos.editar(actor(res), param(req, 'id'), param(req, 'gastoId'), body),
    });
  };
  const eliminar: RequestHandler = async (req, res) => {
    await gastos.eliminar(actor(res), param(req, 'id'), param(req, 'gastoId'));
    res.status(204).end();
  };
  return { listar, crear, detalle, editar, eliminar };
}
