import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as recepcionesController from "./recepciones.controller";

export const recepcionesRouter = Router();

recepcionesRouter.use(authenticate);

// HU-019 CA-02/CA-04 — Administrador ve cualquier sede, Cajero solo la suya,
// Mesero no tiene acceso a la consulta de recepciones.
recepcionesRouter.get("/", requireRole("ADMINISTRADOR", "CAJERO"), recepcionesController.getRecepciones);

// HU-021 CA-03/CA-04 — Administrador o Cajero (acotado a su sede) registran
// recepciones; Mesero no puede.
recepcionesRouter.post("/", requireRole("ADMINISTRADOR", "CAJERO"), recepcionesController.postRecepcion);
