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
 * Groups lines of the same product AT THE SAME PRICE for display
 * ("3 + 2 Club Colombia" -> "5 × Club Colombia"). Presentation only: in the
 * database each batch remains its own immutable line with its frozen price
 * (HU-026 CA-05). If the price changed between batches, they stay as
 * separate groups.
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
