import { apiClient } from "./client";
import type { ItemInventario, MotivoAjuste } from "./types";

export async function listarInventario(idSede?: number): Promise<ItemInventario[]> {
  const { data } = await apiClient.get<{ inventario: ItemInventario[] }>("/inventario", {
    params: idSede ? { idSede } : undefined,
  });
  return data.inventario;
}

export interface DatosAjuste {
  idProducto: number;
  idSede: number;
  cantidadAjuste: number;
  motivo: MotivoAjuste;
}

export async function registrarAjuste(datos: DatosAjuste): Promise<ItemInventario> {
  const { data } = await apiClient.post<{ item: ItemInventario }>("/inventario/ajustes", datos);
  return data.item;
}
