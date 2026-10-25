import { apiClient } from "./client";
import type { EventoTrazabilidad } from "./types";

export interface FiltrosTrazabilidad {
  idUsuario?: number;
  idSede?: number;
  tipoEvento?: string;
  desde?: string;
  hasta?: string;
}

export async function consultarTrazabilidad(
  filtros: FiltrosTrazabilidad
): Promise<{ eventos: EventoTrazabilidad[]; tiposEvento: string[] }> {
  const { data } = await apiClient.get<{ eventos: EventoTrazabilidad[]; tiposEvento: string[] }>("/trazabilidad", {
    params: filtros,
  });
  return data;
}
