import { apiClient } from "./client";
import type { Pedido } from "./types";

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
