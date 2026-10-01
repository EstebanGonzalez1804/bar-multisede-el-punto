import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as inventarioApi from "../api/inventario";
import * as pedidosApi from "../api/pedidos";
import type { ItemInventario, Pedido } from "../api/types";

/**
 * HU-025 (apertura, ya resuelta por MesasPage antes de llegar aquí) +
 * HU-026 (registro de productos) + HU-023 (bloqueo de agotados).
 *
 * Solo Mesero (ver pedidos.routes.ts). Las líneas ya registradas NUNCA se
 * editan ni se eliminan desde aquí (CA-05 HU-026): esta pantalla solo tiene
 * un formulario para AGREGAR, nunca un botón de editar/quitar sobre una
 * línea existente.
 */
export function PedidoPage() {
  const { idMesa } = useParams<{ idMesa: string }>();
  const idMesaNum = Number(idMesa);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [idProductoNuevo, setIdProductoNuevo] = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("1");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const pedidoActual = await pedidosApi.obtenerPedidoAbiertoPorMesa(idMesaNum);
      setPedido(pedidoActual);
      if (pedidoActual) {
        const inv = await inventarioApi.listarInventario(pedidoActual.idSede);
        setInventario(inv);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cargar el pedido."));
    } finally {
      setCargando(false);
    }
  }, [idMesaNum]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function handleAgregarProducto(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!pedido) return;
    const cantidad = Number(cantidadNueva);
    if (!idProductoNuevo) {
      setError("Selecciona un producto.");
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setError("La cantidad debe ser un entero mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      const pedidoActualizado = await pedidosApi.registrarProductoEnPedido(
        pedido.idPedido,
        Number(idProductoNuevo),
        cantidad
      );
      setPedido(pedidoActualizado);
      setMensaje("Producto registrado en el pedido.");
      setIdProductoNuevo("");
      setCantidadNueva("1");
      // El inventario cambió (HU-026): se refresca para reflejar la nueva
      // disponibilidad y, si corresponde, marcar el producto como agotado.
      const inv = await inventarioApi.listarInventario(pedido.idSede);
      setInventario(inv);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo registrar el producto."));
    } finally {
      setGuardando(false);
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
        {error && <div className="alert alert-error">{error}</div>}
        <p className="empty-state">
          Esta mesa está libre: no hay un pedido abierto. <Link to="/mesas">Volver a Mesas</Link>
        </p>
      </div>
    );
  }

  const totalPedido = pedido.lineas.reduce(
    (acc, l) => acc + Number(l.precioVentaCongelado) * l.cantidad,
    0
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>
            Pedido {pedido.identificadorPedido} · Mesa {pedido.identificadorMesa}
          </h2>
          <Link to="/mesas" className="btn-secondary">
            Volver a Mesas
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        <form className="row-subform" onSubmit={handleAgregarProducto}>
          <h3 style={{ marginTop: 0 }}>Agregar producto</h3>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="productoPedido">Producto</label>
              <select
                id="productoPedido"
                value={idProductoNuevo}
                onChange={(e) => setIdProductoNuevo(e.target.value)}
              >
                <option value="">Selecciona un producto</option>
                {inventario.map((item) => {
                  const noDisponible = item.estadoProducto !== "ACTIVO" || item.cantidadDisponible === 0;
                  return (
                    <option key={item.idProducto} value={item.idProducto} disabled={noDisponible}>
                      {item.codigoProducto} — {item.nombreProducto}
                      {noDisponible
                        ? item.estadoProducto !== "ACTIVO"
                          ? " (inactivo)"
                          : " (agotado)"
                        : ` (disponibles: ${item.cantidadDisponible})`}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="cantidadPedido">Cantidad</label>
              <input
                id="cantidadPedido"
                type="number"
                min={1}
                step={1}
                value={cantidadNueva}
                onChange={(e) => setCantidadNueva(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
              {guardando ? "Agregando..." : "Agregar al pedido"}
            </button>
          </div>
        </form>

        <h3>Productos del pedido</h3>
        {pedido.lineas.length === 0 ? (
          <p className="empty-state">Aún no se ha registrado ningún producto en este pedido.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pedido.lineas.map((l) => (
                <tr key={l.idDetallePedido}>
                  <td>
                    {l.codigoProducto} — {l.nombreProducto}
                  </td>
                  <td>{l.cantidad}</td>
                  <td>${Number(l.precioVentaCongelado).toLocaleString("es-CO")}</td>
                  <td>${(Number(l.precioVentaCongelado) * l.cantidad).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>
                  Total
                </td>
                <td style={{ fontWeight: 600 }}>${totalPedido.toLocaleString("es-CO")}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
