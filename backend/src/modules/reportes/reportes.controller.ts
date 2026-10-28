import type { Request, Response } from "express";
import { z } from "zod";
import { resolveSedeScope } from "../../middlewares/auth";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reportesService from "./reportes.service";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use the YYYY-MM-DD format.");

const querySchema = z
  .object({
    desde: fecha,
    hasta: fecha,
    idSede: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.desde <= q.hasta, { message: "The start date cannot be later than the end date." });

async function resolverReporte(req: Request) {
  if (!req.usuarioActual) throw ApiError.unauthorized("Authentication is required.");
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
  res.setHeader("Content-Disposition", `attachment; filename="sales_${reporte.desde}_${reporte.hasta}.xlsx"`);
  res.status(200).send(buffer);
});
