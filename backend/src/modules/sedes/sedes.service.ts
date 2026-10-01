import { pool, withTransaction } from "../../config/db";
import { siguienteConsecutivo } from "../../utils/secuencia";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface Sede {
  idSede: number;
  codigoSede: string;
  nombre: string;
  direccion: string;
  creadoEn: string;
}

function mapRow(row: {
  id_sede: number;
  codigo_sede: string;
  nombre: string;
  direccion: string;
  creado_en: string;
}): Sede {
  return {
    idSede: row.id_sede,
    codigoSede: row.codigo_sede,
    nombre: row.nombre,
    direccion: row.direccion,
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
       RETURNING id_sede, codigo_sede, nombre, direccion, creado_en`,
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
 * Listado de sedes. No hay inactivación de sedes (HU-010 CA-04), así que
 * no existe filtro de estado: todas las sedes están siempre disponibles.
 */
export async function listarSedes(): Promise<Sede[]> {
  const { rows } = await pool.query(
    `SELECT id_sede, codigo_sede, nombre, direccion, creado_en FROM sede ORDER BY nombre`
  );
  return rows.map(mapRow);
}
