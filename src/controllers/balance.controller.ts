import type { Request, RequestHandler, Response } from 'express';
import type { NuevoPagoBody } from '../schemas/pago.schemas.js';
import type { BalanceService } from '../services/balance.service.js';

const actor = (res: Response) => res.locals.userId as string;
const param = (req: Request, nombre: string) => String(req.params[nombre]);

/** HTTP puro: lee la request validada, llama al servicio y responde. */
export function createBalanceController(s: BalanceService) {
  const balances: RequestHandler = async (req, res) => {
    res.json({ balances: await s.balances(actor(res), param(req, 'id')) });
  };
  const liquidacion: RequestHandler = async (req, res) => {
    res.json({ transferencias: await s.liquidacion(actor(res), param(req, 'id')) });
  };
  const archivar: RequestHandler = async (req, res) => {
    res.json({ grupo: await s.archivar(actor(res), param(req, 'id')) });
  };
  const listarPagos: RequestHandler = async (req, res) => {
    res.json({ pagos: await s.listarPagos(actor(res), param(req, 'id')) });
  };
  const crearPago: RequestHandler = async (req, res) => {
    const pago = await s.crearPago(actor(res), param(req, 'id'), req.body as NuevoPagoBody);
    res.status(201).json({ pago });
  };
  const eliminarPago: RequestHandler = async (req, res) => {
    await s.eliminarPago(actor(res), param(req, 'id'), param(req, 'pagoId'));
    res.status(204).end();
  };
  return { balances, liquidacion, archivar, listarPagos, crearPago, eliminarPago };
}
