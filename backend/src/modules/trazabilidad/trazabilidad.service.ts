import { pool } from "../../config/db";

export interface EventoTrazabilidad {
  idEvento: number;
  idUsuario: number | null;
  codigoUsuario: string | null;
  nombreUsuario: string | null;
  tipoEvento: string;
  entidadAfectada: string;
  idAfectado: string | null;
  /** Nombre legible de lo afectado (producto, mesa, sede, pedido...) cuando se puede resolver. */
  nombreAfectado: string | null;
  idSede: number | null;
  nombreSede: string | null;
  fechaHora: string;
  detalle: Record<string, unknown> | null;
}

/** Cantidad máxima de eventos que devuelve la consulta (los más recientes). */
export const MAX_EVENTOS_TRAZABILIDAD = 250;

export interface FiltrosTrazabilidad {
  idUsuario?: number;
  idSede?: number;
  tipoEvento?: string;
  desde?: string;
  hasta?: string;
}

/**
 * HU-040 — Consulta de trazabilidad (solo Administrador, ver rutas).
 * Muestra usuario, acción, información afectada, sede, fecha y hora; el campo
 * `detalle` conserva los valores anterior y resultante cuando el evento los
 * tiene (cambio de precio, ajuste de inventario). Filtros por usuario, sede,
 * tipo de evento y rango de fechas (hora de Colombia). Máximo 250, los más recientes.
 */
export async function consultarTrazabilidad(filtros: FiltrosTrazabilidad): Promise<EventoTrazabilidad[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.idUsuario) {
    valores.push(filtros.idUsuario);
    condiciones.push(`t.id_usuario = $${valores.length}`);
  }
  if (filtros.idSede) {
    valores.push(filtros.idSede);
    condiciones.push(`t.id_sede = $${valores.length}`);
  }
  if (filtros.tipoEvento) {
    valores.push(filtros.tipoEvento);
    condiciones.push(`t.tipo_evento = $${valores.length}`);
  }
  if (filtros.desde) {
    valores.push(filtros.desde);
    condiciones.push(`(t.fecha_hora AT TIME ZONE 'America/Bogota')::date >= $${valores.length}::date`);
  }
  if (filtros.hasta) {
    valores.push(filtros.hasta);
    condiciones.push(`(t.fecha_hora AT TIME ZONE 'America/Bogota')::date <= $${valores.length}::date`);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<{
    id_evento: string;
    id_usuario: number | null;
    codigo_usuario: string | null;
    nombre_usuario: string | null;
    tipo_evento: string;
    entidad_afectada: string;
    id_afectado: string | null;
    nombre_afectado: string | null;
    id_sede: number | null;
    nombre_sede: string | null;
    fecha_hora: string;
    detalle: Record<string, unknown> | null;
  }>(
    `SELECT t.id_evento, t.id_usuario, u.codigo_usuario, u.nombre AS nombre_usuario, t.tipo_evento,
            t.entidad_afectada, t.id_afectado,
            CASE WHEN t.id_afectado ~ '^[0-9]+$' THEN
              CASE t.entidad_afectada
                WHEN 'PRODUCTO'   THEN (SELECT codigo || ' · ' || nombre FROM producto WHERE id_producto = t.id_afectado::int)
                WHEN 'INVENTARIO' THEN (SELECT codigo || ' · ' || nombre FROM producto WHERE id_producto = t.id_afectado::int)
                WHEN 'MESA'       THEN (SELECT identificador FROM mesa WHERE id_mesa = t.id_afectado::int)
                WHEN 'SEDE'       THEN (SELECT nombre FROM sede WHERE id_sede = t.id_afectado::int)
                WHEN 'USUARIO'    THEN (SELECT codigo_usuario || ' · ' || nombre FROM usuario WHERE id_usuario = t.id_afectado::int)
                WHEN 'PROVEEDOR'  THEN (SELECT nombre FROM proveedor WHERE id_proveedor = t.id_afectado::int)
                WHEN 'TIPO_PRODUCTO' THEN (SELECT nombre FROM tipo_producto WHERE id_tipo_producto = t.id_afectado::int)
                WHEN 'PEDIDO'     THEN (SELECT identificador_pedido FROM pedido WHERE id_pedido = t.id_afectado::int)
                WHEN 'PAGO'       THEN (SELECT pd.identificador_pedido FROM pago pg JOIN pedido pd ON pd.id_pedido = pg.id_pedido
                                         WHERE pg.id_pago = t.id_afectado::bigint)
                WHEN 'DETALLE_PEDIDO' THEN (SELECT pr.nombre FROM detalle_pedido dp JOIN producto pr ON pr.id_producto = dp.id_producto
                                             WHERE dp.id_detalle_pedido = t.id_afectado::bigint)
                ELSE NULL
              END
            END AS nombre_afectado,
            t.id_sede, s.nombre AS nombre_sede, t.fecha_hora, t.detalle
     FROM trazabilidad t
     LEFT JOIN usuario u ON u.id_usuario = t.id_usuario
     LEFT JOIN sede s ON s.id_sede = t.id_sede
     ${where}
     ORDER BY t.fecha_hora DESC, t.id_evento DESC
     LIMIT ${MAX_EVENTOS_TRAZABILIDAD}`,
    valores
  );

  return rows.map((r) => ({
    idEvento: Number(r.id_evento),
    idUsuario: r.id_usuario,
    codigoUsuario: r.codigo_usuario,
    nombreUsuario: r.nombre_usuario,
    tipoEvento: r.tipo_evento,
    entidadAfectada: r.entidad_afectada,
    idAfectado: r.id_afectado,
    nombreAfectado: r.nombre_afectado,
    idSede: r.id_sede,
    nombreSede: r.nombre_sede,
    fechaHora: r.fecha_hora,
    detalle: r.detalle,
  }));
}

export async function listarTiposEvento(): Promise<string[]> {
  const { rows } = await pool.query<{ tipo_evento: string }>(
    `SELECT DISTINCT tipo_evento FROM trazabilidad ORDER BY tipo_evento`
  );
  return rows.map((r) => r.tipo_evento);
}
