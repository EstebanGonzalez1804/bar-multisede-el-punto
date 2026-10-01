import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

type Queryable = Pool | PoolClient;

export interface Proveedor {
  idProveedor: number;
  nombre: string;
  informacionContacto: string;
  creadoEn: string;
  actualizadoEn: string;
}

interface ProveedorRow {
  id_proveedor: number;
  nombre: string;
  informacion_contacto: string;
  creado_en: string;
  actualizado_en: string;
}

function mapRow(row: ProveedorRow): Proveedor {
  return {
    idProveedor: row.id_proveedor,
    nombre: row.nombre,
    informacionContacto: row.informacion_contacto,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

async function obtenerProveedor(idProveedor: number, ejecutor: Queryable): Promise<Proveedor> {
  const { rows } = await ejecutor.query<ProveedorRow>(`SELECT * FROM proveedor WHERE id_proveedor = $1`, [
    idProveedor,
  ]);
  if (!rows[0]) {
    throw ApiError.notFound("Proveedor no encontrado.");
  }
  return mapRow(rows[0]);
}

interface DatosProveedor {
  nombre: string;
  informacionContacto: string;
}

/** HU-018 CA-01/CA-02 — Creación de proveedor (solo Administrador). */
export async function crearProveedor(admin: JwtPayload, datos: DatosProveedor): Promise<Proveedor> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_proveedor: number }>(
      `INSERT INTO proveedor (nombre, informacion_contacto) VALUES ($1, $2) RETURNING id_proveedor`,
      [datos.nombre, datos.informacionContacto]
    );
    const idProveedor = rows[0].id_proveedor;

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "PROVEEDOR_CREADO",
        entidadAfectada: "PROVEEDOR",
        idAfectado: idProveedor,
      },
      client
    );

    return obtenerProveedor(idProveedor, client);
  });
}

/** HU-018 CA-02 — Modificación de proveedor (solo Administrador). */
export async function modificarProveedor(
  admin: JwtPayload,
  idProveedor: number,
  datos: DatosProveedor
): Promise<Proveedor> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_proveedor: number }>(
      `SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1 FOR UPDATE`,
      [idProveedor]
    );
    if (!rows[0]) {
      throw ApiError.notFound("Proveedor no encontrado.");
    }

    await client.query(
      `UPDATE proveedor SET nombre = $1, informacion_contacto = $2, actualizado_en = now() WHERE id_proveedor = $3`,
      [datos.nombre, datos.informacionContacto, idProveedor]
    );

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "PROVEEDOR_MODIFICADO",
        entidadAfectada: "PROVEEDOR",
        idAfectado: idProveedor,
      },
      client
    );

    return obtenerProveedor(idProveedor, client);
  });
}

/**
 * Listado de proveedores. CA-03 de HU-018 no restringe la consulta, pero en
 * la práctica solo lo usan Administrador (mantenimiento) y Cajero (al
 * registrar una recepción, HU-021) — Mesero no tiene ningún flujo que lo
 * necesite, ver mesas.routes.ts/proveedores.routes.ts.
 */
export async function listarProveedores(): Promise<Proveedor[]> {
  const { rows } = await pool.query<ProveedorRow>(`SELECT * FROM proveedor ORDER BY nombre`);
  return rows.map(mapRow);
}
