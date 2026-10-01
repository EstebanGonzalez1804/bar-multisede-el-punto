import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as proveedoresController from "./proveedores.controller";

export const proveedoresRouter = Router();

proveedoresRouter.use(authenticate);

// HU-018 CA-03 — consulta abierta a Administrador y Cajero (este último la
// necesita para elegir proveedor al registrar una recepción, HU-021).
// Mesero no tiene ningún flujo de Sprint 3 que use proveedores.
proveedoresRouter.get("/", requireRole("ADMINISTRADOR", "CAJERO"), proveedoresController.getProveedores);

// HU-018 CA-02 — solo Administrador crea o modifica proveedores.
proveedoresRouter.post("/", requireRole("ADMINISTRADOR"), proveedoresController.postProveedor);
proveedoresRouter.put("/:idProveedor", requireRole("ADMINISTRADOR"), proveedoresController.putProveedor);
