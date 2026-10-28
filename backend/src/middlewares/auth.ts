import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import type { JwtPayload, Perfil } from "../types/auth";

/**
 * Verifica el JWT del header Authorization y adjunta el usuario autenticado
 * a `req.usuarioActual`. Toda ruta protegida pasa primero por aquí.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("An authentication token is required.");
  }

  const token = header.slice("Bearer ".length);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw ApiError.unauthorized("Invalid or expired token. Please sign in again.");
  }

  // Sesión única: el token solo vale mientras su `sid` sea la sesión vigente
  // del usuario. Un inicio de sesión en otro dispositivo (o un cierre de
  // sesión) cambia ese valor y deja fuera a los demás.
  pool
    .query<{ sesion_id: string | null }>(`SELECT sesion_id FROM usuario WHERE id_usuario = $1`, [payload.idUsuario])
    .then(({ rows }) => {
      if (!payload.sid || !rows[0] || rows[0].sesion_id !== payload.sid) {
        throw ApiError.unauthorized(
          "Your session was closed because this user signed in on another device.",
          "SESION_REEMPLAZADA"
        );
      }
      req.usuarioActual = payload;
      next();
    })
    .catch(next);
}

/**
 * Restringe una ruta a uno o más perfiles (Administrador/Cajero/Mesero).
 * Se usa después de `authenticate`.
 */
export function requireRole(...perfiles: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuarioActual) {
      throw ApiError.unauthorized("Authentication is required.");
    }
    if (!perfiles.includes(req.usuarioActual.perfil)) {
      throw ApiError.forbidden(
        "Your role does not have permission to perform this action."
      );
    }
    next();
  };
}

/**
 * Resuelve sobre qué sede puede operar/consultar el usuario autenticado:
 * - ADMINISTRADOR: cualquier sede (la que venga en `sedeSolicitada`, o todas
 *   si no se especifica ninguna — null significa "sin restricción").
 * - CAJERO / MESERO: siempre y únicamente su propia sede, sin excepción,
 *   incluso si intenta pedir otra por query param.
 */
export function resolveSedeScope(
  usuario: JwtPayload,
  sedeSolicitada?: number | null
): number | null {
  if (usuario.perfil === "ADMINISTRADOR") {
    return sedeSolicitada ?? null;
  }
  // CAJERO / MESERO: ignoran cualquier sede solicitada; siempre la propia.
  return usuario.idSede;
}
