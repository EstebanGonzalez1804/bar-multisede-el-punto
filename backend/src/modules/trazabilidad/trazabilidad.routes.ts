import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as trazabilidadController from "./trazabilidad.controller";

export const trazabilidadRouter = Router();

trazabilidadRouter.use(authenticate);

// HU-040 CA-03 — función exclusiva del Administrador.
trazabilidadRouter.get("/", requireRole("ADMINISTRADOR"), trazabilidadController.getTrazabilidad);
