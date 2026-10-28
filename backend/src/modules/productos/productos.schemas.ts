import { z } from "zod";

const valorMonetario = z.number().nonnegative("El valor no puede ser negativo.");

/** Regla de negocio (cliente): el valor de venta nunca puede ser menor que el de compra. */
const ventaNoMenorQueCompra = {
  mensaje: "El valor de venta no puede ser menor que el valor de compra.",
  validar: (d: { valorCompra: number; valorVenta: number }) => d.valorVenta >= d.valorCompra,
};

/** HU-014 — Creación de productos (el código se genera en el servidor, no lo digita el Administrador). */
export const crearProductoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  idTipoProducto: z.number().int().positive(),
  valorCompra: valorMonetario,
  valorVenta: valorMonetario,
}).refine(ventaNoMenorQueCompra.validar, { message: ventaNoMenorQueCompra.mensaje, path: ["valorVenta"] });

/** HU-015 — Modificación (el código no es editable, es el identificador global). */
export const modificarProductoSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  idTipoProducto: z.number().int().positive(),
  valorCompra: valorMonetario,
  valorVenta: valorMonetario,
}).refine(ventaNoMenorQueCompra.validar, { message: ventaNoMenorQueCompra.mensaje, path: ["valorVenta"] });

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
