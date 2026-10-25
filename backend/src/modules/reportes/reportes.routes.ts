import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as reportesController from "./reportes.controller";

export const reportesRouter = Router();

reportesRouter.use(authenticate);

// HU-039 CA-04/05/06 — Administrador (todas las sedes) y Cajero (solo la suya); el Mesero no accede.
reportesRouter.get("/ventas", requireRole("ADMINISTRADOR", "CAJERO"), reportesController.getReporteVentas);
reportesRouter.get("/ventas/excel", requireRole("ADMINISTRADOR", "CAJERO"), reportesController.getReporteVentasExcel);
