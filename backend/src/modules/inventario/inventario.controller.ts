import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { resolveSedeScope } from "../../middlewares/auth";
import { listarInventarioQuerySchema, registrarAjusteSchema } from "./inventario.schemas";
import * as inventarioService from "./inventario.service";

export const getInventario = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { idSede } = listarInventarioQuerySchema.parse(req.query);
  const idSedeEfectiva = resolveSedeScope(req.usuarioActual, idSede ?? null);
  const inventario = await inventarioService.listarInventario(idSedeEfectiva);
  res.status(200).json({ inventario });
});

export const postAjuste = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const datos = registrarAjusteSchema.parse(req.body);

  // CA-05 HU-022: Cajero solo puede ajustar inventario de su propia sede.
  const idSedeEfectiva = resolveSedeScope(req.usuarioActual, datos.idSede);
  if (idSedeEfectiva === null) {
    throw ApiError.badRequest("Debes indicar la sede del ajuste.");
  }

  const item = await inventarioService.registrarAjuste(req.usuarioActual, {
    ...datos,
    idSede: idSedeEfectiva,
  });
  res.status(201).json({ item });
});
