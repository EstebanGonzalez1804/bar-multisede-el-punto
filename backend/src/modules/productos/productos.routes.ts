import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as productosController from "./productos.controller";

export const productosRouter = Router();

productosRouter.use(authenticate);

// HU-017 — catálogo visible para cualquier perfil autenticado, igual para
// todas las sedes (CA-03: el catálogo es único y global).
productosRouter.get("/", productosController.getProductos);
productosRouter.get("/:idProducto/historial-precios", productosController.getHistorialPrecios);

// HU-014/HU-015/HU-016 — solo Administrador.
productosRouter.post("/", requireRole("ADMINISTRADOR"), productosController.postProducto);
productosRouter.put("/:idProducto", requireRole("ADMINISTRADOR"), productosController.putProducto);
productosRouter.put(
  "/:idProducto/estado",
  requireRole("ADMINISTRADOR"),
  productosController.putEstadoProducto
);
