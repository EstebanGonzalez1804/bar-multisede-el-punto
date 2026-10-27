import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { aplicarMovimientoInventario, obtenerCantidadDisponible } from "../../utils/inventario";
import { exigirSedeActiva } from "../../utils/estadoEntidad";
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
  /** Unidades de la línea ya cubiertas por pagos "por productos" (HU-036). */
  cantidadPagada: number;
  cantidadPendiente: number;
  /** true cuando todas las unidades de la línea están cubiertas. */
  pagada: boolean;
}

export type MetodoPago = "EFECTIVO" | "TARJETA_CREDITO" | "TARJETA_DEBITO";
export type ModalidadPago = "TOTAL" | "ABONO" | "PRODUCTOS";

export interface PagoRegistrado {
  idPago: number;
  metodo: MetodoPago;
  valor: number;
  modalidad: ModalidadPago;
  nombreUsuario: string;
  fechaHora: string;
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
  /** Suma de cantidad × precio congelado de todas las líneas. */
  total: number;
  totalPagado: number;
  saldoPendiente: number;
  pagos: PagoRegistrado[];
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
  cantidad_pagada: string;
}

interface PagoRow {
  id_pago: number;
  metodo: MetodoPago;
  valor: string;
  modalidad: ModalidadPago;
  nombre_usuario: string;
  fecha_hora: string;
}

/** Los importes se manejan en centavos enteros para no acumular errores de coma flotante. */
export function aCentavos(valor: string | number): number {
  return Math.round(Number(valor) * 100);
}

function mapPedido(row: PedidoRow, lineas: LineaRow[], pagos: PagoRow[]): Pedido {
  const totalCent = lineas.reduce((acc, l) => acc + l.cantidad * aCentavos(l.precio_venta_congelado), 0);
  const pagadoCent = pagos.reduce((acc, p) => acc + aCentavos(p.valor), 0);
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
      cantidadPagada: Number(l.cantidad_pagada),
      cantidadPendiente: l.cantidad - Number(l.cantidad_pagada),
      pagada: l.cantidad - Number(l.cantidad_pagada) <= 0,
    })),
    total: totalCent / 100,
    totalPagado: pagadoCent / 100,
    saldoPendiente: (totalCent - pagadoCent) / 100,
    pagos: pagos.map((p) => ({
      idPago: Number(p.id_pago),
      metodo: p.metodo,
      valor: Number(p.valor),
      modalidad: p.modalidad,
      nombreUsuario: p.nombre_usuario,
      fechaHora: p.fecha_hora,
    })),
  };
}

export async function obtenerPedidoConLineas(idPedido: number, ejecutor: Queryable): Promise<Pedido> {
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
            d.cantidad, d.precio_venta_congelado, d.precio_compra_congelado, d.creado_en,
            COALESCE((SELECT SUM(pd.cantidad) FROM pago_detalle_pedido pd WHERE pd.id_detalle_pedido = d.id_detalle_pedido), 0) AS cantidad_pagada
     FROM detalle_pedido d
     JOIN producto pr ON pr.id_producto = d.id_producto
     WHERE d.id_pedido = $1
     ORDER BY d.id_detalle_pedido`,
    [idPedido]
  );

  const { rows: pagoRows } = await ejecutor.query<PagoRow>(
    `SELECT pg.id_pago, pg.metodo, pg.valor, pg.modalidad, u.nombre AS nombre_usuario, pg.fecha_hora
     FROM pago pg
     JOIN usuario u ON u.id_usuario = pg.id_usuario
     WHERE pg.id_pedido = $1
     ORDER BY pg.id_pago`,
    [idPedido]
  );

  return mapPedido(rows[0], lineaRows, pagoRows);
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
    await exigirSedeActiva(mesa.id_sede, client);
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
  // Pedido "en curso" = el que todavía no está pagado por completo: ABIERTO
  // (se le siguen agregando productos) o CERRADO (con la cuenta pendiente de
  // pago). Una mesa solo puede tener uno a la vez.
  const { rows } = await pool.query<{ id_sede: number; id_pedido: number | null }>(
    `SELECT m.id_sede, p.id_pedido
     FROM mesa m
     LEFT JOIN pedido p ON p.id_mesa = m.id_mesa AND p.estado_pago <> 'PAGADO'
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
      // HU-027 CA-03: con un pago registrado no se agrega nada, bajo ninguna
      // circunstancia. Un pedido cerrado tampoco se reabre: se abre una cuenta nueva.
      const { rows: pagos } = await client.query(`SELECT 1 FROM pago WHERE id_pedido = $1 LIMIT 1`, [idPedido]);
      throw ApiError.conflict(
        pagos.length > 0
          ? "El pedido ya tiene un pago registrado: no se le pueden agregar productos."
          : "El pedido está cerrado y no se puede reabrir: cuando se pague la cuenta y la mesa quede libre, abre una cuenta nueva.",
        pagos.length > 0 ? "PEDIDO_CON_PAGO" : "PEDIDO_CERRADO"
      );
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

/** Cajero/Mesero solo operan sobre su sede; el Administrador sobre cualquiera. */
function exigirAccesoSede(usuario: JwtPayload, idSedePedido: number): void {
  if (usuario.perfil !== "ADMINISTRADOR" && usuario.idSede !== idSedePedido) {
    throw ApiError.forbidden("Solo puedes operar pedidos de tu propia sede.");
  }
}

/**
 * HU-028 — Cierre del pedido y generación de la cuenta. Solo Mesero, de su
 * sede. Requiere al menos un producto (CA-04). La mesa permanece OCUPADA
 * (CA-02) y el estado de pago queda PENDIENTE (CA-01). La "cuenta" es el
 * propio pedido cerrado con sus líneas y total (ver HU-031). Un pedido
 * cerrado no se reabre: si hay más consumo, se abre una cuenta nueva.
 */
export async function cerrarPedido(mesero: JwtPayload, idPedido: number): Promise<Pedido> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_sede: number; estado_pedido: string }>(
      `SELECT id_sede, estado_pedido FROM pedido WHERE id_pedido = $1 FOR UPDATE`,
      [idPedido]
    );
    const pedido = rows[0];
    if (!pedido) throw ApiError.notFound("Pedido no encontrado.");
    exigirAccesoSede(mesero, pedido.id_sede);
    if (pedido.estado_pedido !== "ABIERTO") {
      throw ApiError.conflict("El pedido ya está cerrado.", "PEDIDO_YA_CERRADO");
    }

    const { rows: lineas } = await client.query(`SELECT 1 FROM detalle_pedido WHERE id_pedido = $1 LIMIT 1`, [
      idPedido,
    ]);
    if (lineas.length === 0) {
      throw ApiError.conflict("No se puede cerrar un pedido sin productos registrados.", "PEDIDO_SIN_PRODUCTOS");
    }

    await client.query(
      `UPDATE pedido SET estado_pedido = 'CERRADO', estado_pago = 'PENDIENTE', fecha_cierre = now()
       WHERE id_pedido = $1`,
      [idPedido]
    );

    const resultado = await obtenerPedidoConLineas(idPedido, client);

    await registrarEvento(
      {
        idUsuario: mesero.idUsuario,
        tipoEvento: "PEDIDO_CERRADO",
        entidadAfectada: "PEDIDO",
        idAfectado: idPedido,
        idSede: pedido.id_sede,
        detalle: { identificadorPedido: resultado.identificadorPedido, total: resultado.total },
      },
      client
    );

    return resultado;
  });
}

/** Consulta de un pedido por id con control de sede (cuenta, detalle de cobro). */
export async function obtenerPedidoParaUsuario(usuario: JwtPayload, idPedido: number): Promise<Pedido> {
  const pedido = await obtenerPedidoConLineas(idPedido, pool);
  exigirAccesoSede(usuario, pedido.idSede);
  return pedido;
}

export interface ResumenPedido {
  idPedido: number;
  identificadorPedido: string;
  idMesa: number;
  identificadorMesa: string;
  idSede: number;
  nombreSede: string;
  estadoPedido: "ABIERTO" | "CERRADO";
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  fechaApertura: string;
  total: number;
  saldoPendiente: number;
}

export interface FiltrosPedidos {
  /** Sede ya resuelta por resolveSedeScope (null = todas, solo Administrador). */
  idSede: number | null;
  estadoPedido?: "ABIERTO" | "CERRADO";
  /** "PENDIENTE" incluye los pagos parciales (saldo > 0); "PAGADO" solo los saldados. */
  estadoPago?: "PENDIENTE" | "PAGADO" | "TODOS";
  /** Texto: número de pedido o identificador de mesa (búsqueda parcial). */
  busqueda?: string;
  soloPendientesDePago?: boolean;
}

/**
 * HU-030 / HU-032 — Listado de pedidos. HU-030: Mesero y Cajero ven su sede,
 * Administrador todas, con estado del pedido y del pago y filtros por estado o
 * mesa. HU-032: con `soloPendientesDePago` devuelve las cuentas cerradas con
 * saldo > 0 (incluye pagos parciales, mostrando el saldo restante).
 */
export async function listarPedidos(filtros: FiltrosPedidos): Promise<ResumenPedido[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.idSede !== null) {
    valores.push(filtros.idSede);
    condiciones.push(`p.id_sede = $${valores.length}`);
  }
  if (filtros.estadoPedido) {
    valores.push(filtros.estadoPedido);
    condiciones.push(`p.estado_pedido = $${valores.length}`);
  }
  if (filtros.estadoPago === "PAGADO") {
    condiciones.push(`p.estado_pago = 'PAGADO'`);
  } else if (filtros.estadoPago === "PENDIENTE") {
    condiciones.push(`p.estado_pago <> 'PAGADO'`);
  }
  if (filtros.soloPendientesDePago) {
    condiciones.push(`p.estado_pedido = 'CERRADO' AND p.estado_pago <> 'PAGADO'`);
  }
  if (filtros.busqueda) {
    valores.push(`%${filtros.busqueda}%`);
    condiciones.push(
      `(p.identificador_pedido ILIKE $${valores.length} OR m.identificador ILIKE $${valores.length})`
    );
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<{
    id_pedido: number;
    identificador_pedido: string;
    id_mesa: number;
    identificador_mesa: string;
    id_sede: number;
    nombre_sede: string;
    estado_pedido: "ABIERTO" | "CERRADO";
    estado_pago: "PENDIENTE" | "PARCIAL" | "PAGADO";
    fecha_apertura: string;
    total: string;
    pagado: string;
  }>(
    `SELECT p.id_pedido, p.identificador_pedido, p.id_mesa, m.identificador AS identificador_mesa,
            p.id_sede, s.nombre AS nombre_sede, p.estado_pedido, p.estado_pago, p.fecha_apertura,
            COALESCE((SELECT SUM(d.cantidad * d.precio_venta_congelado) FROM detalle_pedido d
                      WHERE d.id_pedido = p.id_pedido), 0) AS total,
            COALESCE((SELECT SUM(pg.valor) FROM pago pg WHERE pg.id_pedido = p.id_pedido), 0) AS pagado
     FROM pedido p
     JOIN mesa m ON m.id_mesa = p.id_mesa
     JOIN sede s ON s.id_sede = p.id_sede
     ${where}
     ORDER BY p.fecha_apertura DESC
     LIMIT 300`,
    valores
  );

  return rows.map((r) => ({
    idPedido: r.id_pedido,
    identificadorPedido: r.identificador_pedido,
    idMesa: r.id_mesa,
    identificadorMesa: r.identificador_mesa,
    idSede: r.id_sede,
    nombreSede: r.nombre_sede,
    estadoPedido: r.estado_pedido,
    estadoPago: r.estado_pago,
    fechaApertura: r.fecha_apertura,
    total: aCentavos(r.total) / 100,
    saldoPendiente: (aCentavos(r.total) - aCentavos(r.pagado)) / 100,
  }));
}

export interface LineaPagoEntrada {
  metodo: MetodoPago;
  valor: number;
  /** Solo efectivo: lo que entrega el cliente; la diferencia son vueltas y NO se almacena (HU-033 CA-02). */
  valorEntregado?: number;
}

export interface RegistrarPagoEntrada {
  modalidad: ModalidadPago;
  lineas: LineaPagoEntrada[];
  /** Solo modalidad PRODUCTOS: producto y unidades que cubre este pago (HU-036). */
  productos?: Array<{ idProducto: number; cantidad: number }>;
}

export interface ResultadoPago {
  pedido: Pedido;
  vueltas: number;
}

function formatoPesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString("es-CO")}`;
}

/**
 * HU-033 a HU-038 — Registro de pagos. Un único punto de entrada para pago
 * único (una línea), pago combinado (varias líneas), abono por monto y pago
 * por productos.
 *
 * Reglas (todas bajo el bloqueo FOR UPDATE del pedido, para que dos cajeros
 * no cobren la misma cuenta a la vez):
 * - El pedido debe estar CERRADO y no pagado por completo.
 * - TOTAL: la suma de las líneas debe igualar exactamente el saldo (HU-033
 *   CA-03, HU-034 CA-02/CA-03). Si falta o sobra, se rechaza informando el saldo.
 * - ABONO: cualquier valor > 0 y <= saldo; la cuenta queda con saldo visible
 *   y sin liberar la mesa (HU-035).
 * - PRODUCTOS: la suma debe igualar el valor de las líneas elegidas, que no
 *   pueden estar ya cubiertas por otro pago (HU-036).
 * - Saldo 0 => pedido PAGADO y mesa LIBRE de inmediato (HU-037). Nunca se
 *   libera la mesa por el paso del tiempo ni con saldo > 0.
 * - Un pedido cerrado no se reabre; los pagos no
 *   tienen ninguna operación de edición/anulación (y la BD lo impide con un
 *   trigger).
 */
export async function registrarPago(
  usuario: JwtPayload,
  idPedido: number,
  entrada: RegistrarPagoEntrada
): Promise<ResultadoPago> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id_sede: number;
      id_mesa: number;
      estado_pedido: string;
      estado_pago: string;
      identificador_pedido: string;
    }>(
      `SELECT id_sede, id_mesa, estado_pedido, estado_pago, identificador_pedido
       FROM pedido WHERE id_pedido = $1 FOR UPDATE`,
      [idPedido]
    );
    const pedido = rows[0];
    if (!pedido) throw ApiError.notFound("Pedido no encontrado.");
    exigirAccesoSede(usuario, pedido.id_sede);
    if (pedido.estado_pedido !== "CERRADO") {
      throw ApiError.conflict("El pedido sigue abierto: debe cerrarse (generar la cuenta) antes de cobrar.", "PEDIDO_ABIERTO");
    }
    if (pedido.estado_pago === "PAGADO") {
      throw ApiError.conflict("Este pedido ya está pagado por completo.", "PEDIDO_YA_PAGADO");
    }

    const actual = await obtenerPedidoConLineas(idPedido, client);
    const saldoCent = aCentavos(actual.saldoPendiente);

    if (entrada.lineas.length === 0) {
      throw ApiError.badRequest("Agrega al menos un método de pago con su valor.");
    }
    for (const l of entrada.lineas) {
      if (!(aCentavos(l.valor) > 0)) {
        throw ApiError.badRequest("Cada valor de pago debe ser mayor a cero.");
      }
      if (l.valorEntregado !== undefined) {
        if (l.metodo !== "EFECTIVO") {
          throw ApiError.badRequest("El valor entregado solo aplica a pagos en efectivo.");
        }
        if (aCentavos(l.valorEntregado) < aCentavos(l.valor)) {
          throw ApiError.badRequest("El valor entregado en efectivo no puede ser menor al valor a pagar.");
        }
      }
    }
    const sumaCent = entrada.lineas.reduce((acc, l) => acc + aCentavos(l.valor), 0);

    // Asignación de unidades a líneas del pedido (solo modalidad PRODUCTOS).
    const asignaciones: Array<{ idDetallePedido: number; cantidad: number }> = [];
    if (entrada.modalidad === "PRODUCTOS") {
      const pedidos = entrada.productos ?? [];
      if (pedidos.length === 0) {
        throw ApiError.badRequest("Selecciona al menos un producto de la cuenta.");
      }
      const idsVistos = new Set<number>();
      let esperadoCent = 0;
      for (const item of pedidos) {
        if (idsVistos.has(item.idProducto)) {
          throw ApiError.badRequest("Un producto no puede repetirse en la selección.");
        }
        idsVistos.add(item.idProducto);
        const lineasProducto = actual.lineas.filter((l) => l.idProducto === item.idProducto);
        if (lineasProducto.length === 0) {
          throw ApiError.badRequest("Alguno de los productos seleccionados no pertenece a este pedido.");
        }
        const pendiente = lineasProducto.reduce((acc, l) => acc + l.cantidadPendiente, 0);
        if (item.cantidad > pendiente) {
          throw ApiError.conflict(
            `Solo quedan ${pendiente} unidad(es) por pagar de ${lineasProducto[0].nombreProducto}.`,
            "CANTIDAD_SUPERA_PENDIENTE"
          );
        }
        // Se cubren primero las líneas más antiguas, cada una a su precio congelado.
        let restante = item.cantidad;
        for (const l of lineasProducto) {
          if (restante === 0) break;
          const tomar = Math.min(restante, l.cantidadPendiente);
          if (tomar > 0) {
            asignaciones.push({ idDetallePedido: l.idDetallePedido, cantidad: tomar });
            esperadoCent += tomar * aCentavos(l.precioVentaCongelado);
            restante -= tomar;
          }
        }
      }
      if (esperadoCent > saldoCent) {
        throw ApiError.conflict(
          `Los productos seleccionados (${formatoPesos(esperadoCent)}) superan el saldo pendiente (${formatoPesos(saldoCent)}).`,
          "PAGO_SUPERA_SALDO"
        );
      }
      if (sumaCent !== esperadoCent) {
        throw ApiError.conflict(
          `El valor del pago debe ser igual al de los productos seleccionados (${formatoPesos(esperadoCent)}).`,
          "PAGO_NO_COINCIDE"
        );
      }
    } else if (entrada.modalidad === "ABONO") {
      if (sumaCent > saldoCent) {
        throw ApiError.conflict(
          `El abono (${formatoPesos(sumaCent)}) supera el saldo pendiente (${formatoPesos(saldoCent)}).`,
          "PAGO_SUPERA_SALDO"
        );
      }
    } else {
      // TOTAL: un único pago por el saldo exacto (un solo método).
      if (entrada.lineas.length !== 1) {
        throw ApiError.badRequest(
          "El pago completo es un único pago con un solo método. Para combinar métodos o pagar por partes usa un abono."
        );
      }
      if (sumaCent < saldoCent) {
        throw ApiError.conflict(
          `El valor no cubre el total de la cuenta. Saldo pendiente restante: ${formatoPesos(saldoCent - sumaCent)}.`,
          "PAGO_INSUFICIENTE"
        );
      }
      if (sumaCent > saldoCent) {
        throw ApiError.conflict(
          `La suma de los métodos (${formatoPesos(sumaCent)}) supera el saldo de la cuenta (${formatoPesos(saldoCent)}).`,
          "PAGO_SUPERA_SALDO"
        );
      }
    }

    let primerPago: number | null = null;
    let vueltasCent = 0;
    for (const l of entrada.lineas) {
      const { rows: pagoRows } = await client.query<{ id_pago: number }>(
        `INSERT INTO pago (id_pedido, id_usuario, metodo, valor, modalidad)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_pago`,
        [idPedido, usuario.idUsuario, l.metodo, l.valor, entrada.modalidad]
      );
      const idPago = Number(pagoRows[0].id_pago);
      if (primerPago === null) primerPago = idPago;
      if (l.valorEntregado !== undefined) {
        vueltasCent += aCentavos(l.valorEntregado) - aCentavos(l.valor);
      }

      await registrarEvento(
        {
          idUsuario: usuario.idUsuario,
          tipoEvento: "PAGO_REGISTRADO",
          entidadAfectada: "PAGO",
          idAfectado: idPago,
          idSede: pedido.id_sede,
          detalle: {
            idPedido,
            identificadorPedido: pedido.identificador_pedido,
            metodo: l.metodo,
            valor: l.valor,
            modalidad: entrada.modalidad,
            ...(entrada.modalidad === "PRODUCTOS" && l === entrada.lineas[0]
              ? { productosCubiertos: entrada.productos }
              : {}),
          },
        },
        client
      );
    }

    if (entrada.modalidad === "PRODUCTOS" && primerPago !== null) {
      for (const a of asignaciones) {
        await client.query(
          `INSERT INTO pago_detalle_pedido (id_pago, id_detalle_pedido, cantidad) VALUES ($1, $2, $3)`,
          [primerPago, a.idDetallePedido, a.cantidad]
        );
      }
    }

    const nuevoSaldoCent = saldoCent - sumaCent;
    if (nuevoSaldoCent === 0) {
      await client.query(`UPDATE pedido SET estado_pago = 'PAGADO' WHERE id_pedido = $1`, [idPedido]);
      await client.query(`UPDATE mesa SET estado = 'LIBRE', actualizado_en = now() WHERE id_mesa = $1`, [
        pedido.id_mesa,
      ]);
      await registrarEvento(
        {
          idUsuario: usuario.idUsuario,
          tipoEvento: "PEDIDO_PAGADO",
          entidadAfectada: "PEDIDO",
          idAfectado: idPedido,
          idSede: pedido.id_sede,
          detalle: { identificadorPedido: pedido.identificador_pedido, total: actual.total },
        },
        client
      );
      await registrarEvento(
        {
          idUsuario: usuario.idUsuario,
          tipoEvento: "MESA_LIBERADA",
          entidadAfectada: "MESA",
          idAfectado: pedido.id_mesa,
          idSede: pedido.id_sede,
          detalle: { motivo: "PAGO_COMPLETO", idPedido },
        },
        client
      );
    } else {
      await client.query(`UPDATE pedido SET estado_pago = 'PARCIAL' WHERE id_pedido = $1`, [idPedido]);
    }

    return { pedido: await obtenerPedidoConLineas(idPedido, client), vueltas: vueltasCent / 100 };
  });
}
