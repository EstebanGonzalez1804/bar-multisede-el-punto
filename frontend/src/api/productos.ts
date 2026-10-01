import { apiClient } from "./client";
import type { Estado, HistorialPrecio, Producto } from "./types";

export interface FiltrosProductos {
  busqueda?: string;
  idTipoProducto?: number;
  estado?: Estado;
}

export async function listarProductos(filtros: FiltrosProductos = {}): Promise<Producto[]> {
  const { data } = await apiClient.get<{ productos: Producto[] }>("/productos", { params: filtros });
  return data.productos;
}

export async function obtenerHistorialPrecios(idProducto: number): Promise<HistorialPrecio[]> {
  const { data } = await apiClient.get<{ historial: HistorialPrecio[] }>(
    `/productos/${idProducto}/historial-precios`
  );
  return data.historial;
}

// El código ya no lo escribe el Administrador: el backend lo genera a
// partir de la abreviación del tipo de producto (ej. "PDT-AGU-001").
export interface DatosCrearProducto {
  nombre: string;
  idTipoProducto: number;
  valorCompra: number;
  valorVenta: number;
}

export async function crearProducto(datos: DatosCrearProducto): Promise<Producto> {
  const { data } = await apiClient.post<{ producto: Producto }>("/productos", datos);
  return data.producto;
}

export interface DatosModificarProducto {
  nombre: string;
  idTipoProducto: number;
  valorCompra: number;
  valorVenta: number;
}

export async function modificarProducto(idProducto: number, datos: DatosModificarProducto): Promise<Producto> {
  const { data } = await apiClient.put<{ producto: Producto }>(`/productos/${idProducto}`, datos);
  return data.producto;
}

export async function cambiarEstadoProducto(idProducto: number, estado: Estado): Promise<Producto> {
  const { data } = await apiClient.put<{ producto: Producto }>(`/productos/${idProducto}/estado`, {
    estado,
  });
  return data.producto;
}
