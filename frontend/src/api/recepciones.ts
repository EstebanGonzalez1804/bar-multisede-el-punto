import { apiClient } from "./client";
import type { Recepcion } from "./types";

export interface FiltrosRecepciones {
  idProveedor?: number;
  idSede?: number;
  desde?: string;
  hasta?: string;
}

export async function listarRecepciones(filtros: FiltrosRecepciones = {}): Promise<Recepcion[]> {
  const { data } = await apiClient.get<{ recepciones: Recepcion[] }>("/recepciones", { params: filtros });
  return data.recepciones;
}

export interface DatosLineaRecepcion {
  idProducto: number;
  cantidad: number;
}

export interface DatosRecepcion {
  idProveedor: number;
  idSede: number;
  fechaRecepcion: string;
  lineas: DatosLineaRecepcion[];
}

export async function crearRecepcion(datos: DatosRecepcion): Promise<Recepcion> {
  const { data } = await apiClient.post<{ recepcion: Recepcion }>("/recepciones", datos);
  return data.recepcion;
}
