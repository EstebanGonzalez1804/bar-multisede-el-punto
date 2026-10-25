import { apiClient } from "./client";
import { guardarBlob } from "./pedidos";
import type { ReporteVentas } from "./types";

export async function generarReporteVentas(desde: string, hasta: string, idSede?: number): Promise<ReporteVentas> {
  const { data } = await apiClient.get<{ reporte: ReporteVentas }>("/reportes/ventas", {
    params: { desde, hasta, idSede },
  });
  return data.reporte;
}

/** HU-039 CA-07 — exportación únicamente a Excel (.xlsx). */
export async function exportarReporteVentas(desde: string, hasta: string, idSede?: number): Promise<void> {
  const { data } = await apiClient.get<Blob>("/reportes/ventas/excel", {
    params: { desde, hasta, idSede },
    responseType: "blob",
  });
  guardarBlob(data, `ventas_${desde}_${hasta}.xlsx`);
}
