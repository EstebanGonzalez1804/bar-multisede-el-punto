import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { datosTipoProductoSchema } from "./tipos-producto.schemas";
import * as tiposProductoService from "./tipos-producto.service";

function parseIdTipoProducto(req: Request): number {
  const id = Number(req.params.idTipoProducto);
  if (!Number.isInteger(id)) {
    throw ApiError.badRequest("El id de tipo de producto no es válido.");
  }
  return id;
}

export const getTiposProducto = asyncHandler(async (_req: Request, res: Response) => {
  const tiposProducto = await tiposProductoService.listarTiposProducto();
  res.status(200).json({ tiposProducto });
});

export const getTipoProducto = asyncHandler(async (req: Request, res: Response) => {
  const id = parseIdTipoProducto(req);
  const tipoProducto = await tiposProductoService.obtenerTipoProductoConProductos(id);
  res.status(200).json({ tipoProducto });
});

export const postTipoProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { nombre } = datosTipoProductoSchema.parse(req.body);
  const tipoProducto = await tiposProductoService.crearTipoProducto(req.usuarioActual, nombre);
  res.status(201).json({ tipoProducto });
});

export const putTipoProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const id = parseIdTipoProducto(req);
  const { nombre } = datosTipoProductoSchema.parse(req.body);
  const tipoProducto = await tiposProductoService.modificarTipoProducto(req.usuarioActual, id, nombre);
  res.status(200).json({ tipoProducto });
});
