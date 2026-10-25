import type { PoolClient } from "pg";
import { ApiError } from "./ApiError";

/**
 * Ajuste acordado con el cliente: sedes, proveedores y tipos de producto
 * también se inactivan (nada se elimina). Estas validaciones se reutilizan
 * desde cada operación que "usa" una de esas entidades, para que una entidad
 * inactiva no reciba operaciones nuevas pero conserve su histórico.
 */

export async function exigirSedeActiva(idSede: number, client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ estado: string }>(`SELECT estado FROM sede WHERE id_sede = $1`, [idSede]);
  if (!rows[0]) {
    throw ApiError.notFound("La sede indicada no existe.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict("La sede está inactiva: no se pueden registrar operaciones nuevas en ella.", "SEDE_INACTIVA");
  }
}

export async function exigirProveedorActivo(idProveedor: number, client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT estado FROM proveedor WHERE id_proveedor = $1`,
    [idProveedor]
  );
  if (!rows[0]) {
    throw ApiError.notFound("El proveedor indicado no existe.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict("El proveedor está inactivo y no se puede usar en recepciones nuevas.", "PROVEEDOR_INACTIVO");
  }
}

export async function exigirTipoProductoActivo(idTipoProducto: number, client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT estado FROM tipo_producto WHERE id_tipo_producto = $1`,
    [idTipoProducto]
  );
  if (!rows[0]) {
    throw ApiError.notFound("El tipo de producto indicado no existe.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict(
      "El tipo de producto está inactivo y no se puede usar para productos nuevos.",
      "TIPO_PRODUCTO_INACTIVO"
    );
  }
}
