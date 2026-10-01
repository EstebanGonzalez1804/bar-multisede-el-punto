import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import {
  cambiarPasswordDeTerceroSchema,
  cambiarPasswordPropiaSchema,
  loginSchema,
  logoutSchema,
} from "./auth.schemas";
import * as authService from "./auth.service";

export const postLogin = asyncHandler(async (req: Request, res: Response) => {
  const { codigoUsuario, password } = loginSchema.parse(req.body);
  const resultado = await authService.login(codigoUsuario, password);
  res.status(200).json(resultado);
});

export const postLogout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { motivo } = logoutSchema.parse(req.body ?? {});
  await authService.logout(req.usuarioActual, motivo);
  res.status(204).send();
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  res.status(200).json({ usuario: req.usuarioActual });
});

export const putCambiarPasswordPropia = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const { passwordActual, passwordNueva } = cambiarPasswordPropiaSchema.parse(req.body);
  await authService.cambiarPasswordPropia(req.usuarioActual, passwordActual, passwordNueva);
  res.status(204).send();
});

export const putCambiarPasswordDeTercero = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idUsuarioObjetivo = Number(req.params.idUsuario);
  if (!Number.isInteger(idUsuarioObjetivo)) {
    throw ApiError.badRequest("El id de usuario no es válido.");
  }
  const { passwordNueva } = cambiarPasswordDeTerceroSchema.parse(req.body);
  await authService.cambiarPasswordDeTercero(req.usuarioActual, idUsuarioObjetivo, passwordNueva);
  res.status(204).send();
});

export const postDesbloquearUsuario = asyncHandler(async (req: Request, res: Response) => {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const idUsuarioObjetivo = Number(req.params.idUsuario);
  if (!Number.isInteger(idUsuarioObjetivo)) {
    throw ApiError.badRequest("El id de usuario no es válido.");
  }
  await authService.desbloquearUsuario(req.usuarioActual, idUsuarioObjetivo);
  res.status(204).send();
});
