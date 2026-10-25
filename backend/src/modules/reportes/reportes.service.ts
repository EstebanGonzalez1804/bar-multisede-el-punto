import ExcelJS from "exceljs";
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

/** HU-039 CA-07 — Exportación únicamente en Microsoft Excel (.xlsx). */
export async function generarExcelVentas(reporte: ReporteVentas): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "El Punto";
  const ws = wb.addWorksheet("Ventas y ganancias");

  ws.addRow([`Reporte de ventas y ganancias · ${reporte.desde} a ${reporte.hasta}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const encabezado = ws.addRow([
    "Fecha",
    "Código",
    "Producto",
    "Cantidad vendida",
    "Valor de compra",
    "Valor de venta",
    "Ganancia",
    "Sede",
  ]);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173A33" } };
  });

  for (const f of reporte.filas) {
    ws.addRow([
      f.fecha,
      f.codigoProducto,
      f.nombreProducto,
      f.cantidadVendida,
      f.valorCompra,
      f.valorVenta,
      f.ganancia,
      f.nombreSede,
    ]);
  }

  ws.addRow([]);
  const totales = ws.addRow([
    "TOTALES",
    "",
    "",
    reporte.totales.unidadesVendidas,
    reporte.totales.costosCompra,
    reporte.totales.ventas,
    reporte.totales.gananciaTotal,
    "",
  ]);
  totales.font = { bold: true };

  ws.columns = [
    { width: 12 },
    { width: 14 },
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 22 },
  ];
  for (const col of [5, 6, 7]) {
    ws.getColumn(col).numFmt = '"$"#,##0';
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
