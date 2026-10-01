import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { crearPedidoSchema, registrarProductoEnPedidoSchema } from "./pedidos.schemas";
import * as pedidosService from "./pedidos.service";

function parseIdMesa(req: Request): number {
  const idMesa = Number(req.params.idMesa);
  if (!Number.isInteger(idMesa)) {
    throw ApiError.badRequest("El id de mesa no es válido.");
  }
  return idMesa;
}

function parseIdPedido(req: Request): number {
  const idPedido = Number(req.params.idPedido);
  if (!Number.isInteger(idPedido)) {
    throw ApiError.badRequest("El id de pedido no es válido.");
  }
  return idPedido;
}

export const postPedido = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { idMesa } = crearPedidoSchema.parse(req.body);
  const pedido = await pedidosService.crearPedido(req.usuarioActual, idMesa);
  res.status(201).json({ pedido });
});

export const getPedidoAbiertoPorMesa = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idMesa = parseIdMesa(req);
  const pedido = await pedidosService.obtenerPedidoAbiertoPorMesa(idMesa, req.usuarioActual);
  res.status(200).json({ pedido });
});

export const postLineaPedido = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idPedido = parseIdPedido(req);
  const datos = registrarProductoEnPedidoSchema.parse(req.body);
  const pedido = await pedidosService.registrarProductoEnPedido(req.usuarioActual, idPedido, datos);
  res.status(201).json({ pedido });
});
