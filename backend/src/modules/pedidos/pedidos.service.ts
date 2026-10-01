import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { aplicarMovimientoInventario, obtenerCantidadDisponible } from "../../utils/inventario";
import { siguienteConsecutivo } from "../../utils/secuencia";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

type Queryable = Pool | PoolClient;

export interface LineaPedido {
  idDetallePedido: number;
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
  precioVentaCongelado: string;
  precioCompraCongelado: string;
  creadoEn: string;
}

export interface Pedido {
  idPedido: number;
  identificadorPedido: string;
  idMesa: number;
  identificadorMesa: string;
  idSede: number;
  nombreSede: string;
  idUsuarioMesero: number;
  nombreMesero: string;
  estadoPedido: "ABIERTO" | "CERRADO";
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  fechaApertura: string;
  fechaCierre: string | null;
  lineas: LineaPedido[];
}

interface PedidoRow {
  id_pedido: number;
  identificador_pedido: string;
  id_mesa: number;
  identificador_mesa: string;
  id_sede: number;
  nombre_sede: string;
  id_usuario_mesero: number;
  nombre_mesero: string;
  estado_pedido: "ABIERTO" | "CERRADO";
  estado_pago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  fecha_apertura: string;
  fecha_cierre: string | null;
}

interface LineaRow {
  id_detalle_pedido: number;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_venta_congelado: string;
  precio_compra_congelado: string;
  creado_en: string;
}

function mapPedido(row: PedidoRow, lineas: LineaRow[]): Pedido {
  return {
    idPedido: row.id_pedido,
    identificadorPedido: row.identificador_pedido,
    idMesa: row.id_mesa,
    identificadorMesa: row.identificador_mesa,
    idSede: row.id_sede,
    nombreSede: row.nombre_sede,
    idUsuarioMesero: row.id_usuario_mesero,
    nombreMesero: row.nombre_mesero,
    estadoPedido: row.estado_pedido,
    estadoPago: row.estado_pago,
    fechaApertura: row.fecha_apertura,
    fechaCierre: row.fecha_cierre,
    lineas: lineas.map((l) => ({
      idDetallePedido: l.id_detalle_pedido,
      idProducto: l.id_producto,
      codigoProducto: l.codigo_producto,
      nombreProducto: l.nombre_producto,
      cantidad: l.cantidad,
      precioVentaCongelado: l.precio_venta_congelado,
      precioCompraCongelado: l.precio_compra_congelado,
      creadoEn: l.creado_en,
    })),
  };
}

async function obtenerPedidoConLineas(idPedido: number, ejecutor: Queryable): Promise<Pedido> {
  const { rows } = await ejecutor.query<PedidoRow>(
    `SELECT p.id_pedido, p.identificador_pedido, p.id_mesa, m.identificador AS identificador_mesa,
            p.id_sede, s.nombre AS nombre_sede, p.id_usuario_mesero, u.nombre AS nombre_mesero,
            p.estado_pedido, p.estado_pago, p.fecha_apertura, p.fecha_cierre
     FROM pedido p
     JOIN mesa m ON m.id_mesa = p.id_mesa
     JOIN sede s ON s.id_sede = p.id_sede
     JOIN usuario u ON u.id_usuario = p.id_usuario_mesero
     WHERE p.id_pedido = $1`,
    [idPedido]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Pedido no encontrado.");
  }

  const { rows: lineaRows } = await ejecutor.query<LineaRow>(
    `SELECT d.id_detalle_pedido, d.id_producto, pr.codigo AS codigo_producto, pr.nombre AS nombre_producto,
            d.cantidad, d.precio_venta_congelado, d.precio_compra_congelado, d.creado_en
     FROM detalle_pedido d
     JOIN producto pr ON pr.id_producto = d.id_producto
     WHERE d.id_pedido = $1
     ORDER BY d.id_detalle_pedido`,
    [idPedido]
  );

  return mapPedido(rows[0], lineaRows);
}

/**
 * Identificador de pedido: prefijo de sede + consecutivo SIN relleno de
 * ceros (HU-025 CA-03, a propósito distinto del patrón PDT-AGU-001 /
 * SE01-CAJ-001 usado en usuarios y productos, que sí rellenan). Ej.
 * "SE01-1", "SE01-2", ..., "SE01-137".
 */
async function generarIdentificadorPedido(codigoSede: string, client: PoolClient): Promise<string> {
  const n = await siguienteConsecutivo(`PEDIDO-${codigoSede}`, client);
  return `${codigoSede}-${n}`;
}

/**
 * HU-025 — Apertura de pedido sobre mesa libre. Solo Mesero (igual que
 * HU-023/HU-024/HU-026, todas con ese mismo actor único en el documento
 * aprobado) y únicamente sobre una mesa de su propia sede. CA-01: mesa
 * LIBRE -> pedido ABIERTO + mesa pasa a OCUPADA, en una sola transacción.
 * CA-02: mesa OCUPADA se rechaza. CA-04: el pedido queda ligado para
 * siempre a esa mesa (no existe ningún endpoint de "trasladar").
 */
export async function crearPedido(mesero: JwtPayload, idMesa: number): Promise<Pedido> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_sede: number; codigo_sede: string; estado: string }>(
      `SELECT m.id_sede, s.codigo_sede, m.estado
       FROM mesa m JOIN sede s ON s.id_sede = m.id_sede
       WHERE m.id_mesa = $1
       FOR UPDATE OF m`,
      [idMesa]
    );
    const mesa = rows[0];
    if (!mesa) {
      throw ApiError.notFound("Mesa no encontrada.");
    }
    if (mesa.id_sede !== mesero.idSede) {
      throw ApiError.forbidden("Solo puedes abrir pedidos sobre mesas de tu propia sede.");
    }
    if (mesa.estado !== "LIBRE") {
      throw ApiError.conflict(
        mesa.estado === "OCUPADA" ? "La mesa ya tiene un pedido abierto." : "La mesa está inactiva.",
        "MESA_NO_DISPONIBLE"
      );
    }

    const identificadorPedido = await generarIdentificadorPedido(mesa.codigo_sede, client);

    const { rows: pedidoRows } = await client.query<{ id_pedido: number }>(
      `INSERT INTO pedido (identificador_pedido, id_mesa, id_sede, id_usuario_mesero)
       VALUES ($1, $2, $3, $4) RETURNING id_pedido`,
      [identificadorPedido, idMesa, mesa.id_sede, mesero.idUsuario]
    );
    const idPedido = pedidoRows[0].id_pedido;

    await client.query(`UPDATE mesa SET estado = 'OCUPADA', actualizado_en = now() WHERE id_mesa = $1`, [
      idMesa,
    ]);

    await registrarEvento(
      {
        idUsuario: mesero.idUsuario,
        tipoEvento: "PEDIDO_ABIERTO",
        entidadAfectada: "PEDIDO",
        idAfectado: idPedido,
        idSede: mesa.id_sede,
        detalle: { identificadorPedido, idMesa },
      },
      client
    );

    return obtenerPedidoConLineas(idPedido, client);
  });
}

/**
 * HU-024/HU-025/HU-026 — punto de entrada del Mesero al hacer clic sobre
 * una mesa: si está LIBRE, abre un pedido nuevo (crearPedido); si está
 * OCUPADA, debe retomar el pedido ya abierto para seguir registrando
 * productos (HU-026 no limita el registro a "una sola vez": mientras el
 * pedido siga ABIERTO — y en Sprint 3 nunca se cierra, porque HU-028 es
 * Sprint 4 — se puede seguir agregando). Devuelve null si la mesa está
 * LIBRE y no tiene nada que retomar.
 */
export async function obtenerPedidoAbiertoPorMesa(idMesa: number, mesero: JwtPayload): Promise<Pedido | null> {
  const { rows } = await pool.query<{ id_sede: number; id_pedido: number | null }>(
    `SELECT m.id_sede, p.id_pedido
     FROM mesa m
     LEFT JOIN pedido p ON p.id_mesa = m.id_mesa AND p.estado_pedido = 'ABIERTO'
     WHERE m.id_mesa = $1`,
    [idMesa]
  );
  const mesa = rows[0];
  if (!mesa) {
    throw ApiError.notFound("Mesa no encontrada.");
  }
  if (mesa.id_sede !== mesero.idSede) {
    throw ApiError.forbidden("Solo puedes operar mesas de tu propia sede.");
  }
  if (mesa.id_pedido === null) {
    return null;
  }
  return obtenerPedidoConLineas(mesa.id_pedido, pool);
}

interface DatosLineaPedido {
  idProducto: number;
  cantidad: number;
}

/**
 * HU-026 — Registro de un producto en el pedido, con descuento inmediato de
 * inventario. Solo Mesero, solo sobre un pedido de su propia sede.
 *
 * Orden de las escrituras, todas en una transacción: primero se inserta la
 * línea (congelando el precio vigente de PRODUCTO en ese instante, CA-04),
 * y DESPUÉS se descuenta inventario con aplicarMovimientoInventario. Si no
 * hay existencia suficiente (HU-023 CA-01), esa función lanza y el ROLLBACK
 * de la transacción deshace también la línea insertada — no queda ninguna
 * línea "huérfana" sin su movimiento correspondiente.
 *
 * CA-05: esta es la ÚNICA operación de escritura que existe sobre
 * DETALLE_PEDIDO — no hay (y no debe haber) ningún endpoint para editar o
 * eliminar una línea ya creada.
 */
export async function registrarProductoEnPedido(
  mesero: JwtPayload,
  idPedido: number,
  datos: DatosLineaPedido
): Promise<Pedido> {
  return withTransaction(async (client) => {
    const { rows: pedidoRows } = await client.query<{ id_sede: number; estado_pedido: string }>(
      `SELECT id_sede, estado_pedido FROM pedido WHERE id_pedido = $1 FOR UPDATE`,
      [idPedido]
    );
    const pedido = pedidoRows[0];
    if (!pedido) {
      throw ApiError.notFound("Pedido no encontrado.");
    }
    if (pedido.id_sede !== mesero.idSede) {
      throw ApiError.forbidden("Solo puedes registrar productos en pedidos de tu propia sede.");
    }
    if (pedido.estado_pedido !== "ABIERTO") {
      throw ApiError.conflict("El pedido ya está cerrado; no se le pueden agregar productos.", "PEDIDO_CERRADO");
    }

    const { rows: productoRows } = await client.query<{
      estado: "ACTIVO" | "INACTIVO";
      valor_venta: string;
      valor_compra: string;
    }>(`SELECT estado, valor_venta, valor_compra FROM producto WHERE id_producto = $1`, [datos.idProducto]);
    const producto = productoRows[0];
    if (!producto) {
      throw ApiError.notFound("El producto indicado no existe.");
    }
    // HU-026 CA-03: un producto inactivo no puede agregarse a un pedido nuevo.
    if (producto.estado !== "ACTIVO") {
      throw ApiError.conflict("Este producto está inactivo y no se puede agregar al pedido.", "PRODUCTO_INACTIVO");
    }

    // HU-023 CA-01: bloqueo preventivo antes de crear la línea, para dar un
    // mensaje claro sin depender únicamente del rollback por inventario
    // insuficiente que hace aplicarMovimientoInventario más abajo.
    const disponible = await obtenerCantidadDisponible(datos.idProducto, pedido.id_sede, client);
    if (disponible < datos.cantidad) {
      throw ApiError.conflict(
        disponible === 0
          ? "Este producto está agotado en esta sede."
          : `Solo hay ${disponible} unidad(es) disponibles de este producto en esta sede.`,
        "PRODUCTO_AGOTADO"
      );
    }

    const { rows: detalleRows } = await client.query<{ id_detalle_pedido: number }>(
      `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_venta_congelado, precio_compra_congelado)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_detalle_pedido`,
      [idPedido, datos.idProducto, datos.cantidad, producto.valor_venta, producto.valor_compra]
    );
    const idDetallePedido = detalleRows[0].id_detalle_pedido;

    await aplicarMovimientoInventario(
      {
        idProducto: datos.idProducto,
        idSede: pedido.id_sede,
        idUsuario: mesero.idUsuario,
        tipoMovimiento: "VENTA",
        cantidad: -datos.cantidad,
        idDetallePedido,
      },
      client
    );

    await registrarEvento(
      {
        idUsuario: mesero.idUsuario,
        tipoEvento: "PRODUCTO_REGISTRADO_EN_PEDIDO",
        entidadAfectada: "DETALLE_PEDIDO",
        idAfectado: idDetallePedido,
        idSede: pedido.id_sede,
        detalle: {
          idPedido,
          idProducto: datos.idProducto,
          cantidad: datos.cantidad,
          precioVentaCongelado: producto.valor_venta,
          precioCompraCongelado: producto.valor_compra,
        },
      },
      client
    );

    return obtenerPedidoConLineas(idPedido, client);
  });
}
