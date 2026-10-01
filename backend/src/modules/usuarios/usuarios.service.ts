import type { Pool, PoolClient } from "pg";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { hashPassword } from "../../utils/password";
import { siguienteConsecutivo } from "../../utils/secuencia";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload, Perfil } from "../../types/auth";

type Queryable = Pool | PoolClient;

export interface Usuario {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  idSede: number | null;
  nombreSede: string | null;
  perfil: Perfil;
  estado: "ACTIVO" | "INACTIVO";
  bloqueado: boolean;
  creadoEn: string;
}

interface UsuarioRow {
  id_usuario: number;
  codigo_usuario: string;
  nombre: string;
  id_sede: number | null;
  nombre_sede: string | null;
  perfil: Perfil;
  estado: "ACTIVO" | "INACTIVO";
  bloqueado: boolean;
  creado_en: string;
}

function mapRow(row: UsuarioRow): Usuario {
  return {
    idUsuario: row.id_usuario,
    codigoUsuario: row.codigo_usuario,
    nombre: row.nombre,
    idSede: row.id_sede,
    nombreSede: row.nombre_sede,
    perfil: row.perfil,
    estado: row.estado,
    bloqueado: row.bloqueado,
    creadoEn: row.creado_en,
  };
}

async function obtenerUsuarioConSede(idUsuario: number, ejecutor: Queryable): Promise<Usuario> {
  const { rows } = await ejecutor.query<UsuarioRow>(
    `SELECT u.id_usuario, u.codigo_usuario, u.nombre, u.id_sede, s.nombre AS nombre_sede,
            u.perfil, u.estado, u.bloqueado, u.creado_en
     FROM usuario u
     LEFT JOIN sede s ON s.id_sede = u.id_sede
     WHERE u.id_usuario = $1`,
    [idUsuario]
  );
  if (!rows[0]) {
    throw ApiError.notFound("Usuario no encontrado.");
  }
  return mapRow(rows[0]);
}

/**
 * HU-007 CA-01/CA-04: valida la regla sede-según-perfil ANTES de llegar a la
 * base de datos, para devolver un 400 legible en vez de un 500 por violar
 * el CHECK `chk_usuario_sede_segun_perfil` (que sigue siendo la garantía
 * última, a nivel de esquema).
 */
function validarSedeSegunPerfil(idSede: number | null, perfil: Perfil): void {
  if (perfil === "ADMINISTRADOR" && idSede !== null) {
    throw ApiError.badRequest(
      "Un usuario Administrador no se asocia a una sede.",
      "SEDE_NO_APLICA_ADMINISTRADOR"
    );
  }
  if (perfil !== "ADMINISTRADOR" && idSede === null) {
    throw ApiError.badRequest(
      "Los perfiles Cajero y Mesero requieren una sede.",
      "SEDE_OBLIGATORIA"
    );
  }
}

function abreviarPerfil(perfil: "CAJERO" | "MESERO"): "CAJ" | "MES" {
  return perfil === "CAJERO" ? "CAJ" : "MES";
}

/**
 * HU-007 CA-01/CA-02/CA-06 — Genera el código bajo la estructura
 * `[SEDE]-[ROL]-[CONSECUTIVO]` (ej. "SE01-CAJ-001"), o
 * `GEN-ADM-[CONSECUTIVO]` para Administrador (prefijo corporativo global,
 * sin sede). El consecutivo es atómico (ver utils/secuencia.ts).
 */
async function generarCodigoUsuario(
  perfil: Perfil,
  codigoSede: string | null,
  client: PoolClient
): Promise<string> {
  if (perfil === "ADMINISTRADOR") {
    const n = await siguienteConsecutivo("GEN-ADM", client);
    return `GEN-ADM-${String(n).padStart(3, "0")}`;
  }
  // codigoSede siempre viene definido aquí: validarSedeSegunPerfil ya
  // garantizó que CAJERO/MESERO traen idSede, y el llamador resuelve su
  // codigo_sede antes de invocar esta función.
  const clave = `${codigoSede}-${abreviarPerfil(perfil)}`;
  const n = await siguienteConsecutivo(clave, client);
  return `${clave}-${String(n).padStart(3, "0")}`;
}

interface DatosUsuario {
  nombre: string;
  idSede: number | null;
  perfil: Perfil;
}

/** HU-007 — Creación de usuarios. */
export async function crearUsuario(
  admin: JwtPayload,
  datos: DatosUsuario & { password: string }
): Promise<Usuario> {
  validarSedeSegunPerfil(datos.idSede, datos.perfil);

  return withTransaction(async (client) => {
    let codigoSede: string | null = null;
    if (datos.idSede !== null) {
      const { rows } = await client.query<{ codigo_sede: string }>(
        `SELECT codigo_sede FROM sede WHERE id_sede = $1`,
        [datos.idSede]
      );
      if (!rows[0]) {
        throw ApiError.notFound("La sede indicada no existe.");
      }
      codigoSede = rows[0].codigo_sede;
    }

    const codigo = await generarCodigoUsuario(datos.perfil, codigoSede, client);
    const passwordHash = await hashPassword(datos.password);

    const { rows } = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuario (codigo_usuario, nombre, id_sede, perfil, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario`,
      [codigo, datos.nombre, datos.idSede, datos.perfil, passwordHash]
    );
    const idUsuario = rows[0].id_usuario;

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "USUARIO_CREADO",
        entidadAfectada: "USUARIO",
        idAfectado: idUsuario,
        idSede: datos.idSede,
        detalle: { codigoUsuario: codigo, perfil: datos.perfil },
      },
      client
    );

    return obtenerUsuarioConSede(idUsuario, client);
  });
}

/** HU-008 CA-01 — Modificación de nombre/sede/perfil. */
export async function modificarUsuario(
  admin: JwtPayload,
  idUsuario: number,
  datos: DatosUsuario
): Promise<Usuario> {
  validarSedeSegunPerfil(datos.idSede, datos.perfil);

  return withTransaction(async (client) => {
    const { rows: existentes } = await client.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [idUsuario]
    );
    if (!existentes[0]) {
      throw ApiError.notFound("Usuario no encontrado.");
    }

    if (datos.idSede !== null) {
      const { rows: sedeRows } = await client.query(`SELECT id_sede FROM sede WHERE id_sede = $1`, [
        datos.idSede,
      ]);
      if (!sedeRows[0]) {
        throw ApiError.notFound("La sede indicada no existe.");
      }
    }

    await client.query(
      `UPDATE usuario SET nombre = $1, id_sede = $2, perfil = $3, actualizado_en = now()
       WHERE id_usuario = $4`,
      [datos.nombre, datos.idSede, datos.perfil, idUsuario]
    );

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "USUARIO_MODIFICADO",
        entidadAfectada: "USUARIO",
        idAfectado: idUsuario,
        idSede: datos.idSede,
        detalle: { ejecutadoPor: admin.idUsuario },
      },
      client
    );

    return obtenerUsuarioConSede(idUsuario, client);
  });
}

/** HU-008 CA-02/CA-03 — Activación / inactivación. */
export async function cambiarEstadoUsuario(
  admin: JwtPayload,
  idUsuario: number,
  estado: "ACTIVO" | "INACTIVO"
): Promise<Usuario> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id_usuario: number; id_sede: number | null; estado: string }>(
      `SELECT id_usuario, id_sede, estado FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [idUsuario]
    );
    const usuario = rows[0];
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado.");
    }
    if (usuario.estado === estado) {
      throw ApiError.conflict(`El usuario ya está en estado ${estado}.`);
    }

    await client.query(`UPDATE usuario SET estado = $1, actualizado_en = now() WHERE id_usuario = $2`, [
      estado,
      idUsuario,
    ]);

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: estado === "ACTIVO" ? "USUARIO_ACTIVADO" : "USUARIO_INACTIVADO",
        entidadAfectada: "USUARIO",
        idAfectado: idUsuario,
        idSede: usuario.id_sede,
        detalle: { ejecutadoPor: admin.idUsuario },
      },
      client
    );

    return obtenerUsuarioConSede(idUsuario, client);
  });
}

interface FiltrosUsuarios {
  busqueda?: string;
  idSede?: number;
  perfil?: Perfil;
  estado?: "ACTIVO" | "INACTIVO";
}

/** HU-009 — Consulta y búsqueda (acceso global, solo Administrador). */
export async function listarUsuarios(filtros: FiltrosUsuarios): Promise<Usuario[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.busqueda) {
    valores.push(`%${filtros.busqueda}%`);
    condiciones.push(`(u.codigo_usuario ILIKE $${valores.length} OR u.nombre ILIKE $${valores.length})`);
  }
  if (filtros.idSede !== undefined) {
    valores.push(filtros.idSede);
    condiciones.push(`u.id_sede = $${valores.length}`);
  }
  if (filtros.perfil) {
    valores.push(filtros.perfil);
    condiciones.push(`u.perfil = $${valores.length}`);
  }
  if (filtros.estado) {
    valores.push(filtros.estado);
    condiciones.push(`u.estado = $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const { rows } = await pool.query<UsuarioRow>(
    `SELECT u.id_usuario, u.codigo_usuario, u.nombre, u.id_sede, s.nombre AS nombre_sede,
            u.perfil, u.estado, u.bloqueado, u.creado_en
     FROM usuario u
     LEFT JOIN sede s ON s.id_sede = u.id_sede
     ${where}
     ORDER BY u.codigo_usuario`,
    valores
  );
  return rows.map(mapRow);
}
