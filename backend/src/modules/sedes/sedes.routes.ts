import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as sedesController from "./sedes.controller";

export const sedesRouter = Router();

sedesRouter.use(authenticate);

// Cualquier usuario autenticado puede listar sedes (se necesita, p. ej.,
// para los selectores de las pantallas de creación de usuarios/mesas).
sedesRouter.get("/", sedesController.getSedes);

// HU-010 CA-03: solo Administrador puede crear/modificar sedes.
sedesRouter.post("/", requireRole("ADMINISTRADOR"), sedesController.postSede);
