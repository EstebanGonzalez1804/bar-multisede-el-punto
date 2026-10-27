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
      setError("Selecciona el rango de fechas.");
      return false;
    }
    if (desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la final.");
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
      setError(getApiErrorMessage(err, "No se pudo generar el reporte."));
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
      setError(getApiErrorMessage(err, "No se pudo exportar el reporte."));
    } finally {
      setExportando(false);
    }
  }

  const mostrarSede = esAdministrador && !idSede;

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Reporte de ventas y ganancias</h1>
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" max={hasta || undefined} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" max={hoyBogota()} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="sedeReporte">Sede</label>
            <select id="sedeReporte" value={idSede} onChange={(e) => setIdSede(e.target.value)}>
              <option value="">Todas las sedes</option>
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
          {exportando ? "Exportando..." : "Exportar a Excel"}
        </button>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {generando && !reporte && <p className="empty-state">Generando reporte...</p>}

      {reporte && (
        <>
          <p className="field-hint nota-lista">
            Ventas de cuentas pagadas por completo, con el costo y el precio vigentes cuando se registró cada consumo.
            Ganancia = (precio − costo) × cantidad.
          </p>
          {reporte.filas.length === 0 ? (
            <p className="empty-state">No hay ventas en el periodo seleccionado.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Código</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Costo unitario</th>
                    <th className="num">Precio unitario</th>
                    <th className="num">Ganancia</th>
                    {mostrarSede && <th>Sede</th>}
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
                    <td colSpan={3}>Totales del periodo</td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Unidades</span>
                      {reporte.totales.unidadesVendidas}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Costo total</span>
                      {pesos(reporte.totales.costosCompra)}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Venta total</span>
                      {pesos(reporte.totales.ventas)}
                    </td>
                    <td className="num">
                      <span className="tfoot-etiqueta">Ganancia</span>
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
