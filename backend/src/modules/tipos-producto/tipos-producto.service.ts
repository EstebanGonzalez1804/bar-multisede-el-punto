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
  estado: "ACTIVO" | "INACTIVO";
  creadoEn: string;
}

interface TipoProductoRow {
  id_tipo_producto: number;
  nombre: string;
  abreviacion: string;
  estado: "ACTIVO" | "INACTIVO";
  creado_en: string;
}

const COLUMNAS = "id_tipo_producto, nombre, abreviacion, estado, creado_en";

function mapRow(row: TipoProductoRow): TipoProducto {
  return {
    idTipoProducto: row.id_tipo_producto,
    nombre: row.nombre,
    abreviacion: row.abreviacion,
    estado: row.estado,
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
      "The name must have at least 3 letters (without accents) to generate the product type abbreviation.",
      "NOMBRE_TIPO_PRODUCTO_MUY_CORTO"
    );
  }
  for (let inicio = 0; inicio <= normalizado.length - 3; inicio++) {
    const candidato = normalizado.slice(inicio, inicio + 3);
    const { rows } = await client.query(`SELECT 1 FROM tipo_producto WHERE abreviacion = $1`, [candidato]);
    if (rows.length === 0) return candidato;
  }
  throw ApiError.conflict(
    "A unique 3-letter abbreviation could not be generated from that name; try another name.",
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
          "That abbreviation was just generated for another product type; try saving again.",
          "ABREVIACION_EN_CONFLICTO"
        );
      }
      if (constraint !== null) {
        throw ApiError.conflict("A product type with that name already exists.");
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
      throw ApiError.conflict("A product type with that name already exists.");
    }
    throw err;
  }
  if (!tipo) {
    throw ApiError.notFound("Product type not found.");
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
    throw ApiError.notFound("Product type not found.");
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

/**
 * Inactivación de tipos de producto (ajuste acordado con el cliente). Un tipo
 * inactivo no se puede usar para crear productos nuevos; sus productos
 * existentes siguen funcionando con normalidad.
 */
export async function cambiarEstadoTipoProducto(
  admin: JwtPayload,
  idTipoProducto: number,
  estado: "ACTIVO" | "INACTIVO"
): Promise<TipoProducto & { productosInactivados: number }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ estado: string }>(
      `SELECT estado FROM tipo_producto WHERE id_tipo_producto = $1 FOR UPDATE`,
      [idTipoProducto]
    );
    if (!rows[0]) {
      throw ApiError.notFound("Product type not found.");
    }
    if (rows[0].estado === estado) {
      throw ApiError.conflict(`The product type is already ${estado === "ACTIVO" ? "active" : "inactive"}.`);
    }

    const { rows: actualizados } = await client.query<TipoProductoRow>(
      `UPDATE tipo_producto SET estado = $1 WHERE id_tipo_producto = $2 RETURNING ${COLUMNAS}`,
      [estado, idTipoProducto]
    );

    // Al inactivar un tipo, todos sus productos activos se inactivan también
    // (cada uno queda registrado en trazabilidad). Al reactivar el tipo NO se
    // reactivan automáticamente: algunos pudieron estar inactivos por otra
    // razón y el Administrador decide cuáles vuelven a la venta.
    let productosInactivados = 0;
    if (estado === "INACTIVO") {
      const { rows: inactivados } = await client.query<{ id_producto: number; codigo: string }>(
        `UPDATE producto SET estado = 'INACTIVO', actualizado_en = now()
          WHERE id_tipo_producto = $1 AND estado = 'ACTIVO'
      RETURNING id_producto, codigo`,
        [idTipoProducto]
      );
      productosInactivados = inactivados.length;
      for (const prod of inactivados) {
        await registrarEvento(
          {
            idUsuario: admin.idUsuario,
            tipoEvento: "PRODUCTO_INACTIVADO",
            entidadAfectada: "PRODUCTO",
            idAfectado: prod.id_producto,
            detalle: { motivo: "TIPO_PRODUCTO_INACTIVADO", idTipoProducto, codigo: prod.codigo },
          },
          client
        );
      }
    }

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: estado === "ACTIVO" ? "TIPO_PRODUCTO_ACTIVADO" : "TIPO_PRODUCTO_INACTIVADO",
        entidadAfectada: "TIPO_PRODUCTO",
        idAfectado: idTipoProducto,
        detalle: estado === "INACTIVO" ? { productosInactivados } : undefined,
      },
      client
    );

    return { ...mapRow(actualizados[0]), productosInactivados };
  });
}
