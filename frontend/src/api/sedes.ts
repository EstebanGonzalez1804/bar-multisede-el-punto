import { apiClient } from "./client";
import type { Sede } from "./types";

export async function listarSedes(): Promise<Sede[]> {
  const { data } = await apiClient.get<{ sedes: Sede[] }>("/sedes");
  return data.sedes;
}

export async function crearSede(nombre: string, direccion: string): Promise<Sede> {
  const { data } = await apiClient.post<{ sede: Sede }>("/sedes", { nombre, direccion });
  return data.sede;
}
