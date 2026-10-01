export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";

export interface JwtPayload {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  perfil: Perfil;
  idSede: number | null;
}
