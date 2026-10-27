/**
 * Formatos únicos para toda la aplicación (dinero, fechas y estados), para que
 * un mismo dato se vea igual en todas las pantallas. Todas las fechas se
 * muestran en hora de Colombia, sin importar la zona del equipo.
 */
const TZ = "America/Bogota";

/** Pesos colombianos sin decimales: "$85.000". Solo muestra centavos si existen. */
export function pesos(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  return `$${numero.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Fecha de hoy en Colombia como "YYYY-MM-DD" (valor de los <input type="date">). */
export function hoyBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Primer día del mes actual en Colombia, "YYYY-MM-01". */
export function inicioDeMesBogota(): string {
  return `${hoyBogota().slice(0, 8)}01`;
}

function claveDia(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** "27/10/2026". Acepta una fecha sola ("2026-10-27") o un instante ISO completo. */
export function fecha(valor: string): string {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(valor);
  if (soloFecha) {
    const [anio, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${anio}`;
  }
  return new Date(valor).toLocaleDateString("es-CO", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "8:15 p. m." */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "Hoy · 8:15 p. m.", "Ayer · 8:15 p. m." o "25/10/2026 · 8:15 p. m." — para listados. */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  const clave = claveDia(d);
  const dia = clave === claveDia(hoy) ? "Hoy" : clave === claveDia(ayer) ? "Ayer" : fecha(iso);
  return `${dia} · ${hora(iso)}`;
}

/** "27/10/2026 · 8:15 p. m." siempre completo — para documentos (cuenta, historial). */
export function fechaHoraCompleta(iso: string): string {
  return `${fecha(iso)} · ${hora(iso)}`;
}

export function etiquetaEstadoPago(estado: "PENDIENTE" | "PARCIAL" | "PAGADO"): string {
  return estado === "PAGADO" ? "Pagado" : estado === "PARCIAL" ? "Pago parcial" : "Pendiente";
}

export function etiquetaEstadoPedido(estado: "ABIERTO" | "CERRADO"): string {
  return estado === "ABIERTO" ? "Abierto" : "Cerrado";
}

export function etiquetaEstado(estado: "ACTIVO" | "INACTIVO"): string {
  return estado === "ACTIVO" ? "Activo" : "Inactivo";
}

export function etiquetaEstadoMesa(estado: "LIBRE" | "OCUPADA" | "INACTIVA"): string {
  return estado === "LIBRE" ? "Libre" : estado === "OCUPADA" ? "Ocupada" : "Inactiva";
}
