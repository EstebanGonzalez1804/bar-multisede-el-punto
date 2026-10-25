import type { Request, Response } from "express";
import { z } from "zod";
import { resolveSedeScope } from "../../middlewares/auth";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reportesService from "./reportes.service";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Las fechas deben tener el formato AAAA-MM-DD.");

const querySchema = z
  .object({
    desde: fecha,
    hasta: fecha,
    idSede: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.desde <= q.hasta, { message: "La fecha inicial no puede ser posterior a la final." });

async function resolverReporte(req: Request) {
  if (!req.usuarioActual) throw ApiError.unauthorized("Se requiere autenticación.");
  const q = querySchema.parse(req.query);
  return reportesService.generarReporteVentas(q.desde, q.hasta, resolveSedeScope(req.usuarioActual, q.idSede ?? null));
}

export const getReporteVentas = asyncHandler(async (req: Request, res: Response) => {
  const reporte = await resolverReporte(req);
  res.status(200).json({ reporte });
});

export const getReporteVentasExcel = asyncHandler(async (req: Request, res: Response) => {
  const reporte = await resolverReporte(req);
  const buffer = await reportesService.generarExcelVentas(reporte);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="ventas_${reporte.desde}_${reporte.hasta}.xlsx"`);
  res.status(200).send(buffer);
});
