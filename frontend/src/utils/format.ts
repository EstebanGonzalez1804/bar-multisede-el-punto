export function pesos(valor: number | string): string {
  return `$${Number(valor).toLocaleString("es-CO")}`;
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

/** Etiqueta del estado de pago: un pago parcial se muestra como pendiente con saldo (HU-030/HU-032). */
export function etiquetaEstadoPago(estado: "PENDIENTE" | "PARCIAL" | "PAGADO"): string {
  return estado === "PAGADO" ? "Pagado" : estado === "PARCIAL" ? "Pendiente (parcial)" : "Pendiente";
}
