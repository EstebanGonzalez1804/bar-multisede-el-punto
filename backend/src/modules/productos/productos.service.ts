import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { siguienteConsecutivo } from "../../utils/secuencia";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

type Queryable = Pool | PoolClient;

/**
 * valorCompra/valorVenta viajan como string: las columnas NUMERIC de
 * Postgres vuelven como string desde `pg` (comportamiento por defecto, sin
 * parser de tipos personalizado en config/db.ts) para no perder precisión
 * de dinero al pasar por punto flotante de JS. El frontend las trata como
 * texto para mostrar y las convierte a número solo al editar.
 */
export interface Producto {
  idProducto: number;
  codigo: string;
  nombre: string;
  idTipoProducto: number;
  nombreTipoProducto: string;
  valorCompra: string;
  valorVenta: string;
  estado: "ACTIVO" | "INACTIVO";
  creadoEn: string;
}

interface ProductoRow {
  id_producto: number;
  codigo: string;
  nombre: string;
  id_tipo_producto: number;
  nombre_tipo_producto: string;
  valor_compra: string;
  valor_venta: string;
  estado: "ACTIVO" | "INACTIVO";
  creado_en: string;
}

function mapRow(row: ProductoRow): Producto {
  return {
    idProducto: row.id_producto,
    codigo: row.codigo,
    nombre: row.nombre,
    idTipoProducto: row.id_tipo_producto,
    nombreTipoProducto: row.nombre_tipo_producto,
    valorCompra: row.valor_compra,
    valorVenta: row.valor_venta,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

function esViolacionUnicidad(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === "23505";
}

async function obtenerProductoConTipo(idProducto: number, ejecutor: Queryable): Promise<Producto> {
  const { rows } = await ejecutor.query<ProductoRow>(
    `SELECT p.id_producto, p.codigo, p.nombre, p.id_tipo_producto, t.nombre AS nombre_tipo_producto,
            p.valor_compra, p.valor_venta, p.estado, p.creado_en
     FROM producto p
     JOIN tipo_producto t ON t.id_tipo_producto = p.id_tipo_producto
     WHERE p.id_producto = $1`,
    [idProducto]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Producto no encontrado.");
  }
  return mapRow(rows[0]);
}

interface DatosCrearProducto {
  nombre: string;
  idTipoProducto: number;
  valorCompra: number;
  valorVenta: number;
}

/**
 * Genera el código del producto bajo la estructura fija
 * `PDT-[abreviación del tipo]-[consecutivo]` (ej. "PDT-AGU-001") — ajuste
 * acordado con el cliente sobre HU-014 (ver migración 004): el código deja
 * de ser un campo que escribe el Administrador y pasa a generarse igual que
 * el de usuarios (HU-007), para garantizar unicidad sin depender de que no
 * se repita a mano. El consecutivo es atómico y está acotado por
 * abreviación de tipo (ver utils/secuencia.ts).
 */
async function generarCodigoProducto(abreviacionTipo: string, client: PoolClient): Promise<string> {
  const clave = `PDT-${abreviacionTipo}`;
  const n = await siguienteConsecutivo(clave, client);
  return `${clave}-${String(n).padStart(3, "0")}`;
}

/** HU-014 — Creación de productos (catálogo único y global, CA-04). */
export async function crearProducto(admin: JwtPayload, datos: DatosCrearProducto): Promise<Producto> {
  return withTransaction(async (client) => {
    const { rows: tipoRows } = await client.query<{ abreviacion: string }>(
      `SELECT abreviacion FROM tipo_producto WHERE id_tipo_producto = $1`,
      [datos.idTipoProducto]
    );
    if (!tipoRows[0]) {
      throw ApiError.notFound("El tipo de producto indicado no existe.");
    }

    const codigo = await generarCodigoProducto(tipoRows[0].abreviacion, client);

    let idProducto: number;
    try {
      const { rows } = await client.query<{ id_producto: number }>(
        `INSERT INTO producto (codigo, nombre, id_tipo_producto, valor_compra, valor_venta)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_producto`,
        [codigo, datos.nombre, datos.idTipoProducto, datos.valorCompra, datos.valorVenta]
      );
      idProducto = rows[0].id_producto;
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        // Solo podría pasar si un producto anterior (de antes de este
        // ajuste) ya tenía escrito a mano justo este mismo código.
        throw ApiError.conflict("Se generó un código que ya existe; intenta guardar de nuevo.");
      }
      throw err;
    }

    // CA-06 HU-014: el valor inicial queda como primer registro del historial.
    await client.query(
      `INSERT INTO producto_precio_historial (id_producto, valor_compra, valor_venta, id_usuario_registro)
       VALUES ($1, $2, $3, $4)`,
      [idProducto, datos.valorCompra, datos.valorVenta, admin.idUsuario]
    );

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "PRODUCTO_CREADO",
        entidadAfectada: "PRODUCTO",
        idAfectado: idProducto,
        detalle: { codigo },
      },
      client
    );

    return obtenerProductoConTipo(idProducto, client);
  });
}

interface DatosModificarProducto {
  nombre: string;
  idTipoProducto: number;
  valorCompra: number;
  valorVenta: number;
}

/** HU-015 — Modificación de producto; si cambia el precio, conserva historial (CA-01). */
export async function modificarProducto(
  admin: JwtPayload,
  idProducto: number,
  datos: DatosModificarProducto
): Promise<Producto> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_producto: number; valor_compra: string; valor_venta: string }>(
      `SELECT id_producto, valor_compra, valor_venta FROM producto WHERE id_producto = $1 FOR UPDATE`,
      [idProducto]
    );
    const actual = rows[0];
    if (!actual) {
      throw ApiError.notFound("Producto no encontrado.");
    }

    const { rows: tipoRows } = await client.query(
      `SELECT id_tipo_producto FROM tipo_producto WHERE id_tipo_producto = $1`,
      [datos.idTipoProducto]
    );
    if (!tipoRows[0]) {
      throw ApiError.notFound("El tipo de producto indicado no existe.");
    }

    const cambioPrecio =
      Number(actual.valor_compra) !== datos.valorCompra || Number(actual.valor_venta) !== datos.valorVenta;

    await client.query(
      `UPDATE producto SET nombre = $1, id_tipo_producto = $2, valor_compra = $3, valor_venta = $4,
              actualizado_en = now()
       WHERE id_producto = $5`,
      [datos.nombre, datos.idTipoProducto, datos.valorCompra, datos.valorVenta, idProducto]
    );

    if (cambioPrecio) {
      await client.query(
        `INSERT INTO producto_precio_historial (id_producto, valor_compra, valor_venta, id_usuario_registro)
         VALUES ($1, $2, $3, $4)`,
        [idProducto, datos.valorCompra, datos.valorVenta, admin.idUsuario]
      );
    }

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: cambioPrecio ? "PRODUCTO_PRECIO_MODIFICADO" : "PRODUCTO_MODIFICADO",
        entidadAfectada: "PRODUCTO",
        idAfectado: idProducto,
        detalle: cambioPrecio ? { valorCompra: datos.valorCompra, valorVenta: datos.valorVenta } : null,
      },
      client
    );

    return obtenerProductoConTipo(idProducto, client);
  });
}

/** HU-016 — Inactivación / reactivación de productos. */
export async function cambiarEstadoProducto(
  admin: JwtPayload,
  idProducto: number,
  estado: "ACTIVO" | "INACTIVO"
): Promise<Producto> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_producto: number; estado: string }>(
      `SELECT id_producto, estado FROM producto WHERE id_producto = $1 FOR UPDATE`,
      [idProducto]
    );
    const producto = rows[0];
    if (!producto) {
      throw ApiError.notFound("Producto no encontrado.");
    }
    if (producto.estado === estado) {
      throw ApiError.conflict(`El producto ya está en estado ${estado}.`);
    }

    await client.query(`UPDATE producto SET estado = $1, actualizado_en = now() WHERE id_producto = $2`, [
      estado,
      idProducto,
    ]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: estado === "ACTIVO" ? "PRODUCTO_ACTIVADO" : "PRODUCTO_INACTIVADO",
        entidadAfectada: "PRODUCTO",
        idAfectado: idProducto,
      },
      client
    );

    return obtenerProductoConTipo(idProducto, client);
  });
}

interface FiltrosProductos {
  busqueda?: string;
  idTipoProducto?: number;
  estado?: "ACTIVO" | "INACTIVO";
}

/** HU-017 — Catálogo de productos: global, mismo contenido para todos los perfiles (CA-03). */
export async function listarProductos(filtros: FiltrosProductos): Promise<Producto[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda) {
    valores.push(`%${filtros.busqueda}%`);
    condiciones.push(`(p.codigo ILIKE $${valores.length} OR p.nombre ILIKE $${valores.length})`);
  }
  if (filtros.idTipoProducto !== undefined) {
    valores.push(filtros.idTipoProducto);
    condiciones.push(`p.id_tipo_producto = $${valores.length}`);
  }
  if (filtros.estado) {
    valores.push(filtros.estado);
    condiciones.push(`p.estado = $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<ProductoRow>(
    `SELECT p.id_producto, p.codigo, p.nombre, p.id_tipo_producto, t.nombre AS nombre_tipo_producto,
            p.valor_compra, p.valor_venta, p.estado, p.creado_en
     FROM producto p
     JOIN tipo_producto t ON t.id_tipo_producto = p.id_tipo_producto
     ${where}
     ORDER BY p.nombre`,
    valores
  );
  return rows.map(mapRow);
}

export interface HistorialPrecio {
  idHistorial: number;
  valorCompra: string;
  valorVenta: string;
  vigenteDesde: string;
  idUsuarioRegistro: number | null;
}

interface HistorialPrecioRow {
  id_historial: number;
  valor_compra: string;
  valor_venta: string;
  vigente_desde: string;
  id_usuario_registro: number | null;
}

/** HU-015 — Historial de precios de un producto, más reciente primero. */
export async function listarHistorialPrecios(idProducto: number): Promise<HistorialPrecio[]> {
  const { rows: productoRows } = await pool.query(`SELECT id_producto FROM producto WHERE id_producto = $1`, [
    idProducto,
  ]);
  if (!productoRows[0]) {
    throw ApiError.notFound("Producto no encontrado.");
  }

  const { rows } = await pool.query<HistorialPrecioRow>(
    `SELECT id_historial, valor_compra, valor_venta, vigente_desde, id_usuario_registro
     FROM producto_precio_historial
     WHERE id_producto = $1
     ORDER BY vigente_desde DESC`,
    [idProducto]
  );
  return rows.map((r) => ({
    idHistorial: r.id_historial,
    valorCompra: r.valor_compra,
    valorVenta: r.valor_venta,
    vigenteDesde: r.vigente_desde,
    idUsuarioRegistro: r.id_usuario_registro,
  }));
}
