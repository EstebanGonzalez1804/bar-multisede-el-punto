import { z } from "zod";

/** HU-021 CA-04 — cantidades siempre enteras y mayores a cero (nunca fraccionarias ni negativas). */
const lineaRecepcionSchema = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive("La cantidad debe ser un entero mayor a cero."),
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
    .min(1, "La fecha de recepción es obligatoria.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de recepción no es válida.")
    .refine((valor) => valor <= hoyBogota(), "La fecha de la recepción no puede ser posterior a hoy."),
  lineas: z.array(lineaRecepcionSchema).min(1, "Debe agregar al menos un producto a la recepción."),
});

export const listarRecepcionesQuerySchema = z.object({
  idProveedor: z.coerce.number().int().positive().optional(),
  idSede: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
