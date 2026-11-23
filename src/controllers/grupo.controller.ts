import type { Request, RequestHandler, Response } from 'express';
import type {
  AgregarMiembroBody,
  CrearGrupoBody,
  EditarGrupoBody,
} from '../schemas/grupo.schemas.js';
import type { GrupoService } from '../services/grupo.service.js';
import type { MiembroService } from '../services/miembro.service.js';

const actor = (res: Response) => res.locals.userId as string;
const param = (req: Request, nombre: string) => String(req.params[nombre]);

/** HTTP puro: lee la request validada, llama al servicio y responde. */
export function createGrupoController(grupos: GrupoService, miembros: MiembroService) {
  const listar: RequestHandler = async (_req, res) => {
    res.json({ grupos: await grupos.listar(actor(res)) });
  };
  const crear: RequestHandler = async (req, res) => {
    res.status(201).json({ grupo: await grupos.crear(actor(res), req.body as CrearGrupoBody) });
  };
  const detalle: RequestHandler = async (req, res) => {
    res.json({ grupo: await grupos.detalle(actor(res), param(req, 'id')) });
  };
  const editar: RequestHandler = async (req, res) => {
    const body = req.body as EditarGrupoBody;
    res.json({ grupo: await grupos.editar(actor(res), param(req, 'id'), body) });
  };
  const listarMiembros: RequestHandler = async (req, res) => {
    res.json({ miembros: await miembros.listar(actor(res), param(req, 'id')) });
  };
  const agregarMiembro: RequestHandler = async (req, res) => {
    const { email } = req.body as AgregarMiembroBody;
    res.status(201).json({ miembro: await miembros.agregar(actor(res), param(req, 'id'), email) });
  };
  const quitarMiembro: RequestHandler = async (req, res) => {
    await miembros.quitar(actor(res), param(req, 'id'), param(req, 'usuarioId'));
    res.status(204).end();
  };
  return { listar, crear, detalle, editar, listarMiembros, agregarMiembro, quitarMiembro };
}
