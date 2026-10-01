import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

type Queryable = Pool | PoolClient;

export interface Mesa {
  idMesa: number;
  idSede: number;
  nombreSede: string;
  identificador: string;
  estado: "LIBRE" | "OCUPADA" | "INACTIVA";
  creadoEn: string;
}

interface MesaRow {
  id_mesa: number;
  id_sede: number;
  nombre_sede: string;
  identificador: string;
  estado: "LIBRE" | "OCUPADA" | "INACTIVA";
  creado_en: string;
}

function mapRow(row: MesaRow): Mesa {
  return {
    idMesa: row.id_mesa,
    idSede: row.id_sede,
    nombreSede: row.nombre_sede,
    identificador: row.identificador,
    estado: row.estado,
    creadoEn: row.creado_en,
  };
}

function esViolacionUnicidad(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === "23505";
}

async function obtenerMesaConSede(idMesa: number, ejecutor: Queryable): Promise<Mesa> {
  const { rows } = await ejecutor.query<MesaRow>(
    `SELECT m.id_mesa, m.id_sede, s.nombre AS nombre_sede, m.identificador, m.estado, m.creado_en
     FROM mesa m
     JOIN sede s ON s.id_sede = m.id_sede
     WHERE m.id_mesa = $1`,
    [idMesa]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Mesa no encontrada.");
  }
  return mapRow(rows[0]);
}

interface DatosMesa {
  idSede: number;
  identificador: string;
}

/** HU-011 CA-01 — Creación de mesas (estado inicial: LIBRE). */
export async function crearMesa(admin: JwtPayload, datos: DatosMesa): Promise<Mesa> {
  return withTransaction(async (client) => {
    const { rows: sedeRows } = await client.query(`SELECT id_sede FROM sede WHERE id_sede = $1`, [
      datos.idSede,
    ]);
    if (!sedeRows[0]) {
      throw ApiError.notFound("La sede indicada no existe.");
    }

    let idMesa: number;
    try {
      const { rows } = await client.query<{ id_mesa: number }>(
        `INSERT INTO mesa (id_sede, identificador) VALUES ($1, $2) RETURNING id_mesa`,
        [datos.idSede, datos.identificador]
      );
      idMesa = rows[0].id_mesa;
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        throw ApiError.conflict("Ya existe una mesa con ese identificador en la sede indicada.");
      }
      throw err;
    }

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "MESA_CREADA",
        entidadAfectada: "MESA",
        idAfectado: idMesa,
        idSede: datos.idSede,
      },
      client
    );

    return obtenerMesaConSede(idMesa, client);
  });
}

/**
 * HU-011 CA-02 — Modificación de mesa. Nunca toca `estado`: una edición de
 * identificador/sede no debe afectar pedidos en curso, tal como exige la CA.
 */
export async function modificarMesa(admin: JwtPayload, idMesa: number, datos: DatosMesa): Promise<Mesa> {
  return withTransaction(async (client) => {
    const { rows: existentes } = await client.query<{ id_mesa: number }>(
      `SELECT id_mesa FROM mesa WHERE id_mesa = $1 FOR UPDATE`,
      [idMesa]
    );
    if (!existentes[0]) {
      throw ApiError.notFound("Mesa no encontrada.");
    }

    const { rows: sedeRows } = await client.query(`SELECT id_sede FROM sede WHERE id_sede = $1`, [
      datos.idSede,
    ]);
    if (!sedeRows[0]) {
      throw ApiError.notFound("La sede indicada no existe.");
    }

    try {
      await client.query(
        `UPDATE mesa SET id_sede = $1, identificador = $2, actualizado_en = now() WHERE id_mesa = $3`,
        [datos.idSede, datos.identificador, idMesa]
      );
    } catch (err) {
      if (esViolacionUnicidad(err)) {
        throw ApiError.conflict("Ya existe una mesa con ese identificador en la sede indicada.");
      }
      throw err;
    }

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "MESA_MODIFICADA",
        entidadAfectada: "MESA",
        idAfectado: idMesa,
        idSede: datos.idSede,
      },
      client
    );

    return obtenerMesaConSede(idMesa, client);
  });
}

/**
 * HU-012 — Inactivación de mesas. Solo procede si la mesa está LIBRE
 * (CA-01); si está OCUPADA (pedido abierto, desde Sprint 3) o ya INACTIVA,
 * se rechaza explicando el motivo (CA-02).
 */
export async function inactivarMesa(admin: JwtPayload, idMesa: number): Promise<Mesa> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_mesa: number; id_sede: number; estado: string }>(
      `SELECT id_mesa, id_sede, estado FROM mesa WHERE id_mesa = $1 FOR UPDATE`,
      [idMesa]
    );
    const mesa = rows[0];
    if (!mesa) {
      throw ApiError.notFound("Mesa no encontrada.");
    }
    if (mesa.estado !== "LIBRE") {
      throw ApiError.conflict(
        mesa.estado === "OCUPADA"
          ? "No se puede inactivar: la mesa tiene un pedido abierto."
          : "La mesa ya está inactiva.",
        "MESA_NO_INACTIVABLE"
      );
    }

    await client.query(`UPDATE mesa SET estado = 'INACTIVA', actualizado_en = now() WHERE id_mesa = $1`, [
      idMesa,
    ]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "MESA_INACTIVADA",
        entidadAfectada: "MESA",
        idAfectado: idMesa,
        idSede: mesa.id_sede,
      },
      client
    );

    return obtenerMesaConSede(idMesa, client);
  });
}

/**
 * Reactivación de una mesa inactivada por error — ajuste acordado con el
 * cliente sobre HU-012 (ver migración 004): el documento aprobado solo
 * define el camino de "inactivar" (CA-01/CA-02), sin ningún CA de vuelta,
 * a diferencia de HU-008 (usuarios, CA-03) y HU-016 (productos, CA-04), que
 * sí la contemplan. Mismo control de acceso que inactivar (CA-03 HU-012):
 * solo Administrador. Una mesa reactivada vuelve siempre a LIBRE (nunca
 * pudo quedar INACTIVA estando OCUPADA, ver inactivarMesa).
 */
export async function activarMesa(admin: JwtPayload, idMesa: number): Promise<Mesa> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_mesa: number; id_sede: number; estado: string }>(
      `SELECT id_mesa, id_sede, estado FROM mesa WHERE id_mesa = $1 FOR UPDATE`,
      [idMesa]
    );
    const mesa = rows[0];
    if (!mesa) {
      throw ApiError.notFound("Mesa no encontrada.");
    }
    if (mesa.estado !== "INACTIVA") {
      throw ApiError.conflict("Solo se puede activar una mesa que esté inactiva.", "MESA_NO_ACTIVABLE");
    }

    await client.query(`UPDATE mesa SET estado = 'LIBRE', actualizado_en = now() WHERE id_mesa = $1`, [
      idMesa,
    ]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "MESA_ACTIVADA",
        entidadAfectada: "MESA",
        idAfectado: idMesa,
        idSede: mesa.id_sede,
      },
      client
    );

    return obtenerMesaConSede(idMesa, client);
  });
}

/**
 * HU-011 — Listado de mesas. `idSedeEfectiva` ya viene resuelto por
 * `resolveSedeScope` en el controller: null = sin restricción (Administrador
 * sin filtro), número = acotado a esa sede (Cajero/Mesero, siempre; o
 * Administrador si filtró explícitamente).
 */
export async function listarMesas(idSedeEfectiva: number | null): Promise<Mesa[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (idSedeEfectiva !== null) {
    valores.push(idSedeEfectiva);
    condiciones.push(`m.id_sede = $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<MesaRow>(
    `SELECT m.id_mesa, m.id_sede, s.nombre AS nombre_sede, m.identificador, m.estado, m.creado_en
     FROM mesa m
     JOIN sede s ON s.id_sede = m.id_sede
     ${where}
     ORDER BY s.nombre, m.identificador`,
    valores
  );
  return rows.map(mapRow);
}
