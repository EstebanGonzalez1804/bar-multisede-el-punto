import type { Response } from "express";
import PDFDocument from "pdfkit";
import type { Pedido } from "./pedidos.service";

const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA_CREDITO: "Tarjeta crédito",
  TARJETA_DEBITO: "Tarjeta débito",
};

function pesos(valor: number): string {
  return `$${valor.toLocaleString("es-CO")}`;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

/**
 * HU-031 CA-02/CA-03 — Cuenta en PDF con el ancho de una tirilla de 80 mm
 * (226,77 pt), pensada para impresora térmica de caja y para descarga.
 * CA-05: es un documento interno; se rotula expresamente como "no es factura
 * electrónica" y no incluye ningún dato tributario.
 */
export function enviarCuentaPdf(pedido: Pedido, res: Response): void {
  const ancho = 226.77;
  const alto = Math.max(300, 230 + pedido.lineas.length * 34 + pedido.pagos.length * 16);
  const margen = 12;
  const util = ancho - margen * 2;

  const doc = new PDFDocument({ size: [ancho, alto], margin: margen });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cuenta-${pedido.identificadorPedido}.pdf"`);
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(13).text("EL PUNTO", { align: "center" });
  doc.font("Helvetica").fontSize(8).text(pedido.nombreSede, { align: "center" });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(9).text("CUENTA DE CONSUMO", { align: "center" });
  doc.font("Helvetica").fontSize(7).text("Documento interno · no es factura electrónica", { align: "center" });
  doc.moveDown(0.6);

  doc.fontSize(8);
  doc.text(`Pedido: ${pedido.identificadorPedido}`);
  doc.text(`Mesa: ${pedido.identificadorMesa}`);
  doc.text(`Atendió: ${pedido.nombreMesero}`);
  doc.text(`Apertura: ${fechaHora(pedido.fechaApertura)}`);
  if (pedido.fechaCierre) doc.text(`Cierre: ${fechaHora(pedido.fechaCierre)}`);
  doc.moveDown(0.4);

  const linea = () => {
    doc.moveTo(margen, doc.y).lineTo(margen + util, doc.y).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
  };
  linea();

  for (const l of pedido.lineas) {
    const precio = Number(l.precioVentaCongelado);
    doc.font("Helvetica-Bold").fontSize(8).text(l.nombreProducto, { width: util });
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(`${l.cantidad} x ${pesos(precio)}   =   ${pesos(precio * l.cantidad)}`, { width: util, align: "right" });
    doc.moveDown(0.2);
  }
  linea();

  doc.font("Helvetica-Bold").fontSize(10).text(`TOTAL: ${pesos(pedido.total)}`, { width: util, align: "right" });

  if (pedido.pagos.length > 0) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(8).text("Pagos registrados");
    doc.font("Helvetica").fontSize(8);
    for (const p of pedido.pagos) {
      doc.text(`${METODOS[p.metodo] ?? p.metodo}: ${pesos(p.valor)}`);
    }
    doc.font("Helvetica-Bold").text(`Saldo pendiente: ${pesos(pedido.saldoPendiente)}`);
  }

  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(8).text("¡Gracias por visitarnos!", { align: "center" });

  doc.end();
}
