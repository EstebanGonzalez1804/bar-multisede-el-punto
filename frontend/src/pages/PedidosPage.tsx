import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import * as sedesApi from "../api/sedes";
import type { ResumenPedido, Sede } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { etiquetaEstadoPago, fechaHora, pesos } from "../utils/format";

/**
 * HU-030 — Consulta de pedidos por rol y sede. Mesero y Cajero ven solo los de
 * su sede (lo garantiza el backend); el Administrador ve todas y puede filtrar
 * por sede. Muestra mesa, estado del pedido y estado de pago, con filtros por
 * estado o por mesa/número de pedido.
 */
export function PedidosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";
  const puedeCobrar = usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO";

  const [pedidos, setPedidos] = useState<ResumenPedido[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState("");
  const [filtroEstadoPago, setFiltroEstadoPago] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroSede, setFiltroSede] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await pedidosApi.listarPedidos({
        estadoPedido: filtroEstadoPedido || undefined,
        estadoPago: filtroEstadoPago || undefined,
        busqueda: filtroBusqueda.trim() || undefined,
        idSede: filtroSede ? Number(filtroSede) : undefined,
      });
      setPedidos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los pedidos."));
    } finally {
      setCargando(false);
    }
  }, [filtroEstadoPedido, filtroEstadoPago, filtroBusqueda, filtroSede]);

  useEffect(() => {
    void cargar();
    // Solo al montar: los filtros se aplican con el botón Filtrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
  }, [esAdministrador]);

  function handleFiltrar(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Pedidos</h2>
      </div>

      <form className="inline-form" onSubmit={handleFiltrar} style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="busquedaPedido">Mesa o n.º de pedido</label>
          <input
            id="busquedaPedido"
            type="text"
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            placeholder="Mesa 3 o SE01-12"
          />
        </div>
        <div className="field">
          <label htmlFor="estadoPedido">Estado del pedido</label>
          <select id="estadoPedido" value={filtroEstadoPedido} onChange={(e) => setFiltroEstadoPedido(e.target.value)}>
            <option value="">Todos</option>
            <option value="ABIERTO">Abierto</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="estadoPago">Estado de pago</label>
          <select id="estadoPago" value={filtroEstadoPago} onChange={(e) => setFiltroEstadoPago(e.target.value)}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="sedePedido">Sede</label>
            <select id="sedePedido" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="">Todas</option>
              {sedes.map((s) => (
                <option key={s.idSede} value={s.idSede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">No hay pedidos que coincidan con la búsqueda.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Mesa</th>
                {esAdministrador && <th>Sede</th>}
                <th>Estado del pedido</th>
                <th>Estado de pago</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Apertura</th>
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
                    <span className={`badge ${p.estadoPedido === "ABIERTO" ? "badge-success" : "badge-muted"}`}>
                      {p.estadoPedido === "ABIERTO" ? "Abierto" : "Cerrado"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.estadoPago === "PAGADO" ? "badge-success" : "badge-warning"}`}>
                      {etiquetaEstadoPago(p.estadoPago)}
                    </span>
                  </td>
                  <td>{pesos(p.total)}</td>
                  <td>{p.estadoPedido === "CERRADO" ? pesos(p.saldoPendiente) : "—"}</td>
                  <td>{fechaHora(p.fechaApertura)}</td>
                  <td>
                    <div className="table-actions">
                      {p.estadoPedido === "CERRADO" && (
                        <Link className="btn-link" to={`/cuenta/${p.idPedido}`}>
                          Ver cuenta
                        </Link>
                      )}
                      {puedeCobrar && p.estadoPedido === "CERRADO" && p.estadoPago !== "PAGADO" && (
                        <Link className="btn-link" to={`/cobro/${p.idPedido}`}>
                          Cobrar
                        </Link>
                      )}
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
