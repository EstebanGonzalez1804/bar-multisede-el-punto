import { apiClient } from "./client";
import type { Pedido, RegistrarPagoEntrada, ResumenPedido } from "./types";

export async function abrirPedido(idMesa: number): Promise<Pedido> {
  const { data } = await apiClient.post<{ pedido: Pedido }>("/pedidos", { idMesa });
  return data.pedido;
}

/** Devuelve el pedido ABIERTO de la mesa, o null si está libre (sin pedido en curso). */
export async function obtenerPedidoAbiertoPorMesa(idMesa: number): Promise<Pedido | null> {
  const { data } = await apiClient.get<{ pedido: Pedido | null }>(`/pedidos/por-mesa/${idMesa}`);
  return data.pedido;
}

export async function registrarProductoEnPedido(
  idPedido: number,
  idProducto: number,
  cantidad: number
): Promise<Pedido> {
  const { data } = await apiClient.post<{ pedido: Pedido }>(`/pedidos/${idPedido}/lineas`, {
    idProducto,
    cantidad,
  });
  return data.pedido;
}

export async function cerrarPedido(idPedido: number): Promise<Pedido> {
  const { data } = await apiClient.post<{ pedido: Pedido }>(`/pedidos/${idPedido}/cerrar`);
  return data.pedido;
}

export async function reabrirPedido(idPedido: number): Promise<Pedido> {
  const { data } = await apiClient.post<{ pedido: Pedido }>(`/pedidos/${idPedido}/reabrir`);
  return data.pedido;
}

export async function obtenerPedido(idPedido: number): Promise<Pedido> {
  const { data } = await apiClient.get<{ pedido: Pedido }>(`/pedidos/${idPedido}`);
  return data.pedido;
}

export interface FiltrosPedidos {
  idSede?: number;
  estadoPedido?: string;
  estadoPago?: string;
  busqueda?: string;
}

export async function listarPedidos(filtros: FiltrosPedidos = {}): Promise<ResumenPedido[]> {
  const { data } = await apiClient.get<{ pedidos: ResumenPedido[] }>("/pedidos", { params: filtros });
  return data.pedidos;
}

export async function listarPedidosPendientesPago(busqueda?: string, idSede?: number): Promise<ResumenPedido[]> {
  const { data } = await apiClient.get<{ pedidos: ResumenPedido[] }>("/pedidos/pendientes-pago", {
    params: { busqueda: busqueda || undefined, idSede },
  });
  return data.pedidos;
}

export async function registrarPago(
  idPedido: number,
  entrada: RegistrarPagoEntrada
): Promise<{ pedido: Pedido; vueltas: number }> {
  const { data } = await apiClient.post<{ pedido: Pedido; vueltas: number }>(`/pedidos/${idPedido}/pagos`, entrada);
  return data;
}

/** Descarga el PDF de la cuenta (tirilla de 80 mm) con el token de la sesión. */
export async function descargarCuentaPdf(idPedido: number, nombreArchivo: string): Promise<void> {
  const { data } = await apiClient.get<Blob>(`/pedidos/${idPedido}/cuenta.pdf`, { responseType: "blob" });
  guardarBlob(data, nombreArchivo);
}

export function guardarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
