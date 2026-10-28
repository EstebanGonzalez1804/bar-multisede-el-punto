import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import {
  cambiarEstadoProductoSchema,
  crearProductoSchema,
  listarProductosQuerySchema,
  modificarProductoSchema,
} from "./productos.schemas";
import * as productosService from "./productos.service";

function parseIdProducto(req: Request): number {
  const id = Number(req.params.idProducto);
  if (!Number.isInteger(id)) {
    throw ApiError.badRequest("The product id is not valid.");
  }
  return id;
}

export const getProductos = asyncHandler(async (req: Request, res: Response) => {
  const filtros = listarProductosQuerySchema.parse(req.query);
  const productos = await productosService.listarProductos(filtros);
  // HU-017 CA-01: para Cajero y Mesero el catálogo muestra código, nombre,
  // tipo y estado (y el precio de venta, que necesitan para operar); el
  // costo (valor de compra) solo lo ve el Administrador.
  if (req.usuarioActual?.perfil !== "ADMINISTRADOR") {
    const sinCosto = productos.map((producto) => {
      const copia: Partial<typeof producto> = { ...producto };
      delete copia.valorCompra;
      return copia;
    });
    res.status(200).json({ productos: sinCosto });
    return;
  }
  res.status(200).json({ productos });
});

export const getHistorialPrecios = asyncHandler(async (req: Request, res: Response) => {
  const idProducto = parseIdProducto(req);
  const historial = await productosService.listarHistorialPrecios(idProducto);
  res.status(200).json({ historial });
});

export const postProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
  const datos = crearProductoSchema.parse(req.body);
  const producto = await productosService.crearProducto(req.usuarioActual, datos);
  res.status(201).json({ producto });
});

export const putProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
  const idProducto = parseIdProducto(req);
  const datos = modificarProductoSchema.parse(req.body);
  const producto = await productosService.modificarProducto(req.usuarioActual, idProducto, datos);
  res.status(200).json({ producto });
});

export const putEstadoProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
  const idProducto = parseIdProducto(req);
  const { estado } = cambiarEstadoProductoSchema.parse(req.body);
  const producto = await productosService.cambiarEstadoProducto(req.usuarioActual, idProducto, estado);
  res.status(200).json({ producto });
});
