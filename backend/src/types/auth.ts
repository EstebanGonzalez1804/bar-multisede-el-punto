export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";

export interface JwtPayload {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  perfil: Perfil;
  idSede: number | null;
  /** Identificador de la sesión vigente del usuario (sesión única). Solo viaja en el token. */
  sid?: string;
}
