import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as tiposProductoController from "./tipos-producto.controller";

export const tiposProductoRouter = Router();

tiposProductoRouter.use(authenticate);

// Cualquier usuario autenticado puede listar (lo necesita el formulario de
// creación de productos, HU-014) y consultar un tipo con sus productos
// asociados (HU-013 CA-03).
tiposProductoRouter.get("/", tiposProductoController.getTiposProducto);
tiposProductoRouter.get("/:idTipoProducto", tiposProductoController.getTipoProducto);

// HU-013 CA-02 — solo Administrador crea o modifica.
tiposProductoRouter.post("/", requireRole("ADMINISTRADOR"), tiposProductoController.postTipoProducto);
tiposProductoRouter.put(
  "/:idTipoProducto",
  requireRole("ADMINISTRADOR"),
  tiposProductoController.putTipoProducto
);
