import { z } from "zod";

/** HU-011 — Creación/modificación de mesas (mismo formulario: identificador, sede). */
export const datosMesaSchema = z.object({
  idSede: z.number().int().positive(),
  identificador: z.string().min(1, "The table identifier is required.").max(30),
});

export const listarMesasQuerySchema = z.object({
  idSede: z.coerce.number().int().positive().optional(),
});
