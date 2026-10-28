import type { Response } from "express";
import PDFDocument from "pdfkit";
import type { Pedido } from "./pedidos.service";

const METODOS: Record<string, string> = {
  EFECTIVO: "Cash",
  TARJETA_CREDITO: "Credit card",
  TARJETA_DEBITO: "Debit card",
};

function pesos(valor: number): string {
  return `$${valor.toLocaleString("en-US")}`;
}

/** "27/10/2026 · 8:15 PM" (without seconds), en hora de Colombia. */
function fechaHora(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("en-GB", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("en-US", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  return `${fecha} · ${hora}`;
}

interface GrupoLinea {
  nombre: string;
  precio: number;
  cantidad: number;
}

/**
 * Las tandas del mismo producto al mismo precio se imprimen juntas
 * ("5 x Club Colombia"), igual que en pantalla. En la base de datos cada
 * tanda sigue siendo su propia línea inmutable.
 */
function agruparLineas(pedido: Pedido): GrupoLinea[] {
  const grupos: Array<GrupoLinea & { clave: string }> = [];
  for (const l of pedido.lineas) {
    const precio = Number(l.precioVentaCongelado);
    const clave = `${l.idProducto}-${precio}`;
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = { clave, nombre: l.nombreProducto, precio, cantidad: 0 };
      grupos.push(g);
    }
    g.cantidad += l.cantidad;
  }
  return grupos;
}

/**
 * HU-031 CA-02/CA-03 — Cuenta en PDF con el ancho de una tirilla de 80 mm
 * (226,77 pt), pensada para impresora térmica de caja y para descarga.
 * CA-05: es un documento interno; se rotula expresamente como "no es factura
 * electrónica" y no incluye ningún dato tributario.
 */
export function enviarCuentaPdf(pedido: Pedido, res: Response): void {
  const ancho = 226.77;
  const grupos = agruparLineas(pedido);
  const alto = Math.max(300, 230 + grupos.length * 34 + pedido.pagos.length * 16);
  const margen = 12;
  const util = ancho - margen * 2;

  const doc = new PDFDocument({ size: [ancho, alto], margin: margen });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="bill-${pedido.identificadorPedido}.pdf"`);
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(13).text("EL PUNTO", { align: "center" });
  doc.font("Helvetica").fontSize(8).text(pedido.nombreSede, { align: "center" });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(9).text("CONSUMPTION BILL", { align: "center" });
  doc.font("Helvetica").fontSize(7).text("Internal document · not an electronic invoice", { align: "center" });
  doc.moveDown(0.6);

  doc.fontSize(8);
  doc.text(`Order: ${pedido.identificadorPedido}`);
  doc.text(`Table: ${pedido.identificadorMesa}`);
  doc.text(`Served by: ${pedido.nombreMesero}`);
  doc.text(`Opened: ${fechaHora(pedido.fechaApertura)}`);
  if (pedido.fechaCierre) doc.text(`Closed: ${fechaHora(pedido.fechaCierre)}`);
  doc.moveDown(0.4);

  const linea = () => {
    doc.moveTo(margen, doc.y).lineTo(margen + util, doc.y).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  };
  linea();

  for (const g of grupos) {
    doc.font("Helvetica-Bold").fontSize(8).text(g.nombre, { width: util });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(`${g.cantidad} x ${pesos(g.precio)}   =   ${pesos(g.precio * g.cantidad)}`, { width: util, align: "right" });
    doc.moveDown(0.2);
  }
  linea();

  doc.font("Helvetica-Bold").fontSize(10).text(`TOTAL: ${pesos(pedido.total)}`, { width: util, align: "right" });

  if (pedido.pagos.length > 0) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(8).text("Recorded payments");
    doc.font("Helvetica").fontSize(8);
    for (const p of pedido.pagos) {
      doc.text(`${METODOS[p.metodo] ?? p.metodo}: ${pesos(p.valor)}`);
    }
    doc.font("Helvetica-Bold").text(`Pending balance: ${pesos(pedido.saldoPendiente)}`);
  }

  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(8).text("Thank you for visiting!", { align: "center" });

  doc.end();
}
