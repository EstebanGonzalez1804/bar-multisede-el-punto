import { z } from "zod";

export const loginSchema = z.object({
  codigoUsuario: z.string().min(1, "El código de usuario es obligatorio."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const cambiarPasswordPropiaSchema = z.object({
  passwordActual: z.string().min(1, "La contraseña actual es obligatoria."),
  passwordNueva: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export const cambiarPasswordDeTerceroSchema = z.object({
  passwordNueva: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});

export const logoutSchema = z.object({
  motivo: z.enum(["MANUAL", "INACTIVIDAD"]).default("MANUAL"),
});
