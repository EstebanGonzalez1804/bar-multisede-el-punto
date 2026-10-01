import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { datosProveedorSchema } from "./proveedores.schemas";
import * as proveedoresService from "./proveedores.service";

function parseIdProveedor(req: Request): number {
  const idProveedor = Number(req.params.idProveedor);
  if (!Number.isInteger(idProveedor)) {
    throw ApiError.badRequest("El id de proveedor no es válido.");
  }
  return idProveedor;
}

export const getProveedores = asyncHandler(async (_req: Request, res: Response) => {
  const proveedores = await proveedoresService.listarProveedores();
  res.status(200).json({ proveedores });
});

export const postProveedor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const datos = datosProveedorSchema.parse(req.body);
  const proveedor = await proveedoresService.crearProveedor(req.usuarioActual, datos);
  res.status(201).json({ proveedor });
});

export const putProveedor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idProveedor = parseIdProveedor(req);
  const datos = datosProveedorSchema.parse(req.body);
  const proveedor = await proveedoresService.modificarProveedor(req.usuarioActual, idProveedor, datos);
  res.status(200).json({ proveedor });
});
