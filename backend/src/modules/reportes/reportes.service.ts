import ExcelJS, { type Borders } from "exceljs";
import { pool } from "../../config/db";

export interface FilaReporteVentas {
  fecha: string;
  codigoProducto: string;
  nombreProducto: string;
  cantidadVendida: number;
  valorCompra: number;
  valorVenta: number;
  ganancia: number;
  idSede: number;
  nombreSede: string;
}

export interface ReporteVentas {
  desde: string;
  hasta: string;
  filas: FilaReporteVentas[];
  totales: {
    unidadesVendidas: number;
    costosCompra: number;
    ventas: number;
    gananciaTotal: number;
  };
}

/**
 * HU-039 — Reporte de ventas y ganancias por rango de fechas.
 *
 * - "Venta" = producto de un pedido pagado por completo; la fecha es la del
 *   último pago (cuando la venta quedó confirmada), en hora de Colombia.
 * - CA-02: ganancia = (valor de venta histórico − valor de compra histórico) ×
 *   cantidad, usando los precios CONGELADOS en cada línea del pedido, es decir
 *   los vigentes cuando se registró el consumo (no los precios actuales).
 * - Se agrupa por fecha, producto, precios y sede, para que un cambio de precio
 *   a mitad del periodo aparezca en filas separadas.
 * - Importes calculados en centavos enteros (sin errores de coma flotante).
 * `idSede` ya viene resuelto por resolveSedeScope (Cajero: su sede;
 * Administrador: la elegida o todas — CA-04/CA-05).
 */
export async function generarReporteVentas(
  desde: string,
  hasta: string,
  idSede: number | null
): Promise<ReporteVentas> {
  const valores: unknown[] = [desde, hasta];
  let filtroSede = "";
  if (idSede !== null) {
    valores.push(idSede);
    filtroSede = `AND p.id_sede = $${valores.length}`;
  }

  const { rows } = await pool.query<{
    fecha: string;
    codigo: string;
    nombre: string;
    cantidad: string;
    compra_cent: string;
    venta_cent: string;
    id_sede: number;
    nombre_sede: string;
  }>(
    `SELECT to_char((ult.fecha AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS fecha,
            pr.codigo, pr.nombre,
            SUM(d.cantidad) AS cantidad,
            ROUND(d.precio_compra_congelado * 100) AS compra_cent,
            ROUND(d.precio_venta_congelado * 100) AS venta_cent,
            p.id_sede, s.nombre AS nombre_sede
     FROM detalle_pedido d
     JOIN pedido p ON p.id_pedido = d.id_pedido
     JOIN producto pr ON pr.id_producto = d.id_producto
     JOIN sede s ON s.id_sede = p.id_sede
     JOIN LATERAL (SELECT MAX(pg.fecha_hora) AS fecha FROM pago pg WHERE pg.id_pedido = p.id_pedido) ult ON TRUE
     WHERE p.estado_pago = 'PAGADO'
       AND (ult.fecha AT TIME ZONE 'America/Bogota')::date BETWEEN $1::date AND $2::date
       ${filtroSede}
     GROUP BY 1, pr.codigo, pr.nombre, d.precio_compra_congelado, d.precio_venta_congelado, p.id_sede, s.nombre
     ORDER BY 1, s.nombre, pr.codigo`,
    valores
  );

  let unidades = 0;
  let costoCent = 0;
  let ventaCent = 0;
  const filas: FilaReporteVentas[] = rows.map((r) => {
    const cantidad = Number(r.cantidad);
    const compra = Number(r.compra_cent);
    const venta = Number(r.venta_cent);
    unidades += cantidad;
    costoCent += compra * cantidad;
    ventaCent += venta * cantidad;
    return {
      fecha: r.fecha,
      codigoProducto: r.codigo,
      nombreProducto: r.nombre,
      cantidadVendida: cantidad,
      valorCompra: compra / 100,
      valorVenta: venta / 100,
      ganancia: ((venta - compra) * cantidad) / 100,
      idSede: r.id_sede,
      nombreSede: r.nombre_sede,
    };
  });

  return {
    desde,
    hasta,
    filas,
    totales: {
      unidadesVendidas: unidades,
      costosCompra: costoCent / 100,
      ventas: ventaCent / 100,
      gananciaTotal: (ventaCent - costoCent) / 100,
    },
  };
}

/**
 * HU-039 CA-07 — Exportación únicamente en Microsoft Excel (.xlsx).
 *
 * Diseñado para trabajarse en Excel: encabezado con filtros automáticos
 * (por fecha, producto, sede, etc.), fechas reales, ganancia calculada por
 * fórmula y fila TOTALES con SUBTOTAL, que solo suma las filas visibles; así,
 * al filtrar, los totales se ajustan solos. Cajero y Administrador reciben el
 * mismo formato (el Cajero ya viene limitado a su sede por el backend).
 */
export async function generarExcelVentas(reporte: ReporteVentas): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "El Punto";
  const ws = wb.addWorksheet("Sales and profit", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const COLS = 8;
  const VERDE = "FF173A33";
  const borde: Partial<Borders> = {
    top: { style: "thin", color: { argb: "FF8A9A94" } },
    left: { style: "thin", color: { argb: "FF8A9A94" } },
    bottom: { style: "thin", color: { argb: "FF8A9A94" } },
    right: { style: "thin", color: { argb: "FF8A9A94" } },
  };
  const FORMATO_PESOS = '"$"#,##0';

  // Fila 1: título combinado.
  ws.mergeCells(1, 1, 1, COLS);
  const titulo = ws.getCell(1, 1);
  titulo.value = `Sales and profit report · ${reporte.desde} to ${reporte.hasta}`;
  titulo.font = { bold: true, size: 14, color: { argb: VERDE } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  titulo.border = borde;
  ws.getRow(1).height = 26;

  // Fila 2: encabezado con filtros.
  const encabezado = ws.getRow(2);
  [
    "Date",
    "Code",
    "Product",
    "Quantity sold",
    "Purchase value",
    "Sale value",
    "Profit",
    "Location",
  ].forEach((texto, i) => {
    const c = encabezado.getCell(i + 1);
    c.value = texto;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borde;
  });
  encabezado.height = 24;

  // Filas de datos (desde la 3). La ganancia es fórmula: venta - compra.
  const primera = 3;
  reporte.filas.forEach((f, idx) => {
    const n = primera + idx;
    const fila = ws.getRow(n);
    fila.getCell(1).value = new Date(`${f.fecha}T00:00:00Z`);
    fila.getCell(1).numFmt = "dd/mm/yyyy";
    fila.getCell(2).value = f.codigoProducto;
    fila.getCell(3).value = f.nombreProducto;
    fila.getCell(4).value = f.cantidadVendida;
    fila.getCell(5).value = f.valorCompra;
    fila.getCell(6).value = f.valorVenta;
    fila.getCell(7).value = { formula: `(F${n}-E${n})*D${n}`, result: f.ganancia };
    fila.getCell(8).value = f.nombreSede;
    for (const col of [5, 6, 7]) fila.getCell(col).numFmt = FORMATO_PESOS;
    fila.getCell(4).numFmt = "#,##0";
    fila.getCell(1).alignment = { horizontal: "center" };
    fila.getCell(2).alignment = { horizontal: "center" };
    for (let col = 1; col <= COLS; col++) fila.getCell(col).border = borde;
  });
  const ultima = primera + reporte.filas.length - 1;

  // Filtros automáticos sobre el encabezado y las filas de datos.
  if (reporte.filas.length > 0) {
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: ultima, column: COLS } };
  }

  // Fila en blanco y fila TOTALES (SUBTOTAL 109 = suma ignorando filas filtradas).
  const filaTotales = Math.max(ultima, 2) + 2;
  const totales = ws.getRow(filaTotales);
  totales.getCell(1).value = "TOTALS";
  // Valor de compra/venta son precios unitarios: el total es Σ(cantidad × precio)
  // solo de filas visibles, con SUMPRODUCT + SUBTOTAL(103) como máscara de visibilidad.
  const hay = reporte.filas.length > 0;
  const rng = (col: string) => `${col}${primera}:${col}${ultima}`;
  const visibles = `SUBTOTAL(103,OFFSET(D${primera},ROW(${rng("D")})-ROW(D${primera}),0))`;
  totales.getCell(4).value = hay
    ? { formula: `SUBTOTAL(109,${rng("D")})`, result: reporte.totales.unidadesVendidas }
    : reporte.totales.unidadesVendidas;
  totales.getCell(5).value = hay
    ? { formula: `SUMPRODUCT(${visibles},${rng("D")},${rng("E")})`, result: reporte.totales.costosCompra }
    : reporte.totales.costosCompra;
  totales.getCell(6).value = hay
    ? { formula: `SUMPRODUCT(${visibles},${rng("D")},${rng("F")})`, result: reporte.totales.ventas }
    : reporte.totales.ventas;
  totales.getCell(7).value = hay
    ? { formula: `SUBTOTAL(109,${rng("G")})`, result: reporte.totales.gananciaTotal }
    : reporte.totales.gananciaTotal;
  totales.getCell(4).numFmt = "#,##0";
  for (const col of [5, 6, 7]) totales.getCell(col).numFmt = FORMATO_PESOS;
  for (let col = 1; col <= COLS; col++) {
    const c = totales.getCell(col);
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3ECE8" } };
    c.border = borde;
  }
  ws.mergeCells(filaTotales, 1, filaTotales, 3);
  totales.getCell(1).alignment = { horizontal: "center" };

  const nota = ws.getCell(filaTotales + 2, 1);
  nota.value = "Use the header arrows to filter; the TOTALS row is recalculated with the visible rows.";
  nota.font = { italic: true, color: { argb: "FF5B6B64" }, size: 9 };

  [12, 14, 32, 18, 18, 18, 16, 22].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
