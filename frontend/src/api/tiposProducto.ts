import { apiClient } from "./client";
import type { TipoProducto, TipoProductoConProductos } from "./types";

export async function listarTiposProducto(): Promise<TipoProducto[]> {
  const { data } = await apiClient.get<{ tiposProducto: TipoProducto[] }>("/tipos-producto");
  return data.tiposProducto;
}

export async function obtenerTipoProducto(idTipoProducto: number): Promise<TipoProductoConProductos> {
  const { data } = await apiClient.get<{ tipoProducto: TipoProductoConProductos }>(
    `/tipos-producto/${idTipoProducto}`
  );
  return data.tipoProducto;
}

export async function crearTipoProducto(nombre: string): Promise<TipoProducto> {
  const { data } = await apiClient.post<{ tipoProducto: TipoProducto }>("/tipos-producto", { nombre });
  return data.tipoProducto;
}

export async function modificarTipoProducto(idTipoProducto: number, nombre: string): Promise<TipoProducto> {
  const { data } = await apiClient.put<{ tipoProducto: TipoProducto }>(`/tipos-producto/${idTipoProducto}`, {
    nombre,
  });
  return data.tipoProducto;
}
