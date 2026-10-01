export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";
export type Estado = "ACTIVO" | "INACTIVO";

export interface UsuarioAutenticado {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  perfil: Perfil;
  idSede: number | null;
}

export interface Sede {
  idSede: number;
  codigoSede: string;
  nombre: string;
  direccion: string;
  creadoEn: string;
}

export interface Usuario {
  idUsuario: number;
  codigoUsuario: string;
  nombre: string;
  idSede: number | null;
  nombreSede: string | null;
  perfil: Perfil;
  estado: Estado;
  bloqueado: boolean;
  creadoEn: string;
}

export type EstadoMesa = "LIBRE" | "OCUPADA" | "INACTIVA";

export interface Mesa {
  idMesa: number;
  idSede: number;
  nombreSede: string;
  identificador: string;
  estado: EstadoMesa;
  creadoEn: string;
}

export interface TipoProducto {
  idTipoProducto: number;
  nombre: string;
  creadoEn: string;
}

export interface TipoProductoConProductos extends TipoProducto {
  productos: Array<{ idProducto: number; codigo: string; nombre: string; estado: Estado }>;
}

export interface Producto {
  idProducto: number;
  codigo: string;
  nombre: string;
  idTipoProducto: number;
  nombreTipoProducto: string;
  // Viajan como string (ver nota en el backend: NUMERIC de Postgres no se
  // convierte a number para no perder precisión de dinero).
  valorCompra: string;
  valorVenta: string;
  estado: Estado;
  creadoEn: string;
}

export interface HistorialPrecio {
  idHistorial: number;
  valorCompra: string;
  valorVenta: string;
  vigenteDesde: string;
  idUsuarioRegistro: number | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detalles?: { campo: string; mensaje: string }[];
  };
}
