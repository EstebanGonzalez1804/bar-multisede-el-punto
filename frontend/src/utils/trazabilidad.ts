import type { EventoTrazabilidad } from "../api/types";
import { pesos } from "./format";

/** Categorías para agrupar/filtrar los eventos de forma entendible. */
export type CategoriaEvento = "Access" | "Users" | "Orders and payments" | "Catalog" | "Inventory" | "Locations and tables";

interface InfoEvento {
  etiqueta: string;
  categoria: CategoriaEvento;
  /** Tono visual: informativo, positivo, aviso o alerta. */
  tono: "info" | "ok" | "aviso" | "alerta";
}

const EVENTOS: Record<string, InfoEvento> = {
  LOGIN_EXITOSO: { etiqueta: "Signed in", categoria: "Access", tono: "info" },
  LOGOUT_MANUAL: { etiqueta: "Signed out", categoria: "Access", tono: "info" },
  LOGOUT_POR_INACTIVIDAD: { etiqueta: "Session closed due to inactivity", categoria: "Access", tono: "aviso" },
  LOGIN_FALLIDO: { etiqueta: "Failed sign-in attempt", categoria: "Access", tono: "alerta" },
  LOGIN_RECHAZADO_BLOQUEADO: { etiqueta: "Sign-in rejected (user locked)", categoria: "Access", tono: "alerta" },
  LOGIN_RECHAZADO_INACTIVO: { etiqueta: "Sign-in rejected (user inactive)", categoria: "Access", tono: "alerta" },
  USUARIO_BLOQUEADO_POR_INTENTOS: { etiqueta: "User locked after failed attempts", categoria: "Access", tono: "alerta" },
  CAMBIO_PASSWORD_PROPIA: { etiqueta: "Changed own password", categoria: "Users", tono: "info" },
  CAMBIO_PASSWORD_POR_ADMIN: { etiqueta: "Password reset by the administrator", categoria: "Users", tono: "aviso" },
  USUARIO_CREADO: { etiqueta: "User created", categoria: "Users", tono: "ok" },
  USUARIO_MODIFICADO: { etiqueta: "User modified", categoria: "Users", tono: "info" },
  USUARIO_ACTIVADO: { etiqueta: "User activated", categoria: "Users", tono: "ok" },
  USUARIO_INACTIVADO: { etiqueta: "User deactivated", categoria: "Users", tono: "aviso" },
  USUARIO_BLOQUEADO: { etiqueta: "User locked", categoria: "Users", tono: "alerta" },
  USUARIO_DESBLOQUEADO: { etiqueta: "User unlocked", categoria: "Users", tono: "ok" },
  PEDIDO_ABIERTO: { etiqueta: "Order opened", categoria: "Orders and payments", tono: "info" },
  PRODUCTO_REGISTRADO_EN_PEDIDO: { etiqueta: "Product added to an order", categoria: "Orders and payments", tono: "info" },
  PEDIDO_CERRADO: { etiqueta: "Order closed (bill generated)", categoria: "Orders and payments", tono: "info" },
  PAGO_REGISTRADO: { etiqueta: "Payment recorded", categoria: "Orders and payments", tono: "ok" },
  PEDIDO_PAGADO: { etiqueta: "Order fully paid", categoria: "Orders and payments", tono: "ok" },
  MESA_LIBERADA: { etiqueta: "Table freed", categoria: "Orders and payments", tono: "info" },
  PRODUCTO_CREADO: { etiqueta: "Product created", categoria: "Catalog", tono: "ok" },
  PRODUCTO_MODIFICADO: { etiqueta: "Product modified", categoria: "Catalog", tono: "info" },
  PRODUCTO_PRECIO_MODIFICADO: { etiqueta: "Product price modified", categoria: "Catalog", tono: "aviso" },
  PRODUCTO_ACTIVADO: { etiqueta: "Product activated", categoria: "Catalog", tono: "ok" },
  PRODUCTO_INACTIVADO: { etiqueta: "Product deactivated", categoria: "Catalog", tono: "aviso" },
  TIPO_PRODUCTO_CREADO: { etiqueta: "Product type created", categoria: "Catalog", tono: "ok" },
  TIPO_PRODUCTO_MODIFICADO: { etiqueta: "Product type modified", categoria: "Catalog", tono: "info" },
  TIPO_PRODUCTO_ACTIVADO: { etiqueta: "Product type activated", categoria: "Catalog", tono: "ok" },
  TIPO_PRODUCTO_INACTIVADO: { etiqueta: "Product type deactivated", categoria: "Catalog", tono: "aviso" },
  PROVEEDOR_CREADO: { etiqueta: "Supplier created", categoria: "Inventory", tono: "ok" },
  PROVEEDOR_MODIFICADO: { etiqueta: "Supplier modified", categoria: "Inventory", tono: "info" },
  PROVEEDOR_ACTIVADO: { etiqueta: "Supplier activated", categoria: "Inventory", tono: "ok" },
  PROVEEDOR_INACTIVADO: { etiqueta: "Supplier deactivated", categoria: "Inventory", tono: "aviso" },
  RECEPCION_REGISTRADA: { etiqueta: "Goods received", categoria: "Inventory", tono: "ok" },
  INVENTARIO_AJUSTADO: { etiqueta: "Inventory adjusted", categoria: "Inventory", tono: "aviso" },
  SEDE_CREADA: { etiqueta: "Location created", categoria: "Locations and tables", tono: "ok" },
  SEDE_MODIFICADA: { etiqueta: "Location modified", categoria: "Locations and tables", tono: "info" },
  SEDE_ACTIVADA: { etiqueta: "Location activated", categoria: "Locations and tables", tono: "ok" },
  SEDE_INACTIVADA: { etiqueta: "Location deactivated", categoria: "Locations and tables", tono: "aviso" },
  MESA_CREADA: { etiqueta: "Table created", categoria: "Locations and tables", tono: "ok" },
  MESA_MODIFICADA: { etiqueta: "Table modified", categoria: "Locations and tables", tono: "info" },
  MESA_ACTIVADA: { etiqueta: "Table activated", categoria: "Locations and tables", tono: "ok" },
  MESA_INACTIVADA: { etiqueta: "Table deactivated", categoria: "Locations and tables", tono: "aviso" },
};

/** "PEDIDO_ALGO_RARO" -> "Pedido algo raro" para eventos futuros sin traducción. */
function humanizar(tipo: string): string {
  const t = tipo.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function infoEvento(tipo: string): InfoEvento {
  return EVENTOS[tipo] ?? { etiqueta: humanizar(tipo), categoria: "Catalog", tono: "info" };
}

export function etiquetaEvento(tipo: string): string {
  return infoEvento(tipo).etiqueta;
}

/** Tipos de evento agrupados por categoría, para el selector de filtro. */
export function tiposPorCategoria(tipos: string[]): Array<{ categoria: string; tipos: Array<{ tipo: string; etiqueta: string }> }> {
  const grupos = new Map<string, Array<{ tipo: string; etiqueta: string }>>();
  for (const tipo of tipos) {
    const { categoria, etiqueta } = infoEvento(tipo);
    const lista = grupos.get(categoria) ?? [];
    lista.push({ tipo, etiqueta });
    grupos.set(categoria, lista);
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([categoria, lista]) => ({ categoria, tipos: lista.sort((x, y) => x.etiqueta.localeCompare(y.etiqueta, "en")) }));
}

const METODOS: Record<string, string> = {
  EFECTIVO: "cash",
  TARJETA_CREDITO: "credit card",
  TARJETA_DEBITO: "debit card",
};

const MODALIDADES: Record<string, string> = {
  TOTAL: "full payment",
  ABONO: "partial payment",
  PRODUCTOS: "payment by products",
};

const MOTIVOS: Record<string, string> = {
  PAGO_COMPLETO: "the order was paid in full",
  PERDIDA: "loss",
  DANO: "damage",
  ROTURA: "breakage",
  DIFERENCIA_FISICA: "physical count difference",
  ERROR_REGISTRO: "data entry error",
  OTRO: "other",
  TIPO_PRODUCTO_INACTIVADO: "its product type was deactivated",
};

function num(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(n) ? null : n;
}

function txt(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

/**
 * Frase corta y comprensible que resume qué pasó, pensada para el
 * Administrador. Usa nombres (producto, mesa, pedido) en vez de ids.
 */
export function describirEvento(ev: EventoTrazabilidad): string {
  const d = ev.detalle ?? {};
  const quien = ev.nombreUsuario ?? "The system";
  const que = ev.nombreAfectado;
  const pedido = txt(d.identificadorPedido) ?? (ev.entidadAfectada === "PEDIDO" ? que : null);

  switch (ev.tipoEvento) {
    case "LOGIN_EXITOSO":
      return `${quien} signed in.`;
    case "LOGOUT_MANUAL":
      return `${quien} signed out.`;
    case "LOGOUT_POR_INACTIVIDAD":
      return `${quien}'s session was closed due to inactivity.`;
    case "LOGIN_FALLIDO":
      return `Failed sign-in attempt${que ? ` with user ${que}` : ""}${num(d.intentosFallidos) ? ` (attempt ${num(d.intentosFallidos)})` : ""}.`;
    case "PEDIDO_ABIERTO":
      return `${quien} opened order${pedido ? ` ${pedido}` : ""}.`;
    case "PRODUCTO_REGISTRADO_EN_PEDIDO": {
      const cant = num(d.cantidad);
      const precio = num(d.precioVentaCongelado);
      return `${quien} added ${cant ?? "?"} × ${que ?? "a product"} to the order${precio !== null ? ` (unit price ${pesos(precio)})` : ""}.`;
    }
    case "PEDIDO_CERRADO": {
      const total = num(d.total);
      return `${quien} closed order ${pedido ?? ""}${total !== null ? ` with a bill of ${pesos(total)}` : ""}.`;
    }
    case "PAGO_REGISTRADO": {
      const valor = num(d.valor);
      const metodo = METODOS[String(d.metodo)] ?? txt(d.metodo) ?? "";
      const modalidad = MODALIDADES[String(d.modalidad)] ?? "";
      return `${quien} recorded ${modalidad ? `a ${modalidad}` : "a payment"} of ${valor !== null ? pesos(valor) : "—"} by ${metodo} for order ${pedido ?? ""}.`;
    }
    case "PEDIDO_PAGADO": {
      const total = num(d.total);
      return `Order ${pedido ?? ""} was fully paid${total !== null ? ` (${pesos(total)})` : ""}.`;
    }
    case "MESA_LIBERADA":
      return `${que ?? "The table"} was freed${txt(d.motivo) ? ` because ${MOTIVOS[String(d.motivo)] ?? String(d.motivo)}` : ""}.`;
    case "PRODUCTO_PRECIO_MODIFICADO": {
      const partes: string[] = [];
      const cA = num(d.valorCompraAnterior);
      const cN = num(d.valorCompra);
      const vA = num(d.valorVentaAnterior);
      const vN = num(d.valorVenta);
      if (cA !== null && cN !== null && cA !== cN) partes.push(`purchase ${pesos(cA)} → ${pesos(cN)}`);
      if (vA !== null && vN !== null && vA !== vN) partes.push(`sale ${pesos(vA)} → ${pesos(vN)}`);
      return `${quien} changed the price of ${que ?? "a product"}${partes.length ? `: ${partes.join("; ")}` : ""}.`;
    }
    case "INVENTARIO_AJUSTADO": {
      const a = num(d.cantidadAnterior);
      const r = num(d.cantidadResultante);
      const aj = num(d.ajuste);
      return `${quien} adjusted the inventory of ${que ?? "a product"}${a !== null && r !== null ? ` from ${a} to ${r} units` : ""}${aj !== null ? ` (${aj > 0 ? "+" : ""}${aj})` : ""}${txt(d.motivo) ? `. Reason: ${MOTIVOS[String(d.motivo)] ?? txt(d.motivo)}` : ""}.`;
    }
    case "RECEPCION_REGISTRADA":
      return `${quien} recorded a goods receipt${Array.isArray(d.lineas) ? ` (${d.lineas.length} product${d.lineas.length === 1 ? "" : "s"})` : ""}.`;
    case "PRODUCTO_INACTIVADO":
      return d.motivo === "TIPO_PRODUCTO_INACTIVADO"
        ? `${que ?? "A product"} was deactivated because ${quien} deactivated its product type.`
        : `${quien} deactivated the product ${que ?? ""}.`.replace(" .", ".");
    case "TIPO_PRODUCTO_INACTIVADO": {
      const n = num(d.productosInactivados);
      return `${quien} deactivated the product type ${que ?? ""}${n ? `, along with ${n} product${n === 1 ? "" : "s"}` : ""}.`.replace(" ,", ",");
    }
    default: {
      const etiqueta = etiquetaEvento(ev.tipoEvento);
      return `${quien}: ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}${que ? ` — ${que}` : ""}.`;
    }
  }
}

const ETIQUETAS_DETALLE: Record<string, string> = {
  identificadorPedido: "Order",
  idPedido: "Internal order no.",
  idMesa: "Internal table no.",
  idProducto: "Internal product no.",
  cantidad: "Quantity",
  precioVentaCongelado: "Sale price applied",
  precioCompraCongelado: "Cost applied",
  total: "Total",
  valor: "Amount",
  metodo: "Payment method",
  modalidad: "Payment type",
  valorCompraAnterior: "Previous cost",
  valorCompra: "New cost",
  valorVentaAnterior: "Previous sale price",
  valorVenta: "New sale price",
  cantidadAnterior: "Previous quantity",
  ajuste: "Adjustment",
  cantidadResultante: "Resulting quantity",
  motivo: "Reason",
  intentosFallidos: "Failed attempts",
  codigo: "Code",
  codigoSede: "Location code",
  codigoUsuario: "User code",
  perfil: "Role",
  abreviacion: "Abbreviation",
  sesionAnteriorCerrada: "Previous session on another device closed",
  ejecutadoPor: "Performed by (user no.)",
  idProveedor: "Internal supplier no.",
  fechaRecepcion: "Receipt date",
  lineas: "Products received",
  productosInactivados: "Products deactivated",
  idTipoProducto: "Internal type no.",
};

const CLAVES_DINERO = new Set([
  "valor", "total", "precioVentaCongelado", "precioCompraCongelado",
  "valorCompraAnterior", "valorCompra", "valorVentaAnterior", "valorVenta",
]);

/** Pares etiqueta/valor listos para mostrar como "datos adicionales". */
export function detalleLegible(ev: EventoTrazabilidad): Array<{ etiqueta: string; valor: string }> {
  const d = ev.detalle;
  if (!d) return [];
  const salida: Array<{ etiqueta: string; valor: string }> = [];
  for (const [clave, valor] of Object.entries(d)) {
    if (valor === null || valor === undefined) continue;
    let texto: string;
    if (CLAVES_DINERO.has(clave) && num(valor) !== null) texto = pesos(num(valor) as number);
    else if (clave === "metodo") texto = METODOS[String(valor)] ?? String(valor);
    else if (clave === "modalidad") texto = MODALIDADES[String(valor)] ?? String(valor);
    else if (clave === "motivo") texto = MOTIVOS[String(valor)] ?? String(valor);
    else if (Array.isArray(valor)) texto = `${valor.length} line${valor.length === 1 ? "" : "s"}`;
    else if (typeof valor === "object") texto = JSON.stringify(valor);
    else texto = String(valor);
    salida.push({ etiqueta: ETIQUETAS_DETALLE[clave] ?? clave, valor: texto });
  }
  return salida;
}
