import { z } from "zod";

/** HU-025 — Apertura de pedido: solo se indica sobre qué mesa. */
export const crearPedidoSchema = z.object({
  idMesa: z.number().int().positive(),
});

/** HU-026 — Registro de un producto en el pedido. */
export const registrarProductoEnPedidoSchema = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive("La cantidad debe ser un entero mayor a cero."),
});

/** HU-030 / HU-032 — Filtros del listado de pedidos. */
export const listarPedidosQuerySchema = z.object({
  idSede: z.coerce.number().int().positive().optional(),
  estadoPedido: z.enum(["ABIERTO", "CERRADO"]).optional(),
  estadoPago: z.enum(["PENDIENTE", "PAGADO", "TODOS"]).optional(),
  busqueda: z.string().trim().max(60).optional(),
});

/** HU-033 a HU-036 — Registro de pago (método(s) + valor, y productos si es por productos). */
export const registrarPagoSchema = z.object({
  modalidad: z.enum(["TOTAL", "ABONO", "PRODUCTOS"]),
  lineas: z
    .array(
      z.object({
        metodo: z.enum(["EFECTIVO", "TARJETA_CREDITO", "TARJETA_DEBITO"]),
        valor: z.number().positive("El valor del pago debe ser mayor a cero."),
        valorEntregado: z.number().positive().optional(),
      })
    )
    .min(1, "Agrega al menos un método de pago con su valor.")
    .max(6),
  productos: z
    .array(
      z.object({
        idProducto: z.number().int().positive(),
        cantidad: z.number().int().positive("La cantidad debe ser al menos 1."),
      })
    )
    .optional(),
});
