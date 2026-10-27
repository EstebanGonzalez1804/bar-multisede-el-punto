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
  { value: "TOTAL", titulo: "Pago completo", ayuda: "Un solo pago por todo el saldo." },
  { value: "PRODUCTOS", titulo: "Por productos", ayuda: "Cada persona paga lo que consumió." },
  { value: "ABONO", titulo: "Abono por monto", ayuda: "Un valor libre, hasta el saldo." },
];

const ETIQUETAS_MODALIDAD: Record<ModalidadPago, string> = {
  TOTAL: "Pago completo",
  ABONO: "Abono",
  PRODUCTOS: "Por productos",
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
      .catch((err) => activo && setError(getApiErrorMessage(err, "No se pudo cargar la cuenta.")))
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
        setError("Cada método del abono debe tener un valor mayor a cero.");
        return;
      }
      if (abonoCent > saldoCent) {
        setError(`El abono (${pesos(abonoCent / 100)}) supera el saldo pendiente (${pesos(saldoCent / 100)}).`);
        return;
      }
      lineas = abonos.map((l) => ({ metodo: l.metodo, valor: Number(l.valor) }));
    } else {
      if (modalidad === "PRODUCTOS" && productosElegidos.length === 0) {
        setError("Elige al menos un producto y la cantidad que va a pagar.");
        return;
      }
      if (modalidad === "PRODUCTOS" && aCobrarCent > saldoCent) {
        setError(
          `Los productos elegidos (${pesos(aCobrarCent / 100)}) superan el saldo pendiente (${pesos(saldoCent / 100)}). Usa “Pago completo”.`
        );
        return;
      }
      lineas = [{ metodo, valor: aCobrarCent / 100 }];
    }

    const resumenMetodos = lineas.map((l) => `${pesos(l.valor)} en ${ETIQUETAS_METODO[l.metodo].toLowerCase()}`).join(" + ");
    const ok = await confirmar({
      titulo: `¿Registrar pago de ${pesos(aCobrarCent / 100)}?`,
      mensaje: (
        <>
          <p style={{ margin: "0 0 0.5rem" }}>
            {ETIQUETAS_MODALIDAD[modalidad]} · {resumenMetodos}
          </p>
          {modalidad === "PRODUCTOS" && (
            <p style={{ margin: "0 0 0.5rem" }}>{productosElegidos.map((p) => `${p.cantidad} × ${p.nombre}`).join(", ")}</p>
          )}
          <p style={{ margin: 0 }}>
            Saldo después del pago: <strong>{pesos((saldoCent - aCobrarCent) / 100)}</strong>. Un pago registrado no se
            puede modificar ni anular.
          </p>
        </>
      ),
      textoConfirmar: "Registrar pago",
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
          ? `Pago registrado. La cuenta quedó pagada y ${resultado.pedido.identificadorMesa} se liberó.`
          : `Pago de ${pesos(aCobrarCent / 100)} registrado. Saldo pendiente: ${pesos(resultado.pedido.saldoPendiente)}.`
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo registrar el pago."));
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
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Link to="/cobros" className="btn-secondary">
          Volver a Cobros
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
            Cobro · {pedido.identificadorMesa}{" "}
            <span className={`badge ${pagado ? "badge-success" : "badge-warning"}`}>{etiquetaEstadoPago(pedido.estadoPago)}</span>
          </h1>
          <p className="page-sub">
            Pedido {pedido.identificadorPedido} · {pedido.nombreSede} · atendió {pedido.nombreMesero}
          </p>
        </div>
        <div className="page-head-acciones">
          <Link to={`/cuenta/${pedido.idPedido}`} className="btn-secondary">
            Ver cuenta
          </Link>
          <Link to="/cobros" className="btn-secondary">
            Volver a Cobros
          </Link>
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}
      {!cerrado && <Aviso tipo="info">El pedido sigue abierto: el mesero debe cerrarlo antes de cobrar.</Aviso>}

      <div className="cobro-resumen">
        <div>
          <span className="cobro-etiqueta">Total de la cuenta</span>
          <strong className="num">{pesos(pedido.total)}</strong>
        </div>
        <div>
          <span className="cobro-etiqueta">Pagado</span>
          <strong className="num">{pesos(pedido.totalPagado)}</strong>
        </div>
        <div className={pagado ? "cobro-saldo cobro-saldo-ok" : "cobro-saldo"}>
          <span className="cobro-etiqueta">Saldo pendiente</span>
          <strong className="num">{pesos(pedido.saldoPendiente)}</strong>
        </div>
      </div>

      <div className={puedeCobrar ? "cobro-layout" : ""}>
        {puedeCobrar && (
          <section className="panel" aria-labelledby="titulo-registrar">
            <h2 id="titulo-registrar" className="panel-title">
              Registrar pago
            </h2>

            <fieldset className="grupo-campos">
              <legend>1. ¿Cómo paga?</legend>
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
                <legend>2. ¿Qué productos paga?</legend>
                {abonadoSinAsignarCent > 0 && (
                  <p className="nota-cobro">
                    Esta cuenta tiene {pesos(abonadoSinAsignarCent / 100)} en abonos que no corresponden a productos. Si
                    lo elegido supera el saldo, usa “Pago completo”.
                  </p>
                )}
                {pendientes.length === 0 ? (
                  <p className="empty-state">Todos los productos ya están pagados.</p>
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
                              {pesos(precioUnit / 100)} c/u · faltan {prod.pendiente}
                            </span>
                          </div>
                          <div className="cantidad-selector" role="group" aria-label={`Unidades de ${prod.nombre}`}>
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Quitar una unidad de ${prod.nombre}`}
                              disabled={elegido === 0}
                              onClick={() => fijarCantidad(prod, elegido - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={prod.pendiente}
                              aria-label={`Unidades de ${prod.nombre} que paga ahora`}
                              value={elegido}
                              onChange={(e) => fijarCantidad(prod, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Agregar una unidad de ${prod.nombre}`}
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
                              Todas
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
              <legend>{modalidad === "PRODUCTOS" ? "3." : "2."} ¿Con qué paga?</legend>
              {modalidad === "ABONO" ? (
                <>
                  {abonos.map((l, i) => (
                    <div className="inline-form linea-abono" key={i}>
                      <div className="field">
                        <label htmlFor={`metodo${i}`}>Método</label>
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
                          Valor
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
                          Quitar
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
                      + Combinar con otro método
                    </button>
                  )}
                </>
              ) : (
                <div className="metodos" role="radiogroup" aria-label="Método de pago">
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
                <span className="cobro-etiqueta">Valor a cobrar</span>
                <strong className="cobro-total-valor num">{pesos(aCobrarCent / 100)}</strong>
              </div>
              <div className="cobro-total-saldo">
                <span className="cobro-etiqueta">Saldo después del pago</span>
                <span className={`num${saldoDespuesCent < 0 ? " texto-peligro" : ""}`}>{pesos(saldoDespuesCent / 100)}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary btn-grande"
              disabled={guardando || aCobrarCent <= 0}
              onClick={() => void handleRegistrar()}
            >
              {guardando ? "Registrando..." : aCobrarCent > 0 ? `Registrar pago de ${pesos(aCobrarCent / 100)}` : "Registrar pago"}
            </button>
            <p className="field-hint">Un pago registrado no se puede modificar ni anular.</p>
          </section>
        )}

        <div>
          <section className="panel" aria-labelledby="titulo-detalle">
            <h2 id="titulo-detalle" className="panel-title">
              Detalle de la cuenta
            </h2>
            <ul className="lista-cuenta">
              {grupos.map((g) => (
                <li key={g.clave}>
                  <span className="lista-cuenta-cant num">{g.cantidad} ×</span>
                  <span className="lista-cuenta-nombre">
                    {g.nombreProducto}
                    <span className="picker-meta">
                      {" "}
                      {pesos(g.precioVenta)} c/u
                      {g.cantidadPagada > 0 &&
                        (g.cantidadPagada >= g.cantidad ? " · pagado" : ` · ${g.cantidadPagada} pagado${g.cantidadPagada === 1 ? "" : "s"}`)}
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
              Pagos registrados
            </h2>
            {pedido.pagos.length === 0 ? (
              <p className="empty-state">Aún no se ha registrado ningún pago.</p>
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
