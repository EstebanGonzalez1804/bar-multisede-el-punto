export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";
export type Estado = "ACTIVO" | "INACTIVO";

export const ETIQUETAS_PERFIL: Record<Perfil, string> = {
  ADMINISTRADOR: "Administrador",
  CAJERO: "Cajero",
  MESERO: "Mesero",
};

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
  // 3 letras derivadas automáticamente del nombre (ej. "Aguardiente" -> "AGU");
  // de aquí sale el segmento central del código de producto (PDT-AGU-001).
  abreviacion: string;
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

export interface Proveedor {
  idProveedor: number;
  nombre: string;
  informacionContacto: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface LineaRecepcion {
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
}

export interface Recepcion {
  idRecepcion: number;
  idProveedor: number;
  nombreProveedor: string;
  idSede: number;
  nombreSede: string;
  idUsuario: number;
  nombreUsuario: string;
  fechaRecepcion: string;
  creadoEn: string;
  lineas: LineaRecepcion[];
}

export interface ItemInventario {
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  nombreTipoProducto: string;
  estadoProducto: Estado;
  idSede: number;
  nombreSede: string;
  cantidadDisponible: number;
}

export type MotivoAjuste = "PERDIDA" | "DANO" | "ROTURA" | "DIFERENCIA_FISICA" | "ERROR_REGISTRO" | "OTRO";

export const MOTIVOS_AJUSTE: { value: MotivoAjuste; label: string }[] = [
  { value: "PERDIDA", label: "Pérdida" },
  { value: "DANO", label: "Daño" },
  { value: "ROTURA", label: "Rotura" },
  { value: "DIFERENCIA_FISICA", label: "Diferencia física" },
  { value: "ERROR_REGISTRO", label: "Error de registro" },
  { value: "OTRO", label: "Otro" },
];

export type EstadoPedido = "ABIERTO" | "CERRADO";
export type EstadoPago = "PENDIENTE" | "PARCIAL" | "PAGADO";

export interface LineaPedido {
  idDetallePedido: number;
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
  // Viajan como string, igual que Producto.valorVenta/valorCompra.
  precioVentaCongelado: string;
  precioCompraCongelado: string;
  creadoEn: string;
}

export interface Pedido {
  idPedido: number;
  identificadorPedido: string;
  idMesa: number;
  identificadorMesa: string;
  idSede: number;
  nombreSede: string;
  idUsuarioMesero: number;
  nombreMesero: string;
  estadoPedido: EstadoPedido;
  estadoPago: EstadoPago;
  fechaApertura: string;
  fechaCierre: string | null;
  lineas: LineaPedido[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detalles?: { campo: string; mensaje: string }[];
  };
}
