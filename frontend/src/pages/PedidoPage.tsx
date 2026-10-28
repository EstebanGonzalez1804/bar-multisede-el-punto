import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as inventarioApi from "../api/inventario";
import * as pedidosApi from "../api/pedidos";
import * as productosApi from "../api/productos";
import type { ItemInventario, Pedido } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { agruparLineas } from "../utils/lineas";
import { hora, pesos } from "../utils/format";

/**
 * HU-025 a HU-028 — Pedido de una mesa (solo Mesero).
 *
 * - HU-026: agregar productos con un buscador y filtro por tipo (antes era una
 *   lista desplegable con todo el catálogo). Los agotados se ven pero no se
 *   pueden elegir (HU-023); los inactivos no aparecen.
 * - CA-05 HU-026: las líneas registradas NUNCA se editan ni se eliminan: aquí
 *   solo se agrega. En pantalla, las líneas del mismo producto al mismo precio
 *   se muestran juntas ("5 × Club Colombia") aunque se hayan pedido en tandas.
 * - HU-028: cierre con confirmación; la mesa sigue ocupada hasta el pago.
 */
export function PedidoPage() {
  const { idMesa } = useParams<{ idMesa: string }>();
  const idMesaNum = Number(idMesa);
  const confirmar = useConfirmar();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [idSeleccionado, setIdSeleccionado] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const cargarInventario = useCallback(async (idSede: number) => {
    const [inv, productos] = await Promise.all([
      inventarioApi.listarInventario(idSede),
      productosApi.listarProductos({ estado: "ACTIVO" }),
    ]);
    setInventario(inv);
    setPrecios(Object.fromEntries(productos.map((p) => [p.idProducto, p.valorVenta])));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const pedidoActual = await pedidosApi.obtenerPedidoAbiertoPorMesa(idMesaNum);
      setPedido(pedidoActual);
      if (pedidoActual) await cargarInventario(pedidoActual.idSede);
    } catch (err) {
      setError(getApiErrorMessage(err, "The order could not be loaded."));
    } finally {
      setCargando(false);
    }
  }, [idMesaNum, cargarInventario]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Solo productos activos; los agotados se listan al final, deshabilitados.
  const disponibles = useMemo(
    () =>
      inventario
        .filter((i) => i.estadoProducto === "ACTIVO")
        .sort((a, b) => {
          const agotadoA = a.cantidadDisponible === 0 ? 1 : 0;
          const agotadoB = b.cantidadDisponible === 0 ? 1 : 0;
          return agotadoA - agotadoB || a.nombreProducto.localeCompare(b.nombreProducto, "es");
        }),
    [inventario]
  );

  const tipos = useMemo(
    () => Array.from(new Set<string>(disponibles.map((i) => i.nombreTipoProducto))).sort((a, b) => a.localeCompare(b, "es")),
    [disponibles]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return disponibles.filter(
      (i) =>
        (!tipo || i.nombreTipoProducto === tipo) &&
        (!q || i.nombreProducto.toLowerCase().includes(q) || i.codigoProducto.toLowerCase().includes(q))
    );
  }, [disponibles, busqueda, tipo]);

  const seleccionado = disponibles.find((i) => i.idProducto === idSeleccionado) ?? null;

  function elegir(item: ItemInventario) {
    if (item.cantidadDisponible === 0) return;
    setIdSeleccionado(item.idProducto);
    setCantidad(1);
    setError(null);
  }

  async function handleAgregar() {
    if (!pedido || !seleccionado) return;
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      const actualizado = await pedidosApi.registrarProductoEnPedido(pedido.idPedido, seleccionado.idProducto, cantidad);
      setPedido(actualizado);
      setMensaje(`Added: ${cantidad} × ${seleccionado.nombreProducto}.`);
      setIdSeleccionado(null);
      setCantidad(1);
      // El inventario cambió (HU-026): se refresca la disponibilidad.
      await cargarInventario(pedido.idSede);
    } catch (err) {
      setError(getApiErrorMessage(err, "The product could not be added."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleCerrarPedido() {
    if (!pedido) return;
    const ok = await confirmar({
      titulo: `Close the order for ${pedido.identificadorMesa}?`,
      mensaje: (
        <>
          The bill is generated for <strong>{pesos(pedido.total)}</strong> and no more products can be added. The
          table stays occupied until it is paid.
        </>
      ),
      textoConfirmar: "Close and generate bill",
    });
    if (!ok) return;
    setError(null);
    setMensaje(null);
    setProcesando(true);
    try {
      const actualizado = await pedidosApi.cerrarPedido(pedido.idPedido);
      setPedido(actualizado);
      setMensaje("Order closed. The bill is ready to be charged at the register.");
    } catch (err) {
      setError(getApiErrorMessage(err, "The order could not be closed."));
    } finally {
      setProcesando(false);
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
        <p className="empty-state">This table is free: there is no open order.</p>
        <Link to="/mesas" className="btn-secondary">
          Back to Tables
        </Link>
      </div>
    );
  }

  const abierto = pedido.estadoPedido === "ABIERTO";
  const grupos = agruparLineas(pedido.lineas);
  const maxCantidad = seleccionado?.cantidadDisponible ?? 1;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {pedido.identificadorMesa}{" "}
            <span className={`badge ${abierto ? "badge-success" : "badge-muted"}`}>{abierto ? "Open" : "Closed"}</span>
          </h1>
          <p className="page-sub">
            Order {pedido.identificadorPedido} · since {hora(pedido.fechaApertura)} · {pedido.nombreMesero}
          </p>
        </div>
        <Link to="/mesas" className="btn-secondary">
          Back to Tables
        </Link>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

      {!abierto && (
        <Aviso tipo="info">
          {pedido.estadoPago === "PARCIAL"
            ? `The bill already has payments and a pending balance of ${pesos(pedido.saldoPendiente)}. It cannot be modified.`
            : "The bill is closed and pending payment. A closed order is not reopened: if the customer asks for something else, this bill is charged and a new one is opened for the table."}
        </Aviso>
      )}

      <div className={abierto ? "pedido-layout" : ""}>
        {abierto && (
          <section className="panel" aria-labelledby="titulo-agregar">
            <h2 id="titulo-agregar" className="panel-title">
              Add product
            </h2>

            <div className="field">
              <label htmlFor="buscarProducto">Search</label>
              <input
                id="buscarProducto"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Name or code, e.g. Club"
                autoComplete="off"
              />
            </div>

            {tipos.length > 1 && (
              <div className="chips" role="group" aria-label="Filter by product type">
                <button type="button" className={`chip${tipo === "" ? " activo" : ""}`} aria-pressed={tipo === ""} onClick={() => setTipo("")}>
                  All
                </button>
                {tipos.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`chip${tipo === t ? " activo" : ""}`}
                    aria-pressed={tipo === t}
                    onClick={() => setTipo(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {filtrados.length === 0 ? (
              <p className="empty-state">No product matches the search.</p>
            ) : (
              <ul className="picker-lista">
                {filtrados.map((item) => {
                  const agotado = item.cantidadDisponible === 0;
                  const activo = item.idProducto === idSeleccionado;
                  return (
                    <li key={item.idProducto}>
                      <button
                        type="button"
                        className={`picker-item${activo ? " activo" : ""}`}
                        disabled={agotado}
                        aria-pressed={activo}
                        onClick={() => elegir(item)}
                      >
                        <span className="picker-nombre">{item.nombreProducto}</span>
                        <span className="picker-meta">
                          {precios[item.idProducto] ? pesos(precios[item.idProducto]) : ""}
                          {agotado ? " · Out of stock" : ` · ${item.cantidadDisponible} available`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={`picker-barra${seleccionado ? " visible" : ""}`}>
              {seleccionado ? (
                <>
                  <div className="picker-barra-producto">
                    <strong>{seleccionado.nombreProducto}</strong>
                    <span className="picker-meta">Maximum {maxCantidad} available</span>
                  </div>
                  <div className="cantidad-selector" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="One unit less"
                      disabled={cantidad <= 1}
                      onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxCantidad}
                      aria-label="Quantity"
                      value={cantidad}
                      onChange={(e) => setCantidad(Math.max(1, Math.min(maxCantidad, Math.floor(Number(e.target.value)) || 1)))}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="One unit more"
                      disabled={cantidad >= maxCantidad}
                      onClick={() => setCantidad((c) => Math.min(maxCantidad, c + 1))}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="btn-primary" disabled={guardando} onClick={() => void handleAgregar()}>
                    {guardando
                      ? "Adding..."
                      : `Add${precios[seleccionado.idProducto] ? ` · ${pesos(Number(precios[seleccionado.idProducto]) * cantidad)}` : ""}`}
                  </button>
                </>
              ) : (
                <span className="picker-meta">Tap a product to add it to the order.</span>
              )}
            </div>
          </section>
        )}

        <section className="panel" aria-labelledby="titulo-cuenta">
          <h2 id="titulo-cuenta" className="panel-title">
            Table bill
          </h2>
          {grupos.length === 0 ? (
            <p className="empty-state">There are no products in this order yet.</p>
          ) : (
            <ul className="lista-cuenta">
              {grupos.map((g) => (
                <li key={g.clave}>
                  <span className="lista-cuenta-cant num">{g.cantidad} ×</span>
                  <span className="lista-cuenta-nombre">
                    {g.nombreProducto}
                    <span className="picker-meta"> {pesos(g.precioVenta)} each</span>
                  </span>
                  <span className="lista-cuenta-valor num">{pesos(g.subtotal)}</span>
                </li>
              ))}
              <li className="lista-cuenta-total">
                <span>Total</span>
                <span className="num">{pesos(pedido.total)}</span>
              </li>
            </ul>
          )}

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            {abierto && pedido.lineas.length > 0 && (
              <button type="button" className="btn-primary" disabled={procesando} onClick={() => void handleCerrarPedido()}>
                {procesando ? "Closing..." : "Close order and generate bill"}
              </button>
            )}
            {!abierto && (
              <Link to={`/cuenta/${pedido.idPedido}`} className="btn-primary">
                View bill
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
