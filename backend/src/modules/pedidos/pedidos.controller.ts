import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { resolveSedeScope } from "../../middlewares/auth";
import {
  crearPedidoSchema,
  listarPedidosQuerySchema,
  registrarPagoSchema,
  registrarProductoEnPedidoSchema,
} from "./pedidos.schemas";
import * as pedidosService from "./pedidos.service";
import { enviarCuentaPdf } from "./cuenta.pdf";

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

/** HU-030 — Consulta de pedidos por rol y sede, con filtros por estado y mesa/número. */
export const getPedidos = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const q = listarPedidosQuerySchema.parse(req.query);
  const pedidos = await pedidosService.listarPedidos({
    idSede: resolveSedeScope(req.usuarioActual, q.idSede ?? null),
    estadoPedido: q.estadoPedido,
    estadoPago: q.estadoPago,
    busqueda: q.busqueda || undefined,
  });
  res.status(200).json({ pedidos });
});

/** HU-032 — Cuentas cerradas con saldo pendiente (Cajero: solo su sede). */
export const getPedidosPendientesPago = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const q = listarPedidosQuerySchema.parse(req.query);
  const pedidos = await pedidosService.listarPedidos({
    idSede: resolveSedeScope(req.usuarioActual, q.idSede ?? null),
    busqueda: q.busqueda || undefined,
    soloPendientesDePago: true,
  });
  res.status(200).json({ pedidos });
});

export const getPedido = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const pedido = await pedidosService.obtenerPedidoParaUsuario(req.usuarioActual, parseIdPedido(req));
  res.status(200).json({ pedido });
});

/** HU-031 — Cuenta en PDF (tirilla de 80 mm). Solo pedidos ya cerrados. */
export const getCuentaPdf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const pedido = await pedidosService.obtenerPedidoParaUsuario(req.usuarioActual, parseIdPedido(req));
  if (pedido.estadoPedido !== "CERRADO") {
    throw ApiError.conflict("El pedido sigue abierto: ciérralo para generar la cuenta.", "PEDIDO_ABIERTO");
  }
  enviarCuentaPdf(pedido, res);
});

export const postCerrarPedido = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const pedido = await pedidosService.cerrarPedido(req.usuarioActual, parseIdPedido(req));
  res.status(200).json({ pedido });
});

export const postReabrirPedido = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const pedido = await pedidosService.reabrirPedido(req.usuarioActual, parseIdPedido(req));
  res.status(200).json({ pedido });
});

export const postPago = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const datos = registrarPagoSchema.parse(req.body);
  const resultado = await pedidosService.registrarPago(req.usuarioActual, parseIdPedido(req), datos);
  res.status(201).json(resultado);
});
