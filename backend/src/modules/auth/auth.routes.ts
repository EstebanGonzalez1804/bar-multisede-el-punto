import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as authController from "./auth.controller";

export const authRouter = Router();

// HU-001 — público.
authRouter.post("/login", authController.postLogin);

// HU-006 — cierre de sesión (manual o por inactividad, lo decide el frontend).
authRouter.post("/logout", authenticate, authController.postLogout);

// Identidad del usuario autenticado (usado por el frontend al recargar la app).
authRouter.get("/me", authenticate, authController.getMe);

// HU-002 — cambio de contraseña propia.
authRouter.put("/password", authenticate, authController.putCambiarPasswordPropia);

// HU-005 — cambio de contraseña de terceros, solo Administrador.
authRouter.put(
  "/usuarios/:idUsuario/password",
  authenticate,
  requireRole("ADMINISTRADOR"),
  authController.putCambiarPasswordDeTercero
);

// HU-004 — desbloqueo de usuario, solo Administrador.
authRouter.post(
  "/usuarios/:idUsuario/desbloquear",
  authenticate,
  requireRole("ADMINISTRADOR"),
  authController.postDesbloquearUsuario
);
