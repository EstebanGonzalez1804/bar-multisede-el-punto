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
      .catch((err) => activo && setError(getApiErrorMessage(err, "No se pudo cargar la cuenta.")))
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
      await pedidosApi.descargarCuentaPdf(pedido.idPedido, `cuenta-${pedido.identificadorPedido}.pdf`);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo descargar la cuenta."));
    } finally {
      setDescargando(false);
    }
  }

  if (cargando) {
    return (
      <div className="panel">
        <p className="empty-state">Cargando...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="panel">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Link to="/pedidos" className="btn-secondary">
          Volver a Pedidos
        </Link>
      </div>
    );
  }

  const cerrado = pedido.estadoPedido === "CERRADO";

  return (
    <div className="panel">
      <div className="panel-header no-print">
        <div>
          <h1 className="page-title">Cuenta · {pedido.identificadorMesa}</h1>
          <p className="page-sub">
            Pedido {pedido.identificadorPedido} · {pedido.nombreSede}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>

      {error && <Aviso tipo="error" className="no-print">{error}</Aviso>}

      {!cerrado ? (
        <Aviso tipo="info" className="no-print">
          El pedido sigue abierto. La cuenta se genera cuando el mesero lo cierra.
        </Aviso>
      ) : (
        <>
          <div className="form-actions no-print" style={{ marginBottom: "1rem" }}>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Imprimir tirilla
            </button>
            <button type="button" className="btn-secondary" disabled={descargando} onClick={() => void handleDescargar()}>
              {descargando ? "Descargando..." : "Descargar PDF"}
            </button>
            {puedeCobrar && pedido.estadoPago !== "PAGADO" && (
              <Link to={`/cobro/${pedido.idPedido}`} className="btn-primary">
                Cobrar
              </Link>
            )}
          </div>

          <div className="ticket-wrap">
            <div className="ticket">
              <div className="ticket-title">EL PUNTO</div>
              <div className="ticket-center">{pedido.nombreSede}</div>
              <div className="ticket-center ticket-strong">CUENTA DE CONSUMO</div>
              <div className="ticket-center ticket-small">Documento interno · no es factura electrónica</div>
              <hr />
              <div>Pedido: {pedido.identificadorPedido}</div>
              <div>Mesa: {pedido.identificadorMesa}</div>
              <div>Atendió: {pedido.nombreMesero}</div>
              <div>Apertura: {fechaHoraCompleta(pedido.fechaApertura)}</div>
              {pedido.fechaCierre && <div>Cierre: {fechaHoraCompleta(pedido.fechaCierre)}</div>}
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
                  <div className="ticket-strong">Pagos registrados</div>
                  {pedido.pagos.map((p) => (
                    <div key={p.idPago}>
                      {ETIQUETAS_METODO[p.metodo]}: {pesos(p.valor)}
                    </div>
                  ))}
                  <div className="ticket-strong">Saldo pendiente: {pesos(pedido.saldoPendiente)}</div>
                </>
              )}
              <hr />
              <div className="ticket-center">¡Gracias por visitarnos!</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
