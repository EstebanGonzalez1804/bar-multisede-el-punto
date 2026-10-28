import { z } from "zod";

export const listarInventarioQuerySchema = z.object({
  idSede: z.coerce.number().int().positive().optional(),
});

/** HU-022 CA-02 — lista fija de motivos del mockup (pérdida, daño, rotura, diferencia física, error de registro, otro). */
export const motivoAjusteSchema = z.enum([
  "PERDIDA",
  "DANO",
  "ROTURA",
  "DIFERENCIA_FISICA",
  "ERROR_REGISTRO",
  "OTRO",
]);

export const registrarAjusteSchema = z.object({
  idProducto: z.number().int().positive(),
  idSede: z.number().int().positive(),
  cantidadAjuste: z
    .number()
    .int("The adjustment must be a whole number.")
    .refine((n) => n !== 0, "The adjustment must be non-zero."),
  motivo: motivoAjusteSchema,
});
