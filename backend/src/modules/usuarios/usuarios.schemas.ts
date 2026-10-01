import { z } from "zod";

export const perfilSchema = z.enum(["ADMINISTRADOR", "CAJERO", "MESERO"]);

export const estadoUsuarioSchema = z.enum(["ACTIVO", "INACTIVO"]);

/** HU-007 — Creación de usuarios. */
export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  // null obligatorio y explícito para ADMINISTRADOR (CA-02); para
  // CAJERO/MESERO debe venir el id de una sede (CA-04).
  idSede: z.number().int().positive().nullable(),
  perfil: perfilSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

/** HU-008 CA-01 — Modificación de nombre/sede/perfil (estilo "reemplazo"). */
export const modificarUsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(120),
  idSede: z.number().int().positive().nullable(),
  perfil: perfilSchema,
});

/** HU-008 CA-02/CA-03 — Activación / inactivación. */
export const cambiarEstadoUsuarioSchema = z.object({
  estado: estadoUsuarioSchema,
});

/** HU-009 — Consulta y búsqueda. */
export const listarUsuariosQuerySchema = z.object({
  busqueda: z.string().trim().min(1).optional(),
  idSede: z.coerce.number().int().positive().optional(),
  perfil: perfilSchema.optional(),
  estado: estadoUsuarioSchema.optional(),
});
