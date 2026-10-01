import { apiClient } from "./client";
import type { Proveedor } from "./types";

export async function listarProveedores(): Promise<Proveedor[]> {
  const { data } = await apiClient.get<{ proveedores: Proveedor[] }>("/proveedores");
  return data.proveedores;
}

export interface DatosProveedor {
  nombre: string;
  informacionContacto: string;
}

export async function crearProveedor(datos: DatosProveedor): Promise<Proveedor> {
  const { data } = await apiClient.post<{ proveedor: Proveedor }>("/proveedores", datos);
  return data.proveedor;
}

export async function modificarProveedor(idProveedor: number, datos: DatosProveedor): Promise<Proveedor> {
  const { data } = await apiClient.put<{ proveedor: Proveedor }>(`/proveedores/${idProveedor}`, datos);
  return data.proveedor;
}
