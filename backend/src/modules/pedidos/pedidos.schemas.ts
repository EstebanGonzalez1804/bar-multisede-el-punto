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
