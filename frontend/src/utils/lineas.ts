import type { LineaPedido } from "../api/types";

export interface GrupoLineas {
  clave: string;
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  precioVenta: number;
  cantidad: number;
  cantidadPagada: number;
  subtotal: number;
}

/**
 * Agrupa para mostrar las líneas del mismo producto AL MISMO PRECIO
 * ("3 + 2 Club Colombia" -> "5 × Club Colombia"). Solo cambia la
 * presentación: en la base de datos cada tanda sigue siendo su propia línea,
 * inmutable, con su precio congelado (HU-026 CA-05). Si el precio cambió
 * entre una tanda y otra, quedan como grupos separados.
 */
export function agruparLineas(lineas: LineaPedido[]): GrupoLineas[] {
  const grupos: GrupoLineas[] = [];
  for (const l of lineas) {
    const precio = Number(l.precioVentaCongelado);
    const clave = `${l.idProducto}-${precio}`;
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = {
        clave,
        idProducto: l.idProducto,
        codigoProducto: l.codigoProducto,
        nombreProducto: l.nombreProducto,
        precioVenta: precio,
        cantidad: 0,
        cantidadPagada: 0,
        subtotal: 0,
      };
      grupos.push(g);
    }
    g.cantidad += l.cantidad;
    g.cantidadPagada += l.cantidadPagada ?? 0;
    g.subtotal += precio * l.cantidad;
  }
  return grupos;
}
