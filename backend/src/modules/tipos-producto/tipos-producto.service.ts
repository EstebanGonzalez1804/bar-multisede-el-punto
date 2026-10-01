import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface TipoProducto {
  idTipoProducto: number;
  nombre: string;
  /** 3 letras, derivadas del nombre al crear el tipo — ver generarAbreviacion(). */
  abreviacion: string;
  creadoEn: string;
}

interface TipoProductoRow {
  id_tipo_producto: number;
  nombre: string;
  abreviacion: string;
  creado_en: string;
}

const COLUMNAS = "id_tipo_producto, nombre, abreviacion, creado_en";

function mapRow(row: TipoProductoRow): TipoProducto {
  return {
    idTipoProducto: row.id_tipo_producto,
    nombre: row.nombre,
    abreviacion: row.abreviacion,
    creadoEn: row.creado_en,
  };
}

function obtenerConstraintViolado(err: unknown): string | null {
  const e = err as { code?: string; constraint?: string } | undefined;
  return e?.code === "23505" ? (e.constraint ?? "") : null;
}

/**
 * Quita tildes/diéresis/ñ (vía descomposición NFD) y deja solo A-Z en
 * mayúsculas. "Aguardiente" -> "AGUARDIENTE", "Jugos Ñ" -> "JUGOSN".
 */
function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Genera la abreviación de 3 letras del tipo de producto (segmento central
 * del código de producto, ej. "AGU" en "PDT-AGU-001" — ajuste acordado con
 * el cliente, ver migración 004). Prueba ventanas deslizantes de 3 letras
 * sobre el nombre normalizado hasta encontrar una libre, para no depender
 * de que el Administrador la escriba ni arriesgar colisiones silenciosas.
 * Es inmutable: una vez creada, modificarTipoProducto no la vuelve a tocar.
 */
async function generarAbreviacion(nombre: string, client: PoolClient): Promise<string> {
  const normalizado = normalizarTexto(nombre);
  if (normalizado.length < 3) {
    throw ApiError.badRequest(
      "El nombre debe tener al menos 3 letras (sin tildes) para generar la abreviación del tipo de producto.",
      "NOMBRE_TIPO_PRODUCTO_MUY_CORTO"
    );
  }
  for (let inicio = 0; inicio <= normalizado.length - 3; inicio++) {
    const candidato = normalizado.slice(inicio, inicio + 3);
    const { rows } = await client.query(`SELECT 1 FROM tipo_producto WHERE abreviacion = $1`, [candidato]);
    if (rows.length === 0) return candidato;
  }
  throw ApiError.conflict(
    "No fue posible generar una abreviación única de 3 letras a partir de ese nombre; prueba con otro nombre.",
    "ABREVIACION_NO_DISPONIBLE"
  );
}

/** HU-013 CA-01 — Creación de tipos de producto. */
export async function crearTipoProducto(admin: JwtPayload, nombre: string): Promise<TipoProducto> {
  return withTransaction(async (client) => {
    const abreviacion = await generarAbreviacion(nombre, client);

    let tipo: TipoProductoRow;
    try {
      const { rows } = await client.query<TipoProductoRow>(
        `INSERT INTO tipo_producto (nombre, abreviacion) VALUES ($1, $2) RETURNING ${COLUMNAS}`,
        [nombre, abreviacion]
      );
      tipo = rows[0];
    } catch (err) {
      const constraint = obtenerConstraintViolado(err);
      if (constraint === "uq_tipo_producto_abreviacion") {
        // Carrera entre dos creaciones concurrentes que generaron la misma
        // abreviación antes de que ninguna insertara: extremadamente
        // improbable (ya se validó dentro de esta misma transacción), pero
        // se informa en vez de dejarlo como un 500.
        throw ApiError.conflict(
          "Ya se generó esa abreviación para otro tipo de producto justo ahora; intenta guardar de nuevo.",
          "ABREVIACION_EN_CONFLICTO"
        );
      }
      if (constraint !== null) {
        throw ApiError.conflict("Ya existe un tipo de producto con ese nombre.");
      }
      throw err;
    }

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "TIPO_PRODUCTO_CREADO",
        entidadAfectada: "TIPO_PRODUCTO",
        idAfectado: tipo.id_tipo_producto,
        detalle: { abreviacion },
      },
      client
    );

    return mapRow(tipo);
  });
}

/** HU-013 CA-02 — Modificación (implícita en "crear o modificar" de la CA). La abreviación no se recalcula. */
export async function modificarTipoProducto(
  admin: JwtPayload,
  idTipoProducto: number,
  nombre: string
): Promise<TipoProducto> {
  let tipo: TipoProductoRow | undefined;
  try {
    const { rows } = await pool.query<TipoProductoRow>(
      `UPDATE tipo_producto SET nombre = $1 WHERE id_tipo_producto = $2 RETURNING ${COLUMNAS}`,
      [nombre, idTipoProducto]
    );
    tipo = rows[0];
  } catch (err) {
    if (obtenerConstraintViolado(err) !== null) {
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
    `SELECT ${COLUMNAS} FROM tipo_producto ORDER BY nombre`
  );
  return rows.map(mapRow);
}

export interface TipoProductoConProductos extends TipoProducto {
  productos: Array<{ idProducto: number; codigo: string; nombre: string; estado: string }>;
}

/** HU-013 CA-03 — ver los productos ya asociados a un tipo. */
export async function obtenerTipoProductoConProductos(idTipoProducto: number): Promise<TipoProductoConProductos> {
  const { rows: tipoRows } = await pool.query<TipoProductoRow>(
    `SELECT ${COLUMNAS} FROM tipo_producto WHERE id_tipo_producto = $1`,
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
