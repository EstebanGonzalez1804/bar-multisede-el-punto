export type Perfil = "ADMINISTRADOR" | "CAJERO" | "MESERO";
export type Estado = "ACTIVO" | "INACTIVO";

export const ETIQUETAS_PERFIL: Record<Perfil, string> = {
  ADMINISTRADOR: "Administrator",
  CAJERO: "Cashier",
  MESERO: "Waiter",
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
  estado: Estado;
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
  // 3 letters derived automatically from the name (e.g. "Aguardiente" -> "AGU");
  // it is the middle segment of the product code (PDT-AGU-001).
  abreviacion: string;
  estado: Estado;
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
  // Sent as strings (see the backend note: Postgres NUMERIC is not converted
  // to number to avoid losing money precision).
  // valorCompra is only sent to the Administrator (HU-017 CA-01: other roles
  // see code, name, type and status, without costs).
  valorCompra?: string;
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
  estado: Estado;
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
  { value: "PERDIDA", label: "Loss" },
  { value: "DANO", label: "Damage" },
  { value: "ROTURA", label: "Breakage" },
  { value: "DIFERENCIA_FISICA", label: "Physical count difference" },
  { value: "ERROR_REGISTRO", label: "Data entry error" },
  { value: "OTRO", label: "Other" },
];

export type EstadoPedido = "ABIERTO" | "CERRADO";
export type EstadoPago = "PENDIENTE" | "PARCIAL" | "PAGADO";

export interface LineaPedido {
  idDetallePedido: number;
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  cantidad: number;
  // Sent as strings, same as Producto.valorVenta/valorCompra.
  precioVentaCongelado: string;
  precioCompraCongelado: string;
  creadoEn: string;
  /** Units already covered by per-product payments (HU-036). */
  cantidadPagada: number;
  cantidadPendiente: number;
  pagada: boolean;
}

export type MetodoPago = "EFECTIVO" | "TARJETA_CREDITO" | "TARJETA_DEBITO";
export type ModalidadPago = "TOTAL" | "ABONO" | "PRODUCTOS";

export const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Cash",
  TARJETA_CREDITO: "Credit card",
  TARJETA_DEBITO: "Debit card",
};

export interface PagoRegistrado {
  idPago: number;
  metodo: MetodoPago;
  valor: number;
  modalidad: ModalidadPago;
  nombreUsuario: string;
  fechaHora: string;
}

export interface ResumenPedido {
  idPedido: number;
  identificadorPedido: string;
  idMesa: number;
  identificadorMesa: string;
  idSede: number;
  nombreSede: string;
  estadoPedido: EstadoPedido;
  estadoPago: EstadoPago;
  fechaApertura: string;
  total: number;
  saldoPendiente: number;
}

export interface LineaPagoEntrada {
  metodo: MetodoPago;
  valor: number;
}

export interface RegistrarPagoEntrada {
  modalidad: ModalidadPago;
  lineas: LineaPagoEntrada[];
  productos?: Array<{ idProducto: number; cantidad: number }>;
}

export interface FilaReporteVentas {
  fecha: string;
  codigoProducto: string;
  nombreProducto: string;
  cantidadVendida: number;
  valorCompra: number;
  valorVenta: number;
  ganancia: number;
  idSede: number;
  nombreSede: string;
}

export interface ReporteVentas {
  desde: string;
  hasta: string;
  filas: FilaReporteVentas[];
  totales: { unidadesVendidas: number; costosCompra: number; ventas: number; gananciaTotal: number };
}

export interface EventoTrazabilidad {
  idEvento: number;
  idUsuario: number | null;
  codigoUsuario: string | null;
  nombreUsuario: string | null;
  tipoEvento: string;
  entidadAfectada: string;
  idAfectado: string | null;
  nombreAfectado: string | null;
  idSede: number | null;
  nombreSede: string | null;
  fechaHora: string;
  detalle: Record<string, unknown> | null;
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
  total: number;
  totalPagado: number;
  saldoPendiente: number;
  pagos: PagoRegistrado[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detalles?: { campo: string; mensaje: string }[];
  };
}
