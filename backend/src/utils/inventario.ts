import type { PoolClient } from "pg";
import { ApiError } from "./ApiError";

export type TipoMovimiento = "RECEPCION" | "VENTA" | "AJUSTE";

export type MotivoAjuste = "PERDIDA" | "DANO" | "ROTURA" | "DIFERENCIA_FISICA" | "ERROR_REGISTRO" | "OTRO";

interface AplicarMovimientoInput {
  idProducto: number;
  idSede: number;
  idUsuario: number;
  tipoMovimiento: TipoMovimiento;
  /** Con signo: positiva entra (recepción/ajuste al alza), negativa sale (venta/ajuste a la baja). */
  cantidad: number;
  motivo?: MotivoAjuste | null;
  idRecepcion?: number | null;
  idDetallePedido?: number | null;
}

interface ResultadoMovimiento {
  cantidadAnterior: number;
  cantidadResultante: number;
}

/**
 * Único punto de escritura sobre INVENTARIO, usado por recepciones, ajustes
 * y registro de productos en pedido (HU-021, HU-022, HU-026).
 *
 * 1. Crea la fila de INVENTARIO en 0 si esta combinación producto+sede
 *    todavía no tenía una (ON CONFLICT DO NOTHING: no pisa una existente).
 * 2. La bloquea con `FOR UPDATE` dentro de la transacción del llamador, para
 *    que dos movimientos concurrentes sobre el mismo producto+sede no se
 *    pisen (p. ej. dos Meseros agregando el último trago al mismo tiempo).
 * 3. Calcula el resultante y, si quedaría negativo, aborta con 409 — esta es
 *    la regla que hace cumplir, en un solo lugar, tanto "no se permite un
 *    ajuste negativo mayor a la existencia actual" (HU-022 CA-03) como el
 *    bloqueo de productos agotados al vender (HU-023 CA-01): si no alcanza,
 *    no se aplica nada.
 * 4. Dentro de la MISMA transacción, dicho por el llamador vía `client`,
 *    actualiza INVENTARIO y agrega la fila de MOVIMIENTO_INVENTARIO — así
 *    ambas escrituras se confirman o se revierten juntas.
 */
export async function aplicarMovimientoInventario(
  input: AplicarMovimientoInput,
  client: PoolClient
): Promise<ResultadoMovimiento> {
  if (input.cantidad === 0) {
    throw ApiError.badRequest("La cantidad del movimiento no puede ser cero.");
  }

  await client.query(
    `INSERT INTO inventario (id_producto, id_sede, cantidad_disponible)
     VALUES ($1, $2, 0)
     ON CONFLICT (id_producto, id_sede) DO NOTHING`,
    [input.idProducto, input.idSede]
  );

  const { rows } = await client.query<{ cantidad_disponible: number }>(
    `SELECT cantidad_disponible FROM inventario
     WHERE id_producto = $1 AND id_sede = $2
     FOR UPDATE`,
    [input.idProducto, input.idSede]
  );
  const cantidadAnterior = rows[0].cantidad_disponible;
  const cantidadResultante = cantidadAnterior + input.cantidad;

  if (cantidadResultante < 0) {
    throw ApiError.conflict(
      input.tipoMovimiento === "AJUSTE"
        ? "El ajuste dejaría el inventario en un valor negativo: no puede ser mayor a la existencia actual."
        : "No hay suficiente existencia disponible para esta operación.",
      "INVENTARIO_INSUFICIENTE"
    );
  }

  await client.query(
    `UPDATE inventario SET cantidad_disponible = $1, actualizado_en = now()
     WHERE id_producto = $2 AND id_sede = $3`,
    [cantidadResultante, input.idProducto, input.idSede]
  );

  await client.query(
    `INSERT INTO movimiento_inventario
       (id_producto, id_sede, id_usuario, tipo_movimiento, cantidad, cantidad_anterior, cantidad_resultante,
        motivo, id_recepcion, id_detalle_pedido)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.idProducto,
      input.idSede,
      input.idUsuario,
      input.tipoMovimiento,
      input.cantidad,
      cantidadAnterior,
      cantidadResultante,
      input.motivo ?? null,
      input.idRecepcion ?? null,
      input.idDetallePedido ?? null,
    ]
  );

  return { cantidadAnterior, cantidadResultante };
}

/** Disponibilidad actual de un producto en una sede (0 si nunca tuvo movimientos). Usa el pool/cliente del llamador. */
export async function obtenerCantidadDisponible(
  idProducto: number,
  idSede: number,
  client: PoolClient
): Promise<number> {
  const { rows } = await client.query<{ cantidad_disponible: number }>(
    `SELECT cantidad_disponible FROM inventario WHERE id_producto = $1 AND id_sede = $2`,
    [idProducto, idSede]
  );
  return rows[0]?.cantidad_disponible ?? 0;
}
