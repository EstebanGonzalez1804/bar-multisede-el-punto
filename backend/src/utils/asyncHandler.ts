import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Envuelve un controlador async para que cualquier excepción llegue al
 * errorHandler central en lugar de quedar como una promesa rechazada sin
 * manejar (Express 4 no hace esto automáticamente).
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
