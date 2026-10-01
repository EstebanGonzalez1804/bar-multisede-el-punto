import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { crearSedeSchema } from "./sedes.schemas";
import * as sedesService from "./sedes.service";

export const postSede = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { nombre, direccion } = crearSedeSchema.parse(req.body);
  const sede = await sedesService.crearSede(req.usuarioActual, nombre, direccion);
  res.status(201).json({ sede });
});

export const getSedes = asyncHandler(async (_req: Request, res: Response) => {
  const sedes = await sedesService.listarSedes();
  res.status(200).json({ sedes });
});
