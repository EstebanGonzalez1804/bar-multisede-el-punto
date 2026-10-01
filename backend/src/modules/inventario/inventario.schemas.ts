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
    .int("El ajuste debe ser un número entero.")
    .refine((n) => n !== 0, "El ajuste debe ser distinto de cero."),
  motivo: motivoAjusteSchema,
});
