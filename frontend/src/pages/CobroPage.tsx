import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import { ETIQUETAS_METODO, type LineaPagoEntrada, type MetodoPago, type ModalidadPago, type Pedido } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { agruparLineas } from "../utils/lineas";
import { etiquetaEstadoPago, fechaHora, pesos } from "../utils/format";

interface LineaAbono {
  metodo: MetodoPago;
  valor: string;
}

const METODOS: MetodoPago[] = ["EFECTIVO", "TARJETA_CREDITO", "TARJETA_DEBITO"];

const MODALIDADES: { value: ModalidadPago; titulo: string; ayuda: string }[] = [
  { value: "TOTAL", titulo: "Full payment", ayuda: "One single payment for the whole balance." },
  { value: "PRODUCTOS", titulo: "By products", ayuda: "Each person pays what they consumed." },
  { value: "ABONO", titulo: "Partial payment by amount", ayuda: "Any amount, up to the balance." },
];

const ETIQUETAS_MODALIDAD: Record<ModalidadPago, string> = {
  TOTAL: "Full payment",
  ABONO: "Partial payment",
  PRODUCTOS: "By products",
};

const aCentavos = (v: string | number) => Math.round(Number(v) * 100);

interface ProductoPendiente {
  idProducto: number;
  nombre: string;
  pendiente: number;
  /** Líneas con unidades por pagar, de la más antigua a la más reciente (así las cubre el servidor). */
  lineas: Array<{ pendiente: number; precioCent: number }>;
}

/** Unidades por pagar de la cuenta, agrupadas por producto. */
function productosPendientes(p: Pedido): ProductoPendiente[] {
  const lista: ProductoPendiente[] = [];
  for (const l of p.lineas) {
    if (l.cantidadPendiente <= 0) continue;
    let actual = lista.find((x) => x.idProducto === l.idProducto);
    if (!actual) {
      actual = { idProducto: l.idProducto, nombre: l.nombreProducto, pendiente: 0, lineas: [] };
      lista.push(actual);
    }
    actual.pendiente += l.cantidadPendiente;
    actual.lineas.push({ pendiente: l.cantidadPendiente, precioCent: aCentavos(l.precioVentaCongelado) });
  }
  return lista;
}

/** Valor (en centavos) de `cantidad` unidades de un producto, igual que lo calcula el servidor. */
function valorCentavos(prod: ProductoPendiente, cantidad: number): number {
  let restante = cantidad;
  let total = 0;
  for (const l of prod.lineas) {
    if (restante <= 0) break;
    const tomar = Math.min(restante, l.pendiente);
    total += tomar * l.precioCent;
    restante -= tomar;
  }
  return total;
}

/**
 * HU-033 a HU-038 — Pantalla de cobro (Cajero / Administrador).
 *
 * Flujo en un solo bloque, en el orden en que ocurre en caja:
 * 1) cómo paga (completo, por productos o abono), 2) qué paga (solo por
 * productos: producto y cantidad), 3) con qué método, 4) confirmar.
 *
 * - El saldo pendiente siempre está a la vista (HU-035 CA-01).
 * - Pago completo y por productos: un solo método y el valor se calcula solo
 *   (no se edita). Abono: valor libre y se pueden combinar métodos.
 * - Antes de registrar se confirma con un resumen: el pago es irreversible
 *   (HU-038) — no hay ninguna acción para editarlo o anularlo.
 * - Con saldo 0 el pedido queda PAGADO y la mesa LIBRE (HU-037).
 */
export function CobroPage() {
  const { idPedido } = useParams<{ idPedido: string }>();
  const confirmar = useConfirmar();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [modalidad, setModalidad] = useState<ModalidadPago>("TOTAL");
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [abonos, setAbonos] = useState<LineaAbono[]>([{ metodo: "EFECTIVO", valor: "" }]);
  // idProducto -> unidades que la persona paga ahora.
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [guardando, setGuardando] = useState(false);

  const reiniciarFormulario = useCallback(() => {
    setSeleccion({});
    setMetodo("EFECTIVO");
    setAbonos([{ metodo: "EFECTIVO", valor: "" }]);
  }, []);

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

  const pendientes = useMemo(() => (pedido ? productosPendientes(pedido) : []), [pedido]);
  const grupos = useMemo(() => (pedido ? agruparLineas(pedido.lineas) : []), [pedido]);

  const saldoCent = pedido ? aCentavos(pedido.saldoPendiente) : 0;
  const seleccionCent = pendientes.reduce((acc, p) => acc + valorCentavos(p, seleccion[p.idProducto] ?? 0), 0);
  const abonoCent = abonos.reduce((acc, l) => acc + (aCentavos(l.valor) || 0), 0);
  const aCobrarCent = modalidad === "TOTAL" ? saldoCent : modalidad === "PRODUCTOS" ? seleccionCent : abonoCent;

  // Los abonos no se asignan a productos: lo pendiente "por productos" puede
  // sumar más que el saldo. Se avisa para que el cajero no se confunda.
  const pendienteProductosCent = pendientes.reduce((acc, p) => acc + valorCentavos(p, p.pendiente), 0);
  const abonadoSinAsignarCent = Math.max(0, pendienteProductosCent - saldoCent);

  function cambiarModalidad(mod: ModalidadPago) {
    setModalidad(mod);
    setError(null);
    reiniciarFormulario();
  }

  function fijarCantidad(prod: ProductoPendiente, cantidad: number) {
    const valida = Math.max(0, Math.min(prod.pendiente, Math.floor(cantidad) || 0));
    setSeleccion((actual) => {
      const nueva = { ...actual, [prod.idProducto]: valida };
      if (valida === 0) delete nueva[prod.idProducto];
      return nueva;
    });
  }

  function actualizarAbono(i: number, cambios: Partial<LineaAbono>) {
    setAbonos((actual) => actual.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  async function handleRegistrar() {
    if (!pedido) return;
    setError(null);
    setMensaje(null);

    let lineas: LineaPagoEntrada[];
    const productosElegidos = pendientes
      .map((p) => ({ idProducto: p.idProducto, nombre: p.nombre, cantidad: seleccion[p.idProducto] ?? 0 }))
      .filter((x) => x.cantidad > 0);

    if (modalidad === "ABONO") {
      if (abonos.some((l) => !(Number(l.valor) > 0))) {
        setError("Each payment method in a partial payment must have a value greater than zero.");
        return;
      }
      if (abonoCent > saldoCent) {
        setError(`The partial payment (${pesos(abonoCent / 100)}) exceeds the pending balance (${pesos(saldoCent / 100)}).`);
        return;
      }
      lineas = abonos.map((l) => ({ metodo: l.metodo, valor: Number(l.valor) }));
    } else {
      if (modalidad === "PRODUCTOS" && productosElegidos.length === 0) {
        setError("Choose at least one product and the quantity to be paid.");
        return;
      }
      if (modalidad === "PRODUCTOS" && aCobrarCent > saldoCent) {
        setError(
          `The selected products (${pesos(aCobrarCent / 100)}) exceed the pending balance (${pesos(saldoCent / 100)}). Use “Full payment”.`
        );
        return;
      }
      lineas = [{ metodo, valor: aCobrarCent / 100 }];
    }

    const resumenMetodos = lineas.map((l) => `${pesos(l.valor)} by ${ETIQUETAS_METODO[l.metodo].toLowerCase()}`).join(" + ");
    const ok = await confirmar({
      titulo: `Record a payment of ${pesos(aCobrarCent / 100)}?`,
      mensaje: (
        <>
          <p style={{ margin: "0 0 0.5rem" }}>
            {ETIQUETAS_MODALIDAD[modalidad]} · {resumenMetodos}
          </p>
          {modalidad === "PRODUCTOS" && (
            <p style={{ margin: "0 0 0.5rem" }}>{productosElegidos.map((p) => `${p.cantidad} × ${p.nombre}`).join(", ")}</p>
          )}
          <p style={{ margin: 0 }}>
            Balance after payment: <strong>{pesos((saldoCent - aCobrarCent) / 100)}</strong>. A recorded payment cannot be
            edited or voided.
          </p>
        </>
      ),
      textoConfirmar: "Record payment",
    });
    if (!ok) return;

    setGuardando(true);
    try {
      const resultado = await pedidosApi.registrarPago(pedido.idPedido, {
        modalidad,
        lineas,
        productos:
          modalidad === "PRODUCTOS" ? productosElegidos.map(({ idProducto, cantidad }) => ({ idProducto, cantidad })) : undefined,
      });
      setPedido(resultado.pedido);
      reiniciarFormulario();
      if (resultado.pedido.estadoPago === "PAGADO") setModalidad("TOTAL");
      setMensaje(
        resultado.pedido.estadoPago === "PAGADO"
          ? `Payment recorded. The bill is fully paid and ${resultado.pedido.identificadorMesa} was freed.`
          : `Payment of ${pesos(aCobrarCent / 100)} recorded. Pending balance: ${pesos(resultado.pedido.saldoPendiente)}.`
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "The payment could not be recorded."));
    } finally {
      setGuardando(false);
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
        <Link to="/cobros" className="btn-secondary">
          Back to Payments
        </Link>
      </div>
    );
  }

  const pagado = pedido.estadoPago === "PAGADO";
  const cerrado = pedido.estadoPedido === "CERRADO";
  const puedeCobrar = cerrado && !pagado;
  const saldoDespuesCent = saldoCent - aCobrarCent;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Payment · {pedido.identificadorMesa}{" "}
            <span className={`badge ${pagado ? "badge-success" : "badge-warning"}`}>{etiquetaEstadoPago(pedido.estadoPago)}</span>
          </h1>
          <p className="page-sub">
            Order {pedido.identificadorPedido} · {pedido.nombreSede} · served by {pedido.nombreMesero}
          </p>
        </div>
        <div className="page-head-acciones">
          <Link to={`/cuenta/${pedido.idPedido}`} className="btn-secondary">
            View bill
          </Link>
          <Link to="/cobros" className="btn-secondary">
            Back to Payments
          </Link>
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}
      {!cerrado && <Aviso tipo="info">The order is still open: the waiter must close it before payment.</Aviso>}

      <div className="cobro-resumen">
        <div>
          <span className="cobro-etiqueta">Bill total</span>
          <strong className="num">{pesos(pedido.total)}</strong>
        </div>
        <div>
          <span className="cobro-etiqueta">Paid</span>
          <strong className="num">{pesos(pedido.totalPagado)}</strong>
        </div>
        <div className={pagado ? "cobro-saldo cobro-saldo-ok" : "cobro-saldo"}>
          <span className="cobro-etiqueta">Pending balance</span>
          <strong className="num">{pesos(pedido.saldoPendiente)}</strong>
        </div>
      </div>

      <div className={puedeCobrar ? "cobro-layout" : ""}>
        {puedeCobrar && (
          <section className="panel" aria-labelledby="titulo-registrar">
            <h2 id="titulo-registrar" className="panel-title">
              Record payment
            </h2>

            <fieldset className="grupo-campos">
              <legend>1. How is it paid?</legend>
              <div className="modalidades">
                {MODALIDADES.map((m) => (
                  <label key={m.value} className={`modalidad${modalidad === m.value ? " activa" : ""}`}>
                    <input
                      type="radio"
                      name="modalidad"
                      value={m.value}
                      checked={modalidad === m.value}
                      onChange={() => cambiarModalidad(m.value)}
                    />
                    <span className="modalidad-titulo">{m.titulo}</span>
                    <span className="modalidad-ayuda">{m.ayuda}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {modalidad === "PRODUCTOS" && (
              <fieldset className="grupo-campos">
                <legend>2. Which products are paid?</legend>
                {abonadoSinAsignarCent > 0 && (
                  <p className="nota-cobro">
                    This bill has {pesos(abonadoSinAsignarCent / 100)} in partial payments not assigned to products. If
                    the selection exceeds the balance, use “Full payment”.
                  </p>
                )}
                {pendientes.length === 0 ? (
                  <p className="empty-state">All products are already paid.</p>
                ) : (
                  <ul className="selector-productos">
                    {pendientes.map((prod) => {
                      const elegido = seleccion[prod.idProducto] ?? 0;
                      const precioUnit = prod.lineas[0]?.precioCent ?? 0;
                      return (
                        <li key={prod.idProducto} className={elegido > 0 ? "elegido" : ""}>
                          <div className="selector-producto-info">
                            <span className="selector-producto-nombre">{prod.nombre}</span>
                            <span className="picker-meta">
                              {pesos(precioUnit / 100)} each · {prod.pendiente} left
                            </span>
                          </div>
                          <div className="cantidad-selector" role="group" aria-label={`Units of ${prod.nombre}`}>
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Remove one unit of ${prod.nombre}`}
                              disabled={elegido === 0}
                              onClick={() => fijarCantidad(prod, elegido - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={prod.pendiente}
                              aria-label={`Units of ${prod.nombre} paid now`}
                              value={elegido}
                              onChange={(e) => fijarCantidad(prod, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Add one unit of ${prod.nombre}`}
                              disabled={elegido >= prod.pendiente}
                              onClick={() => fijarCantidad(prod, elegido + 1)}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="btn-link"
                              disabled={elegido === prod.pendiente}
                              onClick={() => fijarCantidad(prod, prod.pendiente)}
                            >
                              All
                            </button>
                          </div>
                          <span className="selector-producto-valor num">
                            {elegido > 0 ? pesos(valorCentavos(prod, elegido) / 100) : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
            )}

            <fieldset className="grupo-campos">
              <legend>{modalidad === "PRODUCTOS" ? "3." : "2."} Payment method</legend>
              {modalidad === "ABONO" ? (
                <>
                  {abonos.map((l, i) => (
                    <div className="inline-form linea-abono" key={i}>
                      <div className="field">
                        <label htmlFor={`metodo${i}`}>Method</label>
                        <select
                          id={`metodo${i}`}
                          value={l.metodo}
                          onChange={(e) => actualizarAbono(i, { metodo: e.target.value as MetodoPago })}
                        >
                          {METODOS.map((m) => (
                            <option key={m} value={m}>
                              {ETIQUETAS_METODO[m]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`valor${i}`}>
                          Amount
                          {Number(l.valor) > 0 && <span className="etiqueta-valor"> · {pesos(l.valor)}</span>}
                        </label>
                        <input
                          id={`valor${i}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step="any"
                          value={l.valor}
                          onChange={(e) => actualizarAbono(i, { valor: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      {abonos.length > 1 && (
                        <button
                          type="button"
                          className="btn-link danger"
                          onClick={() => setAbonos((actual) => actual.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {abonos.length < 6 && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setAbonos((actual) => [...actual, { metodo: "TARJETA_DEBITO", valor: "" }])}
                    >
                      + Combine with another method
                    </button>
                  )}
                </>
              ) : (
                <div className="metodos" role="radiogroup" aria-label="Payment method">
                  {METODOS.map((m) => (
                    <label key={m} className={`metodo${metodo === m ? " activo" : ""}`}>
                      <input type="radio" name="metodo" value={m} checked={metodo === m} onChange={() => setMetodo(m)} />
                      {ETIQUETAS_METODO[m]}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="cobro-total">
              <div>
                <span className="cobro-etiqueta">Amount to charge</span>
                <strong className="cobro-total-valor num">{pesos(aCobrarCent / 100)}</strong>
              </div>
              <div className="cobro-total-saldo">
                <span className="cobro-etiqueta">Balance after payment</span>
                <span className={`num${saldoDespuesCent < 0 ? " texto-peligro" : ""}`}>{pesos(saldoDespuesCent / 100)}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary btn-grande"
              disabled={guardando || aCobrarCent <= 0}
              onClick={() => void handleRegistrar()}
            >
              {guardando ? "Recording..." : aCobrarCent > 0 ? `Record payment of ${pesos(aCobrarCent / 100)}` : "Record payment"}
            </button>
            <p className="field-hint">A recorded payment cannot be edited or voided.</p>
          </section>
        )}

        <div>
          <section className="panel" aria-labelledby="titulo-detalle">
            <h2 id="titulo-detalle" className="panel-title">
              Bill details
            </h2>
            <ul className="lista-cuenta">
              {grupos.map((g) => (
                <li key={g.clave}>
                  <span className="lista-cuenta-cant num">{g.cantidad} ×</span>
                  <span className="lista-cuenta-nombre">
                    {g.nombreProducto}
                    <span className="picker-meta">
                      {" "}
                      {pesos(g.precioVenta)} each
                      {g.cantidadPagada > 0 &&
                        (g.cantidadPagada >= g.cantidad ? " · paid" : ` · ${g.cantidadPagada} paid`)}
                    </span>
                  </span>
                  <span className="lista-cuenta-valor num">{pesos(g.subtotal)}</span>
                </li>
              ))}
              <li className="lista-cuenta-total">
                <span>Total</span>
                <span className="num">{pesos(pedido.total)}</span>
              </li>
            </ul>
          </section>

          <section className="panel" aria-labelledby="titulo-pagos">
            <h2 id="titulo-pagos" className="panel-title">
              Recorded payments
            </h2>
            {pedido.pagos.length === 0 ? (
              <p className="empty-state">No payment has been recorded yet.</p>
            ) : (
              <ul className="lista-pagos">
                {pedido.pagos.map((p) => (
                  <li key={p.idPago}>
                    <div>
                      <strong>{ETIQUETAS_METODO[p.metodo]}</strong>
                      <span className="picker-meta">
                        {" "}
                        · {ETIQUETAS_MODALIDAD[p.modalidad]} · {fechaHora(p.fechaHora)} · {p.nombreUsuario}
                      </span>
                    </div>
                    <span className="num">{pesos(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
