import { z } from "zod";

/** HU-013 — Parametrización de tipos de producto (creación y modificación). */
export const datosTipoProductoSchema = z.object({
  nombre: z.string().min(1, "El nombre del tipo de producto es obligatorio.").max(80),
});
