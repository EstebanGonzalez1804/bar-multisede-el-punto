import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import * as reportesApi from "../api/reportes";
import * as sedesApi from "../api/sedes";
import type { ReporteVentas, Sede } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { fecha, hoyBogota, inicioDeMesBogota, pesos } from "../utils/format";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { Aviso } from "../components/Aviso";

/**
 * HU-039 — Reporte de ventas y ganancias por rango de fechas, con totales y
 * exportación únicamente a Excel (.xlsx). Administrador: todas las sedes (o
 * una elegida); Cajero: solo su sede; Mesero: sin acceso (ver App.tsx).
 * El reporte se genera solo al entrar (mes en curso) y al cambiar el rango.
 */
export function ReportesPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [desde, setDesde] = useState(inicioDeMesBogota());
  const [hasta, setHasta] = useState(hoyBogota());
  const [idSede, setIdSede] = useState("");
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [generando, setGenerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
  }, [esAdministrador]);

  const validar = useCallback((): boolean => {
    if (!desde || !hasta) {
      setError("Select the date range.");
      return false;
    }
    if (desde > hasta) {
      setError("The start date cannot be later than the end date.");
      return false;
    }
    return true;
  }, [desde, hasta]);

  const generar = useCallback(async () => {
    setError(null);
    if (!validar()) return;
    setGenerando(true);
    try {
      setReporte(await reportesApi.generarReporteVentas(desde, hasta, idSede ? Number(idSede) : undefined));
    } catch (err) {
      setError(getApiErrorMessage(err, "The report could not be generated."));
    } finally {
      setGenerando(false);
    }
  }, [desde, hasta, idSede, validar]);

  useCargaConFiltros(generar, 500);

  async function handleExportar() {
    setError(null);
    if (!validar()) return;
    setExportando(true);
    try {
      await reportesApi.exportarReporteVentas(desde, hasta, idSede ? Number(idSede) : undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, "The report could not be exported."));
    } finally {
      setExportando(false);
    }
  }

  const mostrarSede = esAdministrador && !idSede;

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Sales and profit report</h1>
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="desde">From</label>
          <input id="desde" type="date" max={hasta || undefined} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hasta">To</label>
          <input id="hasta" type="date" max={hoyBogota()} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="sedeReporte">Location</label>
            <select id="sedeReporte" value={idSede} onChange={(e) => setIdSede(e.target.value)}>
              <option value="">All locations</option>
              {sedes.map((s) => (
                <option key={s.idSede} value={s.idSede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={exportando || !reporte || reporte.filas.length === 0}
          onClick={() => void handleExportar()}
        >
          {exportando ? "Exporting..." : "Export to Excel"}
        </button>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {generando && !reporte && <p className="empty-state">Generating report...</p>}

      {reporte && (
        <>
          <p className="field-hint nota-lista">
            Sales from fully paid bills, using the cost and price in effect when each item was ordered.
            Profit = (price − cost) × quantity.
          </p>
          {reporte.filas.length === 0 ? (
            <p className="empty-state">There are no sales in the selected period.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Code</th>
                    <th className="num">Quantity</th>
                    <th className="num">Unit cost</th>
                    <th className="num">Unit price</th>
                    <th className="num">Profit</th>
                    {mostrarSede && <th>Location</th>}
                  </tr>
                </thead>
                <tbody>
                  {reporte.filas.map((f, i) => (
                    <tr key={i}>
                      <td>{fecha(f.fecha)}</td>
                      <td className="celda-titulo">{f.nombreProducto}</td>
                      <td className="texto-suave">{f.codigoProducto}</td>
                      <td className="num">{f.cantidadVendida}</td>
                      <td className="num">{pesos(f.valorCompra)}</td>
                      <td className="num">{pesos(f.valorVenta)}</td>
                      <td className="num">{pesos(f.ganancia)}</td>
                      {mostrarSede && <td>{f.nombreSede}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fila-totales">
                    <td colSpan={3}>Period totals</td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Units</span>
                      {reporte.totales.unidadesVendidas}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Total cost</span>
                      {pesos(reporte.totales.costosCompra)}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Total sales</span>
                      {pesos(reporte.totales.ventas)}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Profit</span>
                      {pesos(reporte.totales.gananciaTotal)}
                    </td>
                    {mostrarSede && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
