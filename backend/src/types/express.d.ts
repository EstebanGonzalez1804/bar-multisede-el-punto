import type { JwtPayload } from "./auth";

declare global {
  namespace Express {
    interface Request {
      /** Presente únicamente en rutas protegidas por el middleware `authenticate`. */
      usuarioActual?: JwtPayload;
    }
  }
}

export {};
