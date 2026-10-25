import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import * as trazabilidadService from "./trazabilidad.service";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Las fechas deben tener el formato AAAA-MM-DD.");

const querySchema = z.object({
  idUsuario: z.coerce.number().int().positive().optional(),
  idSede: z.coerce.number().int().positive().optional(),
  tipoEvento: z.string().trim().max(60).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const getTrazabilidad = asyncHandler(async (req: Request, res: Response) => {
  const q = querySchema.parse(req.query);
  const [eventos, tiposEvento] = await Promise.all([
    trazabilidadService.consultarTrazabilidad({ ...q, tipoEvento: q.tipoEvento || undefined }),
    trazabilidadService.listarTiposEvento(),
  ]);
  res.status(200).json({ eventos, tiposEvento });
});
