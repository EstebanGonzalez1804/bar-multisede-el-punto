import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import { ETIQUETAS_METODO, type Pedido } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { fechaHoraCompleta, pesos } from "../utils/format";
import { agruparLineas } from "../utils/lineas";
import { Aviso } from "../components/Aviso";

/**
 * HU-031 — Vista previa de la cuenta con el ancho de una tirilla de 80 mm,
 * con botones para imprimir (el CSS de impresión deja solo la tirilla, en
 * 80 mm) y descargar en PDF. Es un documento interno: se rotula como "no es
 * factura electrónica" (CA-05).
 */
export function CuentaPage() {
  const { idPedido } = useParams<{ idPedido: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const puedeCobrar = usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO";

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    let activo = true;
    pedidosApi
      .obtenerPedido(Number(idPedido))
      .then((p) => activo && setPedido(p))
      .catch((err) => activo && setError(getApiErrorMessage(err, "The bill could not be loaded.")))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [idPedido]);

  async function handleDescargar() {
    if (!pedido) return;
    setError(null);
    setDescargando(true);
    try {
      await pedidosApi.descargarCuentaPdf(pedido.idPedido, `bill-${pedido.identificadorPedido}.pdf`);
    } catch (err) {
      setError(getApiErrorMessage(err, "The bill could not be downloaded."));
    } finally {
      setDescargando(false);
    }
  }

  if (cargando) {
    return (
      <div className="panel">
        <p className="empty-state">Loading...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="panel">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Link to="/pedidos" className="btn-secondary">
          Back to Orders
        </Link>
      </div>
    );
  }

  const cerrado = pedido.estadoPedido === "CERRADO";

  return (
    <div className="panel">
      <div className="panel-header no-print">
        <div>
          <h1 className="page-title">Bill · {pedido.identificadorMesa}</h1>
          <p className="page-sub">
            Order {pedido.identificadorPedido} · {pedido.nombreSede}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {error && <Aviso tipo="error" className="no-print">{error}</Aviso>}

      {!cerrado ? (
        <Aviso tipo="info" className="no-print">
          The order is still open. The bill is generated when the waiter closes it.
        </Aviso>
      ) : (
        <>
          <div className="form-actions no-print" style={{ marginBottom: "1rem" }}>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Print receipt
            </button>
            <button type="button" className="btn-secondary" disabled={descargando} onClick={() => void handleDescargar()}>
              {descargando ? "Downloading..." : "Download PDF"}
            </button>
            {puedeCobrar && pedido.estadoPago !== "PAGADO" && (
              <Link to={`/cobro/${pedido.idPedido}`} className="btn-primary">
                Charge
              </Link>
            )}
          </div>

          <div className="ticket-wrap">
            <div className="ticket">
              <div className="ticket-title">EL PUNTO</div>
              <div className="ticket-center">{pedido.nombreSede}</div>
              <div className="ticket-center ticket-strong">CONSUMPTION BILL</div>
              <div className="ticket-center ticket-small">Internal document · not an electronic invoice</div>
              <hr />
              <div>Order: {pedido.identificadorPedido}</div>
              <div>Table: {pedido.identificadorMesa}</div>
              <div>Served by: {pedido.nombreMesero}</div>
              <div>Opened: {fechaHoraCompleta(pedido.fechaApertura)}</div>
              {pedido.fechaCierre && <div>Closed: {fechaHoraCompleta(pedido.fechaCierre)}</div>}
              <hr />
              {agruparLineas(pedido.lineas).map((g) => (
                <div key={g.clave} className="ticket-line">
                  <div className="ticket-strong">{g.nombreProducto}</div>
                  <div className="ticket-right">
                    {g.cantidad} x {pesos(g.precioVenta)} = {pesos(g.subtotal)}
                  </div>
                </div>
              ))}
              <hr />
              <div className="ticket-right ticket-total">TOTAL: {pesos(pedido.total)}</div>
              {pedido.pagos.length > 0 && (
                <>
                  <hr />
                  <div className="ticket-strong">Recorded payments</div>
                  {pedido.pagos.map((p) => (
                    <div key={p.idPago}>
                      {ETIQUETAS_METODO[p.metodo]}: {pesos(p.valor)}
                    </div>
                  ))}
                  <div className="ticket-strong">Pending balance: {pesos(pedido.saldoPendiente)}</div>
                </>
              )}
              <hr />
              <div className="ticket-center">Thank you for visiting!</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
