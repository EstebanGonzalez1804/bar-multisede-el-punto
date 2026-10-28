/**
 * Single formats for the whole application (money, dates and statuses), so the
 * same value looks the same on every screen. All dates are shown in Colombian
 * time, regardless of the device's time zone.
 */
const TZ = "America/Bogota";

/** Colombian pesos without decimals: "$85,000". Only shows cents when present. */
export function pesos(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  return `$${numero.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Today's date in Colombia as "YYYY-MM-DD" (value of <input type="date">). */
export function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** First day of the current month in Colombia, "YYYY-MM-01". */
export function inicioDeMesBogota(): string {
  return `${hoyBogota().slice(0, 8)}01`;
}

function claveDia(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** "27/10/2026" (day/month/year). Accepts a plain date ("2026-10-27") or a full ISO instant. */
export function fecha(valor: string): string {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(valor);
  if (soloFecha) {
    const [anio, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${anio}`;
  }
  return new Date(valor).toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "8:15 PM" */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "Today · 8:15 PM", "Yesterday · 8:15 PM" or "25/10/2026 · 8:15 PM" — for lists. */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  const clave = claveDia(d);
  const dia = clave === claveDia(hoy) ? "Today" : clave === claveDia(ayer) ? "Yesterday" : fecha(iso);
  return `${dia} · ${hora(iso)}`;
}

/** "27/10/2026 · 8:15 PM" always complete — for documents (bill, history). */
export function fechaHoraCompleta(iso: string): string {
  return `${fecha(iso)} · ${hora(iso)}`;
}

export function etiquetaEstadoPago(estado: "PENDIENTE" | "PARCIAL" | "PAGADO"): string {
  return estado === "PAGADO" ? "Paid" : estado === "PARCIAL" ? "Partially paid" : "Pending";
}

export function etiquetaEstadoPedido(estado: "ABIERTO" | "CERRADO"): string {
  return estado === "ABIERTO" ? "Open" : "Closed";
}

export function etiquetaEstado(estado: "ACTIVO" | "INACTIVO"): string {
  return estado === "ACTIVO" ? "Active" : "Inactive";
}

export function etiquetaEstadoMesa(estado: "LIBRE" | "OCUPADA" | "INACTIVA"): string {
  return estado === "LIBRE" ? "Free" : estado === "OCUPADA" ? "Occupied" : "Inactive";
}
