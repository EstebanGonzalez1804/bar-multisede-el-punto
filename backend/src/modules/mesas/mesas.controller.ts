import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { resolveSedeScope } from "../../middlewares/auth";
import { datosMesaSchema, listarMesasQuerySchema } from "./mesas.schemas";
import * as mesasService from "./mesas.service";

function parseIdMesa(req: Request): number {
  const idMesa = Number(req.params.idMesa);
  if (!Number.isInteger(idMesa)) {
    throw ApiError.badRequest("El id de mesa no es válido.");
  }
  return idMesa;
}

export const getMesas = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { idSede } = listarMesasQuerySchema.parse(req.query);
  const idSedeEfectiva = resolveSedeScope(req.usuarioActual, idSede ?? null);
  const mesas = await mesasService.listarMesas(idSedeEfectiva);
  res.status(200).json({ mesas });
});

export const postMesa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const datos = datosMesaSchema.parse(req.body);
  const mesa = await mesasService.crearMesa(req.usuarioActual, datos);
  res.status(201).json({ mesa });
});

export const putMesa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idMesa = parseIdMesa(req);
  const datos = datosMesaSchema.parse(req.body);
  const mesa = await mesasService.modificarMesa(req.usuarioActual, idMesa, datos);
  res.status(200).json({ mesa });
});

export const postInactivarMesa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idMesa = parseIdMesa(req);
  const mesa = await mesasService.inactivarMesa(req.usuarioActual, idMesa);
  res.status(200).json({ mesa });
});

export const postActivarMesa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idMesa = parseIdMesa(req);
  const mesa = await mesasService.activarMesa(req.usuarioActual, idMesa);
  res.status(200).json({ mesa });
});
