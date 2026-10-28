import { z } from "zod";

export const loginSchema = z.object({
  codigoUsuario: z.string().min(1, "The user code is required."),
  password: z.string().min(1, "The password is required."),
});

export const cambiarPasswordPropiaSchema = z.object({
  passwordActual: z.string().min(1, "The current password is required."),
  passwordNueva: z.string().min(8, "The new password must be at least 8 characters long."),
});

export const cambiarPasswordDeTerceroSchema = z.object({
  passwordNueva: z.string().min(8, "The new password must be at least 8 characters long."),
});

export const logoutSchema = z.object({
  motivo: z.enum(["MANUAL", "INACTIVIDAD"]).default("MANUAL"),
});
