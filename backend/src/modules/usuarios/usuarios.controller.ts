import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import {
  cambiarEstadoUsuarioSchema,
  crearUsuarioSchema,
  listarUsuariosQuerySchema,
  modificarUsuarioSchema,
} from "./usuarios.schemas";
import * as usuariosService from "./usuarios.service";

function parseIdUsuario(req: Request): number {
  const idUsuario = Number(req.params.idUsuario);
  if (!Number.isInteger(idUsuario)) {
    throw ApiError.badRequest("El id de usuario no es válido.");
  }
  return idUsuario;
}

export const getUsuarios = asyncHandler(async (req: Request, res: Response) => {
  const filtros = listarUsuariosQuerySchema.parse(req.query);
  const usuarios = await usuariosService.listarUsuarios(filtros);
  res.status(200).json({ usuarios });
});

export const postUsuario = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const datos = crearUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.crearUsuario(req.usuarioActual, datos);
  res.status(201).json({ usuario });
});

export const putUsuario = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idUsuario = parseIdUsuario(req);
  const datos = modificarUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.modificarUsuario(req.usuarioActual, idUsuario, datos);
  res.status(200).json({ usuario });
});

export const putEstadoUsuario = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idUsuario = parseIdUsuario(req);
  const { estado } = cambiarEstadoUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.cambiarEstadoUsuario(req.usuarioActual, idUsuario, estado);
  res.status(200).json({ usuario });
});
