import { pool } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface TipoProducto {
  idTipoProducto: number;
  nombre: string;
  creadoEn: string;
}

interface TipoProductoRow {
  id_tipo_producto: number;
  nombre: string;
  creado_en: string;
}

function mapRow(row: TipoProductoRow): TipoProducto {
  return {
    idTipoProducto: row.id_tipo_producto,
    nombre: row.nombre,
    creadoEn: row.creado_en,
  };
}

function esViolacionUnicidad(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === "23505";
}

/** HU-013 CA-01 — Creación de tipos de producto. */
export async function crearTipoProducto(admin: JwtPayload, nombre: string): Promise<TipoProducto> {
  let tipo: TipoProductoRow;
  try {
    const { rows } = await pool.query<TipoProductoRow>(
      `INSERT INTO tipo_producto (nombre) VALUES ($1) RETURNING id_tipo_producto, nombre, creado_en`,
      [nombre]
    );
    tipo = rows[0];
  } catch (err) {
    if (esViolacionUnicidad(err)) {
      throw ApiError.conflict("Ya existe un tipo de producto con ese nombre.");
    }
    throw err;
  }

  await registrarEvento({
    idUsuario: admin.idUsuario,
    tipoEvento: "TIPO_PRODUCTO_CREADO",
    entidadAfectada: "TIPO_PRODUCTO",
    idAfectado: tipo.id_tipo_producto,
  });

  return mapRow(tipo);
}

/** HU-013 CA-02 — Modificación (implícita en "crear o modificar" de la CA). */
export async function modificarTipoProducto(
  admin: JwtPayload,
  idTipoProducto: number,
  nombre: string
): Promise<TipoProducto> {
  let tipo: TipoProductoRow | undefined;
  try {
    const { rows } = await pool.query<TipoProductoRow>(
      `UPDATE tipo_producto SET nombre = $1 WHERE id_tipo_producto = $2
       RETURNING id_tipo_producto, nombre, creado_en`,
      [nombre, idTipoProducto]
    );
    tipo = rows[0];
  } catch (err) {
    if (esViolacionUnicidad(err)) {
      throw ApiError.conflict("Ya existe un tipo de producto con ese nombre.");
    }
    throw err;
  }
  if (!tipo) {
    throw ApiError.notFound("Tipo de producto no encontrado.");
  }

  await registrarEvento({
    idUsuario: admin.idUsuario,
    tipoEvento: "TIPO_PRODUCTO_MODIFICADO",
    entidadAfectada: "TIPO_PRODUCTO",
    idAfectado: idTipoProducto,
  });

  return mapRow(tipo);
}

export async function listarTiposProducto(): Promise<TipoProducto[]> {
  const { rows } = await pool.query<TipoProductoRow>(
    `SELECT id_tipo_producto, nombre, creado_en FROM tipo_producto ORDER BY nombre`
  );
  return rows.map(mapRow);
}

export interface TipoProductoConProductos extends TipoProducto {
  productos: Array<{ idProducto: number; codigo: string; nombre: string; estado: string }>;
}

/** HU-013 CA-03 — ver los productos ya asociados a un tipo. */
export async function obtenerTipoProductoConProductos(idTipoProducto: number): Promise<TipoProductoConProductos> {
  const { rows: tipoRows } = await pool.query<TipoProductoRow>(
    `SELECT id_tipo_producto, nombre, creado_en FROM tipo_producto WHERE id_tipo_producto = $1`,
    [idTipoProducto]
  );
  const tipo = tipoRows[0];
  if (!tipo) {
    throw ApiError.notFound("Tipo de producto no encontrado.");
  }

  const { rows: productoRows } = await pool.query<{
    id_producto: number;
    codigo: string;
    nombre: string;
    estado: string;
  }>(
    `SELECT id_producto, codigo, nombre, estado FROM producto WHERE id_tipo_producto = $1 ORDER BY nombre`,
    [idTipoProducto]
  );

  return {
    ...mapRow(tipo),
    productos: productoRows.map((p) => ({
      idProducto: p.id_producto,
      codigo: p.codigo,
      nombre: p.nombre,
      estado: p.estado,
    })),
  };
}
