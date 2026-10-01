import { apiClient } from "./client";
import type { Mesa } from "./types";

export async function listarMesas(idSede?: number): Promise<Mesa[]> {
  const { data } = await apiClient.get<{ mesas: Mesa[] }>("/mesas", {
    params: idSede ? { idSede } : undefined,
  });
  return data.mesas;
}

export interface DatosMesa {
  idSede: number;
  identificador: string;
}

export async function crearMesa(datos: DatosMesa): Promise<Mesa> {
  const { data } = await apiClient.post<{ mesa: Mesa }>("/mesas", datos);
  return data.mesa;
}

export async function modificarMesa(idMesa: number, datos: DatosMesa): Promise<Mesa> {
  const { data } = await apiClient.put<{ mesa: Mesa }>(`/mesas/${idMesa}`, datos);
  return data.mesa;
}

export async function inactivarMesa(idMesa: number): Promise<Mesa> {
  const { data } = await apiClient.post<{ mesa: Mesa }>(`/mesas/${idMesa}/inactivar`);
  return data.mesa;
}

export async function activarMesa(idMesa: number): Promise<Mesa> {
  const { data } = await apiClient.post<{ mesa: Mesa }>(`/mesas/${idMesa}/activar`);
  return data.mesa;
}
