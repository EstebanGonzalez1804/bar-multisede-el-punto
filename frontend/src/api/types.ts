export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";

export interface UsuarioAutenticado {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  perfil: Perfil;
  idSede: number | null;
}

export interface Sede {
  idSede: number;
  nombre: string;
  direccion: string;
  creadoEn: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detalles?: { campo: string; mensaje: string }[];
  };
}
