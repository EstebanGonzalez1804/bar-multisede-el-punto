import jwt from "jsonwebtoken";
import { pool, withTransaction } from "../../config/db";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { hashPassword, verifyPassword } from "../../utils/password";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload, Perfil } from "../../types/auth";

interface UsuarioRow {
  id_usuario: number;
  codigo_usuario: string;
  nombre: string;
  id_sede: number | null;
  perfil: Perfil;
  estado: "ACTIVO" | "INACTIVO";
  password_hash: string;
  intentos_fallidos: number;
  bloqueado: boolean;
}

function toJwtPayload(u: UsuarioRow): JwtPayload {
  return {
    idUsuario: u.id_usuario,
    codigoUsuario: u.codigo_usuario,
    nombre: u.nombre,
    perfil: u.perfil,
    idSede: u.id_sede,
  };
}

function emitirToken(payload: JwtPayload): string {
  // El cast de `expiresIn` es necesario porque @types/jsonwebtoken tipa esa
  // opción como un literal de plantilla (p. ej. "8h"), más estricto que
  // `string`; el valor sigue viniendo de env.ts y validándose en runtime.
  const options: jwt.SignOptions = { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

/**
 * HU-001 — Inicio de sesión con credenciales.
 * HU-003 — Bloqueo automático tras `LOGIN_MAX_INTENTOS_FALLIDOS` fallos.
 */
export async function login(codigoUsuario: string, password: string) {
  const { rows } = await pool.query<UsuarioRow>(
    `SELECT id_usuario, codigo_usuario, nombre, id_sede, perfil, estado,
            password_hash, intentos_fallidos, bloqueado
     FROM usuario WHERE codigo_usuario = $1`,
    [codigoUsuario]
  );
  const usuario = rows[0];

  // CA-04: mensaje genérico, sin indicar si el usuario existe o si fue la
  // contraseña la incorrecta.
  const credencialesInvalidas = () =>
    ApiError.unauthorized("Usuario o contraseña incorrectos.", "CREDENCIALES_INVALIDAS");

  if (!usuario) {
    throw credencialesInvalidas();
  }

  // CA-05: usuario inactivo.
  if (usuario.estado === "INACTIVO") {
    await registrarEvento({
      idUsuario: usuario.id_usuario,
      tipoEvento: "LOGIN_RECHAZADO_INACTIVO",
      entidadAfectada: "USUARIO",
      idAfectado: usuario.id_usuario,
      idSede: usuario.id_sede,
    });
    throw ApiError.forbidden(
      "Tu usuario está inactivo. Contacta a un Administrador.",
      "USUARIO_INACTIVO"
    );
  }

  // CA-06: usuario bloqueado por intentos fallidos.
  if (usuario.bloqueado) {
    await registrarEvento({
      idUsuario: usuario.id_usuario,
      tipoEvento: "LOGIN_RECHAZADO_BLOQUEADO",
      entidadAfectada: "USUARIO",
      idAfectado: usuario.id_usuario,
      idSede: usuario.id_sede,
    });
    throw ApiError.forbidden(
      "Tu usuario está bloqueado por intentos fallidos. Contacta a un Administrador.",
      "USUARIO_BLOQUEADO"
    );
  }

  const passwordCorrecta = await verifyPassword(password, usuario.password_hash);

  if (!passwordCorrecta) {
    const nuevosIntentos = usuario.intentos_fallidos + 1;
    const seBloquea = nuevosIntentos >= env.loginMaxIntentosFallidos;

    await pool.query(
      `UPDATE usuario SET intentos_fallidos = $1, bloqueado = $2, actualizado_en = now()
       WHERE id_usuario = $3`,
      [seBloquea ? 0 : nuevosIntentos, seBloquea, usuario.id_usuario]
    );

    await registrarEvento({
      idUsuario: usuario.id_usuario,
      tipoEvento: seBloquea ? "USUARIO_BLOQUEADO_POR_INTENTOS" : "LOGIN_FALLIDO",
      entidadAfectada: "USUARIO",
      idAfectado: usuario.id_usuario,
      idSede: usuario.id_sede,
      detalle: { intentosFallidos: nuevosIntentos },
    });

    // CA-06 (HU-001) / CA-03 (HU-003): si justo en este intento se bloqueó,
    // se informa igual que a un usuario ya bloqueado.
    if (seBloquea) {
      throw ApiError.forbidden(
        "Tu usuario quedó bloqueado por intentos fallidos. Contacta a un Administrador.",
        "USUARIO_BLOQUEADO"
      );
    }
    throw credencialesInvalidas();
  }

  // Login exitoso: reinicia el contador de intentos fallidos (CA-02 de HU-003).
  await pool.query(
    `UPDATE usuario SET intentos_fallidos = 0, actualizado_en = now() WHERE id_usuario = $1`,
    [usuario.id_usuario]
  );

  await registrarEvento({
    idUsuario: usuario.id_usuario,
    tipoEvento: "LOGIN_EXITOSO",
    entidadAfectada: "USUARIO",
    idAfectado: usuario.id_usuario,
    idSede: usuario.id_sede,
  });

  const payload = toJwtPayload(usuario);
  return { token: emitirToken(payload), usuario: payload };
}

/** HU-006 — Cierre de sesión (manual o automático por inactividad). */
export async function logout(usuario: JwtPayload, motivo: "MANUAL" | "INACTIVIDAD") {
  await registrarEvento({
    idUsuario: usuario.idUsuario,
    tipoEvento: motivo === "MANUAL" ? "LOGOUT_MANUAL" : "LOGOUT_POR_INACTIVIDAD",
    entidadAfectada: "USUARIO",
    idAfectado: usuario.idUsuario,
    idSede: usuario.idSede,
  });
}

/** HU-002 — Cambio de contraseña propia. */
export async function cambiarPasswordPropia(
  usuario: JwtPayload,
  passwordActual: string,
  passwordNueva: string
) {
  await withTransaction(async (client) => {
    const { rows } = await client.query<Pick<UsuarioRow, "password_hash">>(
      `SELECT password_hash FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [usuario.idUsuario]
    );
    const actual = rows[0];
    if (!actual) {
      throw ApiError.notFound("Usuario no encontrado.");
    }

    const coincide = await verifyPassword(passwordActual, actual.password_hash);
    if (!coincide) {
      throw ApiError.badRequest(
        "La contraseña actual no es correcta.",
        "PASSWORD_ACTUAL_INCORRECTA"
      );
    }

    const nuevoHash = await hashPassword(passwordNueva);
    await client.query(
      `UPDATE usuario SET password_hash = $1, actualizado_en = now() WHERE id_usuario = $2`,
      [nuevoHash, usuario.idUsuario]
    );

    // CA-04: el evento queda registrado SIN registrar el valor de la contraseña.
    await registrarEvento(
      {
        idUsuario: usuario.idUsuario,
        tipoEvento: "CAMBIO_PASSWORD_PROPIA",
        entidadAfectada: "USUARIO",
        idAfectado: usuario.idUsuario,
        idSede: usuario.idSede,
      },
      client
    );
  });
}

/** HU-005 — Cambio de contraseña de terceros por el Administrador. */
export async function cambiarPasswordDeTercero(
  admin: JwtPayload,
  idUsuarioObjetivo: number,
  passwordNueva: string
) {
  await withTransaction(async (client) => {
    const { rows } = await client.query<Pick<UsuarioRow, "id_usuario" | "id_sede">>(
      `SELECT id_usuario, id_sede FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [idUsuarioObjetivo]
    );
    if (!rows[0]) {
      throw ApiError.notFound("El usuario indicado no existe.");
    }

    const nuevoHash = await hashPassword(passwordNueva);
    await client.query(
      `UPDATE usuario SET password_hash = $1, actualizado_en = now() WHERE id_usuario = $2`,
      [nuevoHash, idUsuarioObjetivo]
    );

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "CAMBIO_PASSWORD_POR_ADMIN",
        entidadAfectada: "USUARIO",
        idAfectado: idUsuarioObjetivo,
        idSede: rows[0].id_sede,
        detalle: { ejecutadoPor: admin.idUsuario },
      },
      client
    );
  });
}

/** HU-004 — Desbloqueo de usuario por el Administrador. */
export async function desbloquearUsuario(admin: JwtPayload, idUsuarioObjetivo: number) {
  await withTransaction(async (client) => {
    const { rows } = await client.query<Pick<UsuarioRow, "id_usuario" | "id_sede" | "bloqueado">>(
      `SELECT id_usuario, id_sede, bloqueado FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [idUsuarioObjetivo]
    );
    const objetivo = rows[0];
    if (!objetivo) {
      throw ApiError.notFound("El usuario indicado no existe.");
    }
    if (!objetivo.bloqueado) {
      throw ApiError.conflict("Ese usuario no está bloqueado.");
    }

    await client.query(
      `UPDATE usuario SET bloqueado = FALSE, intentos_fallidos = 0, actualizado_en = now()
       WHERE id_usuario = $1`,
      [idUsuarioObjetivo]
    );

    await registrarEvento(
      {
        idUsuario: admin.idUsuario,
        tipoEvento: "USUARIO_DESBLOQUEADO",
        entidadAfectada: "USUARIO",
        idAfectado: idUsuarioObjetivo,
        idSede: objetivo.id_sede,
        detalle: { ejecutadoPor: admin.idUsuario },
      },
      client
    );
  });
}
