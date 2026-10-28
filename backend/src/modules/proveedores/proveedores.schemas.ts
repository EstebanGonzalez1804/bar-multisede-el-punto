import { z } from "zod";

/** HU-018 — Creación/modificación de proveedor: datos básicos de contacto, sin precios (CA-03). */
export const datosProveedorSchema = z.object({
  nombre: z.string().min(1, "The supplier name is required.").max(150),
  informacionContacto: z
    .string()
    .min(1, "The contact information is required.")
    .max(255),
});

export const cambiarEstadoProveedorSchema = z.object({
  estado: z.enum(["ACTIVO", "INACTIVO"]),
});
