import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as usuariosController from "./usuarios.controller";

export const usuariosRouter = Router();

// HU-007 CA-05 / HU-008 CA-04 / HU-009 CA-04: todas las operaciones de
// gestión de usuarios son exclusivas del Administrador.
usuariosRouter.use(authenticate, requireRole("ADMINISTRADOR"));

usuariosRouter.get("/", usuariosController.getUsuarios); // HU-009
usuariosRouter.post("/", usuariosController.postUsuario); // HU-007
usuariosRouter.put("/:idUsuario", usuariosController.putUsuario); // HU-008 CA-01
usuariosRouter.put("/:idUsuario/estado", usuariosController.putEstadoUsuario); // HU-008 CA-02/03
