import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { aplicarMovimientoInventario } from "../../utils/inventario";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

type Queryable = Pool | PoolClient;

export interface LineaRecepcion {
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
}

export interface Recepcion {
  idRecepcion: number;
  idProveedor: number;
  nombreProveedor: string;
  idSede: number;
  nombreSede: string;
  idUsuario: number;
  nombreUsuario: string;
  fechaRecepcion: string;
  creadoEn: string;
  lineas: LineaRecepcion[];
}

interface RecepcionRow {
  id_recepcion: number;
  id_proveedor: number;
  nombre_proveedor: string;
  id_sede: number;
  nombre_sede: string;
  id_usuario: number;
  nombre_usuario: string;
  fecha_recepcion: string;
  creado_en: string;
}

interface LineaRow {
  id_recepcion: number;
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
}

interface DatosLineaRecepcion {
  idProducto: number;
  cantidad: number;
}

interface DatosRecepcion {
  idProveedor: number;
  idSede: number;
  fechaRecepcion: string;
  lineas: DatosLineaRecepcion[];
}

/**
 * HU-021 — Registro de recepción de mercancía. Una sola transacción:
 * encabezado + una línea de MOVIMIENTO_INVENTARIO (vía
 * aplicarMovimientoInventario) por cada producto recibido, que ya suma a
 * INVENTARIO (CA-01/CA-02). CA-04 (rechazar cantidades no numéricas,
 * negativas o cero) ya lo cubre Zod en el schema antes de llegar aquí; CA-05
 * (no se editan precios) se cumple por diseño: este formulario no toca
 * PRODUCTO.valor_compra/valor_venta en absoluto.
 *
 * `usuario` puede ser Administrador o Cajero (CA-03 HU-021); si es Cajero,
 * el controller ya resolvió `datos.idSede` a su propia sede vía
 * resolveSedeScope, así que aquí solo queda validar que esa sede exista.
 */
export async function crearRecepcion(usuario: JwtPayload, datos: DatosRecepcion): Promise<Recepcion> {
  return withTransaction(async (client) => {
    const { rows: proveedorRows } = await client.query(
      `SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1`,
      [datos.idProveedor]
    );
    if (!proveedorRows[0]) {
      throw ApiError.notFound("El proveedor indicado no existe.");
    }

    const { rows: sedeRows } = await client.query(`SELECT id_sede FROM sede WHERE id_sede = $1`, [
      datos.idSede,
    ]);
    if (!sedeRows[0]) {
      throw ApiError.notFound("La sede indicada no existe.");
    }

    const { rows: recepcionRows } = await client.query<{ id_recepcion: number }>(
      `INSERT INTO recepcion_mercancia (id_proveedor, id_sede, id_usuario, fecha_recepcion)
       VALUES ($1, $2, $3, $4) RETURNING id_recepcion`,
      [datos.idProveedor, datos.idSede, usuario.idUsuario, datos.fechaRecepcion]
    );
    const idRecepcion = recepcionRows[0].id_recepcion;

    const lineasRegistradas: Array<{ idProducto: number; cantidad: number }> = [];
    for (const linea of datos.lineas) {
      const { rows: productoRows } = await client.query<{ id_producto: number }>(
        `SELECT id_producto FROM producto WHERE id_producto = $1`,
        [linea.idProducto]
      );
      if (!productoRows[0]) {
        throw ApiError.notFound(`El producto con id ${linea.idProducto} no existe.`);
      }

      await aplicarMovimientoInventario(
        {
          idProducto: linea.idProducto,
          idSede: datos.idSede,
          idUsuario: usuario.idUsuario,
          tipoMovimiento: "RECEPCION",
          cantidad: linea.cantidad,
          idRecepcion,
        },
        client
      );
      lineasRegistradas.push({ idProducto: linea.idProducto, cantidad: linea.cantidad });
    }

    // CA-07 HU-021 — trazabilidad con proveedor, fecha, hora, sede, usuario,
    // productos y cantidades; fecha/hora/sede/usuario ya quedan en la propia
    // fila de trazabilidad, aquí solo falta lo específico de esta operación.
    await registrarEvento(
      {
        idUsuario: usuario.idUsuario,
        tipoEvento: "RECEPCION_REGISTRADA",
        entidadAfectada: "RECEPCION_MERCANCIA",
        idAfectado: idRecepcion,
        idSede: datos.idSede,
        detalle: { idProveedor: datos.idProveedor, fechaRecepcion: datos.fechaRecepcion, lineas: lineasRegistradas },
      },
      client
    );

    return obtenerRecepcionConLineas(idRecepcion, client);
  });
}

async function obtenerRecepcionConLineas(idRecepcion: number, ejecutor: Queryable): Promise<Recepcion> {
  const { rows } = await ejecutor.query<RecepcionRow>(
    `SELECT r.id_recepcion, r.id_proveedor, pr.nombre AS nombre_proveedor,
            r.id_sede, s.nombre AS nombre_sede, r.id_usuario, u.nombre AS nombre_usuario,
            r.fecha_recepcion, r.creado_en
     FROM recepcion_mercancia r
     JOIN proveedor pr ON pr.id_proveedor = r.id_proveedor
     JOIN sede s ON s.id_sede = r.id_sede
     JOIN usuario u ON u.id_usuario = r.id_usuario
     WHERE r.id_recepcion = $1`,
    [idRecepcion]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Recepción no encontrada.");
  }

  const { rows: lineaRows } = await ejecutor.query<LineaRow>(
    `SELECT m.id_recepcion, m.id_producto, p.codigo AS codigo_producto, p.nombre AS nombre_producto, m.cantidad
     FROM movimiento_inventario m
     JOIN producto p ON p.id_producto = m.id_producto
     WHERE m.id_recepcion = $1
     ORDER BY m.id_movimiento`,
    [idRecepcion]
  );

  return mapRecepcion(rows[0], lineaRows);
}

function mapRecepcion(row: RecepcionRow, lineaRows: LineaRow[]): Recepcion {
  return {
    idRecepcion: row.id_recepcion,
    idProveedor: row.id_proveedor,
    nombreProveedor: row.nombre_proveedor,
    idSede: row.id_sede,
    nombreSede: row.nombre_sede,
    idUsuario: row.id_usuario,
    nombreUsuario: row.nombre_usuario,
    fechaRecepcion: row.fecha_recepcion,
    creadoEn: row.creado_en,
    lineas: lineaRows.map((l) => ({
      idProducto: l.id_producto,
      codigoProducto: l.codigo_producto,
      nombreProducto: l.nombre_producto,
      cantidad: l.cantidad,
    })),
  };
}

interface FiltrosRecepciones {
  idProveedor?: number;
  idSede: number | null; // ya resuelto por resolveSedeScope
  desde?: string;
  hasta?: string;
}

/**
 * HU-019 — Consulta de recepciones por proveedor, con filtro de sede y
 * fecha (CA-01/CA-02). `idSede: null` significa Administrador sin filtrar
 * (ve todas las sedes); Cajero siempre llega acotado a la suya.
 */
export async function listarRecepciones(filtros: FiltrosRecepciones): Promise<Recepcion[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.idProveedor !== undefined) {
    valores.push(filtros.idProveedor);
    condiciones.push(`r.id_proveedor = $${valores.length}`);
  }
  if (filtros.idSede !== null) {
    valores.push(filtros.idSede);
    condiciones.push(`r.id_sede = $${valores.length}`);
  }
  if (filtros.desde) {
    valores.push(filtros.desde);
    condiciones.push(`r.fecha_recepcion >= $${valores.length}`);
  }
  if (filtros.hasta) {
    valores.push(filtros.hasta);
    condiciones.push(`r.fecha_recepcion <= $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<RecepcionRow>(
    `SELECT r.id_recepcion, r.id_proveedor, pr.nombre AS nombre_proveedor,
            r.id_sede, s.nombre AS nombre_sede, r.id_usuario, u.nombre AS nombre_usuario,
            r.fecha_recepcion, r.creado_en
     FROM recepcion_mercancia r
     JOIN proveedor pr ON pr.id_proveedor = r.id_proveedor
     JOIN sede s ON s.id_sede = r.id_sede
     JOIN usuario u ON u.id_usuario = r.id_usuario
     ${where}
     ORDER BY r.fecha_recepcion DESC, r.id_recepcion DESC`,
    valores
  );

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id_recepcion);
  const { rows: lineaRows } = await pool.query<LineaRow>(
    `SELECT m.id_recepcion, m.id_producto, p.codigo AS codigo_producto, p.nombre AS nombre_producto, m.cantidad
     FROM movimiento_inventario m
     JOIN producto p ON p.id_producto = m.id_producto
     WHERE m.id_recepcion = ANY($1::int[])
     ORDER BY m.id_movimiento`,
    [ids]
  );

  const lineasPorRecepcion = new Map<number, LineaRow[]>();
  for (const l of lineaRows) {
    const lista = lineasPorRecepcion.get(l.id_recepcion) ?? [];
    lista.push(l);
    lineasPorRecepcion.set(l.id_recepcion, lista);
  }

  return rows.map((r) => mapRecepcion(r, lineasPorRecepcion.get(r.id_recepcion) ?? []));
}
