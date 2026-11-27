import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import type { InvitarBody, MediosBody } from '../schemas/usuario.schemas.js';
import type { InvitacionService } from '../services/invitacion.service.js';
import type { MedioService } from '../services/medio.service.js';

const actor = (res: Response) => res.locals.userId as string;
const param = (req: Request, nombre: string) => String(req.params[nombre]);

/** HTTP puro para búsqueda, invitaciones y medios de cobro. */
export function createUsuarioController(inv: InvitacionService, medios: MedioService) {
  const buscar: RequestHandler = async (req, res) => {
    const q = String(req.query.q ?? '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    if (q.length < 2 || q.length > 20)
      throw new AppError(400, 'VALIDATION_ERROR', 'Revisá los datos ingresados', {
        q: 'Escribí al menos 2 caracteres',
      });
    const grupoId = typeof req.query.grupoId === 'string' ? req.query.grupoId : undefined;
    res.json({ usuarios: await inv.buscar(actor(res), q, grupoId) });
  };
  const invitar: RequestHandler = async (req, res) => {
    const { usuarioId } = req.body as InvitarBody;
    res
      .status(201)
      .json({ invitacion: await inv.invitar(actor(res), param(req, 'id'), usuarioId) });
  };
  const pendientesDeGrupo: RequestHandler = async (req, res) => {
    res.json({ invitaciones: await inv.pendientesDeGrupo(actor(res), param(req, 'id')) });
  };
  const cancelar: RequestHandler = async (req, res) => {
    await inv.cancelar(actor(res), param(req, 'id'), param(req, 'invId'));
    res.status(204).end();
  };
  const mias: RequestHandler = async (_req, res) => {
    res.json({ invitaciones: await inv.mias(actor(res)) });
  };
  const aceptar: RequestHandler = async (req, res) => {
    res.json(await inv.aceptar(actor(res), param(req, 'id')));
  };
  const rechazar: RequestHandler = async (req, res) => {
    await inv.rechazar(actor(res), param(req, 'id'));
    res.status(204).end();
  };
  const misMedios: RequestHandler = async (_req, res) => {
    res.json({ medios: await medios.mios(actor(res)) });
  };
  const guardarMedios: RequestHandler = async (req, res) => {
    const body = req.body as MediosBody;
    res.json({ medios: await medios.reemplazar(actor(res), body.medios) });
  };
  const mediosDe: RequestHandler = async (req, res) => {
    res.json({ medios: await medios.deUsuario(actor(res), param(req, 'id')) });
  };
  return {
    buscar,
    invitar,
    pendientesDeGrupo,
    cancelar,
    mias,
    aceptar,
    rechazar,
    misMedios,
    guardarMedios,
    mediosDe,
  };
}
