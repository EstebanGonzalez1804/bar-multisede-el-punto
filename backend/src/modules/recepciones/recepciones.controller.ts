import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { resolveSedeScope } from "../../middlewares/auth";
import { crearRecepcionSchema, listarRecepcionesQuerySchema } from "./recepciones.schemas";
import * as recepcionesService from "./recepciones.service";

export const getRecepciones = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
  const query = listarRecepcionesQuerySchema.parse(req.query);
  const idSedeEfectiva = resolveSedeScope(req.usuarioActual, query.idSede ?? null);
  const recepciones = await recepcionesService.listarRecepciones({
    idProveedor: query.idProveedor,
    idSede: idSedeEfectiva,
    desde: query.desde,
    hasta: query.hasta,
  });
  res.status(200).json({ recepciones });
});

export const postRecepcion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
  const datos = crearRecepcionSchema.parse(req.body);

  // CA-03 HU-021: Cajero solo puede registrar recepciones de su propia sede,
  // sin importar qué idSede haya enviado el formulario.
  const idSedeEfectiva = resolveSedeScope(req.usuarioActual, datos.idSede);
  if (idSedeEfectiva === null) {
    throw ApiError.badRequest("You must specify the location of the receipt.");
  }

  const recepcion = await recepcionesService.crearRecepcion(req.usuarioActual, {
    ...datos,
    idSede: idSedeEfectiva,
  });
  res.status(201).json({ recepcion });
});
