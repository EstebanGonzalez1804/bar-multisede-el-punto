import { z } from "zod";

/** HU-021 CA-04 — cantidades siempre enteras y mayores a cero (nunca fraccionarias ni negativas). */
const lineaRecepcionSchema = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive("La cantidad debe ser un entero mayor a cero."),
});

export const crearRecepcionSchema = z.object({
  idProveedor: z.number().int().positive(),
  idSede: z.number().int().positive(),
  fechaRecepcion: z.string().min(1, "La fecha de recepción es obligatoria."),
  lineas: z.array(lineaRecepcionSchema).min(1, "Debe agregar al menos un producto a la recepción."),
});

export const listarRecepcionesQuerySchema = z.object({
  idProveedor: z.coerce.number().int().positive().optional(),
  idSede: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
