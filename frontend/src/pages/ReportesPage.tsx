import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as reportesApi from "../api/reportes";
import * as sedesApi from "../api/sedes";
import type { ReporteVentas, Sede } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { pesos } from "../utils/format";

function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function primerDiaMes(): string {
  return `${hoyColombia().slice(0, 8)}01`;
}

/**
 * HU-039 — Reporte de ventas y ganancias por rango de fechas, con totales y
 * exportación únicamente a Excel (.xlsx). Administrador: todas las sedes (o
 * una elegida); Cajero: solo su sede; Mesero: sin acceso (ver App.tsx).
 */
export function ReportesPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoyColombia());
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

  function validar(): boolean {
    if (!desde || !hasta) {
      setError("Selecciona el rango de fechas.");
      return false;
    }
    if (desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la final.");
      return false;
    }
    return true;
  }

  async function handleGenerar(e: FormEvent) {
    e.preventDefault();
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
  }

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

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Reporte de ventas y ganancias</h2>
      </div>

      <form className="inline-form" onSubmit={handleGenerar} style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
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
        <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={generando}>
          {generando ? "Generando..." : "Generar reporte"}
        </button>
        <button type="button" className="btn-secondary" disabled={exportando} onClick={() => void handleExportar()}>
          {exportando ? "Exportando..." : "Exportar a Excel"}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {reporte && (
        <>
          <p className="field-hint">
            Ventas de pedidos pagados por completo, con los valores de compra y venta vigentes cuando se registró cada
            consumo. Ganancia = (valor de venta − valor de compra) × cantidad.
          </p>
          {reporte.filas.length === 0 ? (
            <p className="empty-state">No hay ventas en el periodo seleccionado.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Valor de compra</th>
                    <th>Valor de venta</th>
                    <th>Ganancia</th>
                    <th>Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.filas.map((f, i) => (
                    <tr key={i}>
                      <td>{f.fecha}</td>
                      <td>{f.codigoProducto}</td>
                      <td>{f.nombreProducto}</td>
                      <td>{f.cantidadVendida}</td>
                      <td>{pesos(f.valorCompra)}</td>
                      <td>{pesos(f.valorVenta)}</td>
                      <td>{pesos(f.ganancia)}</td>
                      <td>{f.nombreSede}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>
                      Totales del periodo
                    </td>
                    <td style={{ fontWeight: 700 }}>{reporte.totales.unidadesVendidas}</td>
                    <td style={{ fontWeight: 700 }}>{pesos(reporte.totales.costosCompra)}</td>
                    <td style={{ fontWeight: 700 }}>{pesos(reporte.totales.ventas)}</td>
                    <td style={{ fontWeight: 700 }}>{pesos(reporte.totales.gananciaTotal)}</td>
                    <td />
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
