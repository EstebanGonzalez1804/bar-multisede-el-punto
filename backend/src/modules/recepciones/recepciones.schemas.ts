import { z } from "zod";

/** HU-021 CA-04 — cantidades siempre enteras y mayores a cero (nunca fraccionarias ni negativas). */
const lineaRecepcionSchema = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive("The quantity must be a whole number greater than zero."),
});

/** Fecha de hoy en Colombia ("YYYY-MM-DD"), sin depender de la zona del servidor. */
function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export const crearRecepcionSchema = z.object({
  idProveedor: z.number().int().positive(),
  idSede: z.number().int().positive(),
  // La recepción no puede quedar con fecha futura (antes, después de las 7 p. m.
  // la pantalla proponía la fecha de "mañana" por usar la hora UTC).
  fechaRecepcion: z
    .string()
    .min(1, "The receipt date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "The receipt date is not valid.")
    .refine((valor) => valor <= hoyBogota(), "The receipt date cannot be later than today."),
  lineas: z.array(lineaRecepcionSchema).min(1, "At least one product must be added to the receipt."),
});

export const listarRecepcionesQuerySchema = z.object({
  idProveedor: z.coerce.number().int().positive().optional(),
  idSede: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
