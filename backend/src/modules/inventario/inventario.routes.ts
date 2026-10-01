import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as inventarioController from "./inventario.controller";

export const inventarioRouter = Router();

inventarioRouter.use(authenticate);

// HU-020 CA-04 — cualquier perfil autenticado puede consultar disponibilidad
// (el Mesero la necesita al armar un pedido); acotado a su sede si no es
// Administrador (resolveSedeScope en el controller).
inventarioRouter.get("/", inventarioController.getInventario);

// HU-022 CA-05/CA-06 — Administrador o Cajero (acotado a su sede) registran
// ajustes; Mesero no puede.
inventarioRouter.post(
  "/ajustes",
  requireRole("ADMINISTRADOR", "CAJERO"),
  inventarioController.postAjuste
);
