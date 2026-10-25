import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import type { ResumenPedido } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { etiquetaEstadoPago, pesos } from "../utils/format";

/**
 * HU-032 — Pedidos pendientes de pago. El Cajero solo ve los de su sede (lo
 * garantiza el backend). Los pagados por completo no aparecen; los pagos
 * parciales sí, con el saldo restante.
 */
export function CobrosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [pedidos, setPedidos] = useState<ResumenPedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPedidos(await pedidosApi.listarPedidosPendientesPago(busqueda.trim() || undefined));
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los pedidos pendientes de pago."));
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    void cargar();
    // Solo al montar; el buscador se aplica con el botón Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBuscar(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Cobros pendientes</h2>
      </div>

      <form className="inline-form" onSubmit={handleBuscar} style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="busquedaCobro">Buscar por n.º de pedido o mesa</label>
          <input
            id="busquedaCobro"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="SE01-12 o Mesa 3"
          />
        </div>
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">No hay cuentas pendientes de pago.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Mesa</th>
                {esAdministrador && <th>Sede</th>}
                <th>Estado de pago</th>
                <th>Total</th>
                <th>Saldo pendiente</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.idPedido}>
                  <td>{p.identificadorPedido}</td>
                  <td>{p.identificadorMesa}</td>
                  {esAdministrador && <td>{p.nombreSede}</td>}
                  <td>
                    <span className="badge badge-warning">{etiquetaEstadoPago(p.estadoPago)}</span>
                  </td>
                  <td>{pesos(p.total)}</td>
                  <td>
                    <strong>{pesos(p.saldoPendiente)}</strong>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link className="btn-link" to={`/cuenta/${p.idPedido}`}>
                        Ver cuenta
                      </Link>
                      <Link className="btn-link" to={`/cobro/${p.idPedido}`}>
                        Cobrar
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
