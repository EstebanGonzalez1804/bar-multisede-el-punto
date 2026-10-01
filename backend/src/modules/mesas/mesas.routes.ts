import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as mesasController from "./mesas.controller";

export const mesasRouter = Router();

mesasRouter.use(authenticate);

// HU-011 — cualquier usuario autenticado puede ver las mesas, acotado a su
// propia sede si es Cajero/Mesero (resolveSedeScope en el controller).
mesasRouter.get("/", mesasController.getMesas);

// HU-011 CA-03 / HU-012 CA-03 — solo Administrador crea, modifica o inactiva.
mesasRouter.post("/", requireRole("ADMINISTRADOR"), mesasController.postMesa);
mesasRouter.put("/:idMesa", requireRole("ADMINISTRADOR"), mesasController.putMesa);
mesasRouter.post("/:idMesa/inactivar", requireRole("ADMINISTRADOR"), mesasController.postInactivarMesa);
