import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import type { ResumenPedido } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useAuth } from "../context/AuthContext";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { etiquetaEstadoPago, fechaHora, pesos } from "../utils/format";

/** Igual que Mesas: la lista de cuentas por cobrar se refresca sola. */
const INTERVALO_REFRESCO_MS = 10000;

/**
 * HU-032 — Cuentas pendientes de pago. El Cajero solo ve las de su sede (lo
 * garantiza el backend). Las pagadas por completo no aparecen; los pagos
 * parciales sí, con el saldo restante. Se actualiza sola para que una cuenta
 * recién cerrada por el mesero aparezca sin recargar.
 */
export function CobrosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [pedidos, setPedidos] = useState<ResumenPedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      try {
        setPedidos(await pedidosApi.listarPedidosPendientesPago(busqueda.trim() || undefined));
        setError(null);
      } catch (err) {
        if (!silencioso) setError(getApiErrorMessage(err, "Unpaid bills could not be loaded."));
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [busqueda]
  );

  useCargaConFiltros(cargar);

  useEffect(() => {
    const intervalo = setInterval(() => void cargar(true), INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Unpaid bills</h1>
        <div className="live-indicator">
          <span className="live-dot" />
          <span>Live · updates automatically</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="field field-busqueda">
          <label htmlFor="busquedaCobro">Search</label>
          <input
            id="busquedaCobro"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Order no. or table, e.g. Mesa 3"
          />
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {cargando ? (
        <p className="empty-state">Loading...</p>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">
          {busqueda.trim() ? "No bill matches the search." : "There are no bills pending payment."}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="tabla-apilada">
            <thead>
              <tr>
                <th>Table</th>
                <th>Order</th>
                {esAdministrador && <th>Location</th>}
                <th>Status</th>
                <th>Opened</th>
                <th className="num">Total</th>
                <th className="num">Balance</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.idPedido}>
                  <td data-label="Table" className="celda-titulo">
                    {p.identificadorMesa}
                  </td>
                  <td data-label="Order">{p.identificadorPedido}</td>
                  {esAdministrador && <td data-label="Location">{p.nombreSede}</td>}
                  <td data-label="Status">
                    <span className="badge badge-warning">{etiquetaEstadoPago(p.estadoPago)}</span>
                  </td>
                  <td data-label="Opened">{fechaHora(p.fechaApertura)}</td>
                  <td data-label="Total" className="num">
                    {pesos(p.total)}
                  </td>
                  <td data-label="Balance" className="num">
                    <strong>{pesos(p.saldoPendiente)}</strong>
                  </td>
                  <td data-label="" className="celda-acciones">
                    <div className="table-actions">
                      <Link className="btn-link" to={`/cuenta/${p.idPedido}`}>
                        View bill
                      </Link>
                      <Link className="btn-primary btn-compacto" to={`/cobro/${p.idPedido}`}>
                        Charge
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
