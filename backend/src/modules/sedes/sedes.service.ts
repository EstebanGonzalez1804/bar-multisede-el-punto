import { pool } from "../../config/db";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface Sede {
  idSede: number;
  nombre: string;
  direccion: string;
  creadoEn: string;
}

function mapRow(row: {
  id_sede: number;
  nombre: string;
  direccion: string;
  creado_en: string;
}): Sede {
  return {
    idSede: row.id_sede,
    nombre: row.nombre,
    direccion: row.direccion,
    creadoEn: row.creado_en,
  };
}

/** HU-010 — Creación y parametrización de sedes. */
export async function crearSede(admin: JwtPayload, nombre: string, direccion: string): Promise<Sede> {
  const { rows } = await pool.query(
    `INSERT INTO sede (nombre, direccion) VALUES ($1, $2)
     RETURNING id_sede, nombre, direccion, creado_en`,
    [nombre, direccion]
  );
  const sede = mapRow(rows[0]);

  await registrarEvento({
    idUsuario: admin.idUsuario,
    tipoEvento: "SEDE_CREADA",
    entidadAfectada: "SEDE",
    idAfectado: sede.idSede,
    idSede: sede.idSede,
  });

  return sede;
}

/**
 * Listado de sedes. No hay inactivación de sedes (HU-010 CA-04), así que
 * no existe filtro de estado: todas las sedes están siempre disponibles.
 */
export async function listarSedes(): Promise<Sede[]> {
  const { rows } = await pool.query(
    `SELECT id_sede, nombre, direccion, creado_en FROM sede ORDER BY nombre`
  );
  return rows.map(mapRow);
}
