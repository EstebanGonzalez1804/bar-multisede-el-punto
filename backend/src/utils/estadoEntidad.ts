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
    throw ApiError.notFound("The specified location does not exist.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict("The location is inactive: no new operations can be recorded there.", "SEDE_INACTIVA");
  }
}

export async function exigirProveedorActivo(idProveedor: number, client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT estado FROM proveedor WHERE id_proveedor = $1`,
    [idProveedor]
  );
  if (!rows[0]) {
    throw ApiError.notFound("The specified supplier does not exist.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict("The supplier is inactive and cannot be used in new receipts.", "PROVEEDOR_INACTIVO");
  }
}

export async function exigirTipoProductoActivo(idTipoProducto: number, client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT estado FROM tipo_producto WHERE id_tipo_producto = $1`,
    [idTipoProducto]
  );
  if (!rows[0]) {
    throw ApiError.notFound("The specified product type does not exist.");
  }
  if (rows[0].estado !== "ACTIVO") {
    throw ApiError.conflict(
      "The product type is inactive and cannot be used for new products.",
      "TIPO_PRODUCTO_INACTIVO"
    );
  }
}
