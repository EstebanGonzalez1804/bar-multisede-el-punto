import { MOTIVOS_AJUSTE, type EventoTrazabilidad } from "../api/types";
import { pesos } from "./format";

/** Categorías para agrupar/filtrar los eventos de forma entendible. */
export type CategoriaEvento = "Accesos" | "Usuarios" | "Pedidos y pagos" | "Catálogo" | "Inventario" | "Sedes y mesas";

interface InfoEvento {
  etiqueta: string;
  categoria: CategoriaEvento;
  /** Tono visual: informativo, positivo, aviso o alerta. */
  tono: "info" | "ok" | "aviso" | "alerta";
}

const EVENTOS: Record<string, InfoEvento> = {
  LOGIN_EXITOSO: { etiqueta: "Inició sesión", categoria: "Accesos", tono: "info" },
  LOGOUT_MANUAL: { etiqueta: "Cerró sesión", categoria: "Accesos", tono: "info" },
  LOGOUT_POR_INACTIVIDAD: { etiqueta: "Sesión cerrada por inactividad", categoria: "Accesos", tono: "aviso" },
  LOGIN_FALLIDO: { etiqueta: "Intento de ingreso fallido", categoria: "Accesos", tono: "alerta" },
  LOGIN_RECHAZADO_BLOQUEADO: { etiqueta: "Ingreso rechazado (usuario bloqueado)", categoria: "Accesos", tono: "alerta" },
  LOGIN_RECHAZADO_INACTIVO: { etiqueta: "Ingreso rechazado (usuario inactivo)", categoria: "Accesos", tono: "alerta" },
  USUARIO_BLOQUEADO_POR_INTENTOS: { etiqueta: "Usuario bloqueado por intentos fallidos", categoria: "Accesos", tono: "alerta" },
  CAMBIO_PASSWORD_PROPIA: { etiqueta: "Cambió su contraseña", categoria: "Usuarios", tono: "info" },
  CAMBIO_PASSWORD_POR_ADMIN: { etiqueta: "Contraseña restablecida por el administrador", categoria: "Usuarios", tono: "aviso" },
  USUARIO_CREADO: { etiqueta: "Usuario creado", categoria: "Usuarios", tono: "ok" },
  USUARIO_MODIFICADO: { etiqueta: "Usuario modificado", categoria: "Usuarios", tono: "info" },
  USUARIO_ACTIVADO: { etiqueta: "Usuario activado", categoria: "Usuarios", tono: "ok" },
  USUARIO_INACTIVADO: { etiqueta: "Usuario inactivado", categoria: "Usuarios", tono: "aviso" },
  USUARIO_BLOQUEADO: { etiqueta: "Usuario bloqueado", categoria: "Usuarios", tono: "alerta" },
  USUARIO_DESBLOQUEADO: { etiqueta: "Usuario desbloqueado", categoria: "Usuarios", tono: "ok" },
  PEDIDO_ABIERTO: { etiqueta: "Pedido abierto", categoria: "Pedidos y pagos", tono: "info" },
  PRODUCTO_REGISTRADO_EN_PEDIDO: { etiqueta: "Producto agregado a un pedido", categoria: "Pedidos y pagos", tono: "info" },
  PEDIDO_CERRADO: { etiqueta: "Pedido cerrado (cuenta generada)", categoria: "Pedidos y pagos", tono: "info" },
  PAGO_REGISTRADO: { etiqueta: "Pago registrado", categoria: "Pedidos y pagos", tono: "ok" },
  PEDIDO_PAGADO: { etiqueta: "Pedido pagado por completo", categoria: "Pedidos y pagos", tono: "ok" },
  MESA_LIBERADA: { etiqueta: "Mesa liberada", categoria: "Pedidos y pagos", tono: "info" },
  PRODUCTO_CREADO: { etiqueta: "Producto creado", categoria: "Catálogo", tono: "ok" },
  PRODUCTO_MODIFICADO: { etiqueta: "Producto modificado", categoria: "Catálogo", tono: "info" },
  PRODUCTO_PRECIO_MODIFICADO: { etiqueta: "Precio de producto modificado", categoria: "Catálogo", tono: "aviso" },
  PRODUCTO_ACTIVADO: { etiqueta: "Producto activado", categoria: "Catálogo", tono: "ok" },
  PRODUCTO_INACTIVADO: { etiqueta: "Producto inactivado", categoria: "Catálogo", tono: "aviso" },
  TIPO_PRODUCTO_CREADO: { etiqueta: "Tipo de producto creado", categoria: "Catálogo", tono: "ok" },
  TIPO_PRODUCTO_MODIFICADO: { etiqueta: "Tipo de producto modificado", categoria: "Catálogo", tono: "info" },
  TIPO_PRODUCTO_ACTIVADO: { etiqueta: "Tipo de producto activado", categoria: "Catálogo", tono: "ok" },
  TIPO_PRODUCTO_INACTIVADO: { etiqueta: "Tipo de producto inactivado", categoria: "Catálogo", tono: "aviso" },
  PROVEEDOR_CREADO: { etiqueta: "Proveedor creado", categoria: "Inventario", tono: "ok" },
  PROVEEDOR_MODIFICADO: { etiqueta: "Proveedor modificado", categoria: "Inventario", tono: "info" },
  PROVEEDOR_ACTIVADO: { etiqueta: "Proveedor activado", categoria: "Inventario", tono: "ok" },
  PROVEEDOR_INACTIVADO: { etiqueta: "Proveedor inactivado", categoria: "Inventario", tono: "aviso" },
  RECEPCION_REGISTRADA: { etiqueta: "Mercancía recibida", categoria: "Inventario", tono: "ok" },
  INVENTARIO_AJUSTADO: { etiqueta: "Inventario ajustado", categoria: "Inventario", tono: "aviso" },
  SEDE_CREADA: { etiqueta: "Sede creada", categoria: "Sedes y mesas", tono: "ok" },
  SEDE_MODIFICADA: { etiqueta: "Sede modificada", categoria: "Sedes y mesas", tono: "info" },
  SEDE_ACTIVADA: { etiqueta: "Sede activada", categoria: "Sedes y mesas", tono: "ok" },
  SEDE_INACTIVADA: { etiqueta: "Sede inactivada", categoria: "Sedes y mesas", tono: "aviso" },
  MESA_CREADA: { etiqueta: "Mesa creada", categoria: "Sedes y mesas", tono: "ok" },
  MESA_MODIFICADA: { etiqueta: "Mesa modificada", categoria: "Sedes y mesas", tono: "info" },
  MESA_ACTIVADA: { etiqueta: "Mesa activada", categoria: "Sedes y mesas", tono: "ok" },
  MESA_INACTIVADA: { etiqueta: "Mesa inactivada", categoria: "Sedes y mesas", tono: "aviso" },
};

/** "PEDIDO_ALGO_RARO" -> "Pedido algo raro" para eventos futuros sin traducción. */
function humanizar(tipo: string): string {
  const t = tipo.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function infoEvento(tipo: string): InfoEvento {
  return EVENTOS[tipo] ?? { etiqueta: humanizar(tipo), categoria: "Catálogo", tono: "info" };
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
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([categoria, lista]) => ({ categoria, tipos: lista.sort((x, y) => x.etiqueta.localeCompare(y.etiqueta, "es")) }));
}

const METODOS: Record<string, string> = {
  EFECTIVO: "efectivo",
  TARJETA_CREDITO: "tarjeta de crédito",
  TARJETA_DEBITO: "tarjeta de débito",
};

const MODALIDADES: Record<string, string> = {
  TOTAL: "pago completo",
  ABONO: "abono",
  PRODUCTOS: "pago por productos",
};

const MOTIVOS: Record<string, string> = {
  PAGO_COMPLETO: "el pedido se pagó por completo",
  TIPO_PRODUCTO_INACTIVADO: "se inactivó su tipo de producto",
  ...Object.fromEntries(MOTIVOS_AJUSTE.map((m) => [m.value, m.label.toLowerCase()])),
};

/** Cómo se nombra cada entidad en una frase ("inactivó la sede …"). */
const SUSTANTIVOS: Record<string, string> = {
  SEDE: "la sede",
  MESA: "la mesa",
  USUARIO: "al usuario",
  PRODUCTO: "el producto",
  TIPO_PRODUCTO: "el tipo de producto",
  PROVEEDOR: "al proveedor",
  INVENTARIO: "el inventario de",
  PEDIDO: "el pedido",
};

const VERBOS: Record<string, string> = {
  CREADO: "creó",
  CREADA: "creó",
  MODIFICADO: "modificó",
  MODIFICADA: "modificó",
  ACTIVADO: "activó",
  ACTIVADA: "activó",
  INACTIVADO: "inactivó",
  INACTIVADA: "inactivó",
  DESBLOQUEADO: "desbloqueó",
  BLOQUEADO: "bloqueó",
};

/** "Laura Gómez inactivó la sede Usaquén" — frase genérica para altas, cambios y estados. */
function fraseGenerica(ev: EventoTrazabilidad, quien: string): string | null {
  const partes = ev.tipoEvento.split("_");
  const verbo = VERBOS[partes[partes.length - 1]];
  if (!verbo) return null;
  const sustantivo = SUSTANTIVOS[ev.entidadAfectada] ?? "";
  let nombre = ev.nombreAfectado ?? "";
  // Evita "la sede Sede Usaquén" o "la mesa Mesa 1".
  const palabra = sustantivo.split(" ").pop() ?? "";
  if (palabra && nombre.toLowerCase().startsWith(`${palabra} `)) nombre = nombre.slice(palabra.length + 1);
  return `${quien} ${verbo} ${sustantivo}${nombre ? ` ${nombre}` : ""}.`.replace(/\s+\./, ".");
}

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
  const quien = ev.nombreUsuario ?? "El sistema";
  const que = ev.nombreAfectado;
  const pedido = txt(d.identificadorPedido) ?? (ev.entidadAfectada === "PEDIDO" ? que : null);

  switch (ev.tipoEvento) {
    case "LOGIN_EXITOSO":
      return `${quien} inició sesión.`;
    case "LOGOUT_MANUAL":
      return `${quien} cerró sesión.`;
    case "LOGOUT_POR_INACTIVIDAD":
      return `La sesión de ${quien} se cerró por inactividad.`;
    case "LOGIN_FALLIDO":
      return `Intento de ingreso fallido${que ? ` con el usuario ${que}` : ""}${num(d.intentosFallidos) ? ` (intento ${num(d.intentosFallidos)})` : ""}.`;
    case "PEDIDO_ABIERTO":
      return `${quien} abrió el pedido${pedido ? ` ${pedido}` : ""}.`;
    case "PRODUCTO_REGISTRADO_EN_PEDIDO": {
      const cant = num(d.cantidad);
      const precio = num(d.precioVentaCongelado);
      return `${quien} agregó ${cant ?? "?"} × ${que ?? "un producto"} al pedido${precio !== null ? ` (precio unitario ${pesos(precio)})` : ""}.`;
    }
    case "PEDIDO_CERRADO": {
      const total = num(d.total);
      return `${quien} cerró el pedido ${pedido ?? ""}${total !== null ? ` con una cuenta de ${pesos(total)}` : ""}.`;
    }
    case "PAGO_REGISTRADO": {
      const valor = num(d.valor);
      const metodo = METODOS[String(d.metodo)] ?? txt(d.metodo) ?? "";
      const modalidad = MODALIDADES[String(d.modalidad)] ?? "";
      return `${quien} registró ${modalidad ? `un ${modalidad}` : "un pago"} de ${valor !== null ? pesos(valor) : "—"} en ${metodo} para el pedido ${pedido ?? ""}.`;
    }
    case "PEDIDO_PAGADO": {
      const total = num(d.total);
      return `El pedido ${pedido ?? ""} quedó pagado por completo${total !== null ? ` (${pesos(total)})` : ""}.`;
    }
    case "MESA_LIBERADA":
      return `${que ?? "La mesa"} quedó libre${txt(d.motivo) ? ` porque ${MOTIVOS[String(d.motivo)] ?? String(d.motivo)}` : ""}.`;
    case "PRODUCTO_PRECIO_MODIFICADO": {
      const partes: string[] = [];
      const cA = num(d.valorCompraAnterior);
      const cN = num(d.valorCompra);
      const vA = num(d.valorVentaAnterior);
      const vN = num(d.valorVenta);
      if (cA !== null && cN !== null && cA !== cN) partes.push(`compra ${pesos(cA)} → ${pesos(cN)}`);
      if (vA !== null && vN !== null && vA !== vN) partes.push(`venta ${pesos(vA)} → ${pesos(vN)}`);
      return `${quien} cambió el precio de ${que ?? "un producto"}${partes.length ? `: ${partes.join("; ")}` : ""}.`;
    }
    case "INVENTARIO_AJUSTADO": {
      const a = num(d.cantidadAnterior);
      const r = num(d.cantidadResultante);
      const aj = num(d.ajuste);
      const motivo = txt(d.motivo) ? MOTIVOS[String(d.motivo)] ?? String(d.motivo).toLowerCase() : null;
      return `${quien} ajustó el inventario de ${que ?? "un producto"}${a !== null && r !== null ? ` de ${a} a ${r} unidades` : ""}${aj !== null ? ` (${aj > 0 ? "+" : ""}${aj})` : ""}${motivo ? ` por ${motivo}` : ""}.`;
    }
    case "RECEPCION_REGISTRADA":
      return `${quien} registró una recepción de mercancía${Array.isArray(d.lineas) ? ` (${d.lineas.length} producto${d.lineas.length === 1 ? "" : "s"})` : ""}.`;
    case "PRODUCTO_INACTIVADO":
      return d.motivo === "TIPO_PRODUCTO_INACTIVADO"
        ? `${que ?? "Un producto"} se inactivó porque ${quien} inactivó su tipo de producto.`
        : `${quien} inactivó el producto ${que ?? ""}.`.replace(" .", ".");
    case "TIPO_PRODUCTO_INACTIVADO": {
      const n = num(d.productosInactivados);
      return `${quien} inactivó el tipo de producto ${que ?? ""}${n ? `, junto con ${n} producto${n === 1 ? "" : "s"}` : ""}.`.replace(" ,", ",");
    }
    case "USUARIO_BLOQUEADO_POR_INTENTOS":
      return `${que ? `El usuario ${que}` : "Un usuario"} quedó bloqueado tras varios intentos fallidos.`;
    case "LOGIN_RECHAZADO_BLOQUEADO":
      return `Se rechazó el ingreso de ${que ?? "un usuario"} porque está bloqueado.`;
    case "LOGIN_RECHAZADO_INACTIVO":
      return `Se rechazó el ingreso de ${que ?? "un usuario"} porque está inactivo.`;
    case "CAMBIO_PASSWORD_PROPIA":
      return `${quien} cambió su contraseña.`;
    case "CAMBIO_PASSWORD_POR_ADMIN":
      return `${quien} restableció la contraseña de ${que ?? "un usuario"}.`;
    default: {
      const generica = fraseGenerica(ev, quien);
      if (generica) return generica;
      const etiqueta = etiquetaEvento(ev.tipoEvento);
      return `${quien}: ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}${que ? ` — ${que}` : ""}.`;
    }
  }
}

const ETIQUETAS_DETALLE: Record<string, string> = {
  identificadorPedido: "Pedido",
  idPedido: "N.º interno de pedido",
  idMesa: "N.º interno de mesa",
  idProducto: "N.º interno de producto",
  cantidad: "Cantidad",
  precioVentaCongelado: "Precio de venta aplicado",
  precioCompraCongelado: "Costo aplicado",
  total: "Total",
  valor: "Valor",
  metodo: "Método de pago",
  modalidad: "Modalidad",
  valorCompraAnterior: "Costo anterior",
  valorCompra: "Costo nuevo",
  valorVentaAnterior: "Precio de venta anterior",
  valorVenta: "Precio de venta nuevo",
  cantidadAnterior: "Cantidad anterior",
  ajuste: "Ajuste",
  cantidadResultante: "Cantidad resultante",
  motivo: "Motivo",
  intentosFallidos: "Intentos fallidos",
  codigo: "Código",
  codigoSede: "Código de sede",
  codigoUsuario: "Código de usuario",
  perfil: "Perfil",
  abreviacion: "Abreviación",
  ejecutadoPor: "Ejecutado por (n.º de usuario)",
  idProveedor: "N.º interno de proveedor",
  fechaRecepcion: "Fecha de recepción",
  lineas: "Productos recibidos",
  productosCubiertos: "Productos cubiertos por el pago",
  productosInactivados: "Productos inactivados",
  idTipoProducto: "N.º interno de tipo",
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
    else if (Array.isArray(valor)) texto = `${valor.length} producto${valor.length === 1 ? "" : "s"}`;
    else if (typeof valor === "object") texto = JSON.stringify(valor);
    else texto = String(valor);
    salida.push({ etiqueta: ETIQUETAS_DETALLE[clave] ?? clave, valor: texto });
  }
  return salida;
}
