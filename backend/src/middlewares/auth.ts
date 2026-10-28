import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
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

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.usuarioActual = payload;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token. Please sign in again.");
  }
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
