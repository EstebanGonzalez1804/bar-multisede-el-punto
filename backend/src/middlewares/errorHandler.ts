import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDACION",
        message: "The submitted data is not valid.",
        detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: { code: "ERROR_INTERNO", message: "An unexpected server error occurred." },
  });
}
