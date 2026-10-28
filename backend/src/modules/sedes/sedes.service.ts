import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { siguienteConsecutivo } from "../../utils/secuencia";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface Sede {
  idSede: number;
  codigoSede: string;
  nombre: string;
  direccion: string;
  estado: "ACTIVO" | "INACTIVO";
  creadoEn: string;
}

function mapRow(row: {
  id_sede: number;
  codigo_sede: string;
  nombre: string;
  direccion: string;
  estado: "ACTIVO" | "INACTIVO";
  creado_en: string;
}): Sede {
  return {
    idSede: row.id_sede,
    codigoSede: row.codigo_sede,
    nombre: row.nombre,
    direccion: row.direccion,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

/**
 * HU-010 — Creación y parametrización de sedes.
 *
 * Desde Sprint 2, cada sede recibe un `codigo_sede` autogenerado y
 * consecutivo ("SE01", "SE02", ...) — es el token `[SEDE]` que HU-007 usa
 * para construir el código de los usuarios Cajero/Mesero de esa sede.
 */
export async function crearSede(admin: JwtPayload, nombre: string, direccion: string): Promise<Sede> {
  return withTransaction(async (client) => {
    const n = await siguienteConsecutivo("SEDE", client);
    const codigoSede = `SE${String(n).padStart(2, "0")}`;

    const { rows } = await client.query(
      `INSERT INTO sede (codigo_sede, nombre, direccion) VALUES ($1, $2, $3)
       RETURNING id_sede, codigo_sede, nombre, direccion, estado, creado_en`,
      [codigoSede, nombre, direccion]
    );
    const sede = mapRow(rows[0]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "SEDE_CREADA",
        entidadAfectada: "SEDE",
        idAfectado: sede.idSede,
        idSede: sede.idSede,
        detalle: { codigoSede: sede.codigoSede },
      },
      client
    );

    return sede;
  });
}

/**
 * HU-010 ("crear y parametrizar", CA-03 y CA-06) — modificar nombre y
 * dirección. El código (SE01, SE02...) no cambia: forma parte de los códigos
 * de usuarios y pedidos ya emitidos. Queda en la trazabilidad con los
 * valores anterior y nuevo.
 */
export async function modificarSede(
  admin: JwtPayload,
  idSede: number,
  nombre: string,
  direccion: string
): Promise<Sede> {
  return withTransaction(async (client) => {
    const { rows: actuales } = await client.query<{ nombre: string; direccion: string }>(
      `SELECT nombre, direccion FROM sede WHERE id_sede = $1 FOR UPDATE`,
      [idSede]
    );
    const anterior = actuales[0];
    if (!anterior) throw ApiError.notFound("Location not found.");

    const { rows } = await client.query(
      `UPDATE sede SET nombre = $1, direccion = $2 WHERE id_sede = $3
       RETURNING id_sede, codigo_sede, nombre, direccion, estado, creado_en`,
      [nombre, direccion, idSede]
    );
    const sede = mapRow(rows[0]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "SEDE_MODIFICADA",
        entidadAfectada: "SEDE",
        idAfectado: idSede,
        idSede,
        detalle: {
          nombreAnterior: anterior.nombre,
          direccionAnterior: anterior.direccion,
          nombre,
          direccion,
        },
      },
      client
    );

    return sede;
  });
}

/**
 * Listado de sedes. Incluye el estado: las pantallas de gestión muestran
 * todas (activas e inactivas) y los selectores de operaciones nuevas filtran
 * solo las ACTIVO.
 */
export async function listarSedes(): Promise<Sede[]> {
  const { rows } = await pool.query(
    `SELECT id_sede, codigo_sede, nombre, direccion, estado, creado_en FROM sede ORDER BY nombre`
  );
  return rows.map(mapRow);
}

async function obtenerSede(idSede: number, ejecutor: Pool | PoolClient): Promise<Sede> {
  const { rows } = await ejecutor.query(
    `SELECT id_sede, codigo_sede, nombre, direccion, estado, creado_en FROM sede WHERE id_sede = $1`,
    [idSede]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Location not found.");
  }
  return mapRow(rows[0]);
}

/**
 * Inactivación de sedes (ajuste acordado con el cliente; reemplaza el CA-04
 * original de HU-010). No se elimina nada: la sede y su historial se conservan.
 * Para no dejar operaciones a medias, no se puede inactivar una sede que tenga
 * mesas ocupadas o pedidos sin pagar por completo.
 */
export async function inactivarSede(admin: JwtPayload, idSede: number): Promise<Sede> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ estado: string }>(
      `SELECT estado FROM sede WHERE id_sede = $1 FOR UPDATE`,
      [idSede]
    );
    if (!rows[0]) {
      throw ApiError.notFound("Location not found.");
    }
    if (rows[0].estado === "INACTIVO") {
      throw ApiError.conflict("The location is already inactive.", "SEDE_YA_INACTIVA");
    }

    const { rows: pendientes } = await client.query(
      `SELECT 1 FROM pedido WHERE id_sede = $1 AND estado_pago <> 'PAGADO'
       UNION ALL
       SELECT 1 FROM mesa WHERE id_sede = $1 AND estado = 'OCUPADA'
       LIMIT 1`,
      [idSede]
    );
    if (pendientes.length > 0) {
      throw ApiError.conflict(
        "Cannot deactivate: the location has occupied tables or orders that are not fully paid.",
        "SEDE_NO_INACTIVABLE"
      );
    }

    await client.query(`UPDATE sede SET estado = 'INACTIVO' WHERE id_sede = $1`, [idSede]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "SEDE_INACTIVADA",
        entidadAfectada: "SEDE",
        idAfectado: idSede,
        idSede,
      },
      client
    );

    return obtenerSede(idSede, client);
  });
}

export async function activarSede(admin: JwtPayload, idSede: number): Promise<Sede> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ estado: string }>(
      `SELECT estado FROM sede WHERE id_sede = $1 FOR UPDATE`,
      [idSede]
    );
    if (!rows[0]) {
      throw ApiError.notFound("Location not found.");
    }
    if (rows[0].estado === "ACTIVO") {
      throw ApiError.conflict("The location is already active.", "SEDE_YA_ACTIVA");
    }

    await client.query(`UPDATE sede SET estado = 'ACTIVO' WHERE id_sede = $1`, [idSede]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "SEDE_ACTIVADA",
        entidadAfectada: "SEDE",
        idAfectado: idSede,
        idSede,
      },
      client
    );

    return obtenerSede(idSede, client);
  });
}
