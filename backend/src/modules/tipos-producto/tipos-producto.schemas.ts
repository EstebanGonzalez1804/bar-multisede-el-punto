import { z } from "zod";

/** HU-013 — Parametrización de tipos de producto (creación y modificación). */
export const datosTipoProductoSchema = z.object({
  nombre: z.string().min(1, "The product type name is required.").max(80),
});

export const cambiarEstadoTipoProductoSchema = z.object({
  estado: z.enum(["ACTIVO", "INACTIVO"]),
});
