import { z } from "zod";

/** HU-018 — Creación/modificación de proveedor: datos básicos de contacto, sin precios (CA-03). */
export const datosProveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre del proveedor es obligatorio.").max(150),
  informacionContacto: z
    .string()
    .min(1, "La información de contacto es obligatoria.")
    .max(255),
});
