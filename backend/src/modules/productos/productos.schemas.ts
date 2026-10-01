import { z } from "zod";

const valorMonetario = z.number().nonnegative("El valor no puede ser negativo.");

/** HU-014 — Creación de productos. */
export const crearProductoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio.").max(30),
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  idTipoProducto: z.number().int().positive(),
  valorCompra: valorMonetario,
  valorVenta: valorMonetario,
});

/** HU-015 — Modificación (el código no es editable, es el identificador global). */
export const modificarProductoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  idTipoProducto: z.number().int().positive(),
  valorCompra: valorMonetario,
  valorVenta: valorMonetario,
});

/** HU-016 — Inactivación / reactivación. */
export const cambiarEstadoProductoSchema = z.object({
  estado: z.enum(["ACTIVO", "INACTIVO"]),
});

/** HU-017 — Consulta del catálogo. */
export const listarProductosQuerySchema = z.object({
  busqueda: z.string().trim().min(1).optional(),
  idTipoProducto: z.coerce.number().int().positive().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});
