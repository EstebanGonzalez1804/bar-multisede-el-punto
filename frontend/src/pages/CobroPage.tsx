import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import {
  ETIQUETAS_METODO,
  type LineaPagoEntrada,
  type MetodoPago,
  type ModalidadPago,
  type Pedido,
} from "../api/types";
import { etiquetaEstadoPago, fechaHora, pesos } from "../utils/format";

interface LineaForm {
  metodo: MetodoPago;
  valor: string;
  entregado: string;
}

const METODOS: MetodoPago[] = ["EFECTIVO", "TARJETA_CREDITO", "TARJETA_DEBITO"];

const MODALIDADES: { value: ModalidadPago; titulo: string; ayuda: string }[] = [
  { value: "TOTAL", titulo: "Pago completo", ayuda: "Un método o varios combinados que sumen exactamente el saldo." },
  { value: "ABONO", titulo: "Abono por monto", ayuda: "Cada cliente paga la parte que quiera del total." },
  { value: "PRODUCTOS", titulo: "Por productos", ayuda: "Cada cliente paga exactamente lo que consumió." },
];

const aCentavos = (v: string | number) => Math.round(Number(v) * 100);

/**
 * HU-033 a HU-038 — Pantalla de cobro (Cajero / Administrador).
 *
 * - Muestra siempre el total, lo pagado y el SALDO PENDIENTE (HU-035 CA-01).
 * - Pago completo (HU-033/034): una o varias líneas método + valor que deben
 *   sumar el saldo exacto.
 * - Abono por monto (HU-035): cualquier valor hasta el saldo.
 * - Por productos (HU-036): se marcan las líneas de la cuenta; el valor se
 *   calcula solo antes de confirmar.
 * - Cuando el saldo llega a 0 el pedido queda PAGADO y la mesa LIBRE (HU-037).
 * - No hay ninguna acción para editar o anular un pago (HU-038).
 */
export function CobroPage() {
  const { idPedido } = useParams<{ idPedido: string }>();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [modalidad, setModalidad] = useState<ModalidadPago>("TOTAL");
  const [lineas, setLineas] = useState<LineaForm[]>([{ metodo: "EFECTIVO", valor: "", entregado: "" }]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);

  const preparar = useCallback((p: Pedido, mod: ModalidadPago) => {
    setSeleccion([]);
    setLineas([
      {
        metodo: "EFECTIVO",
        valor: mod === "TOTAL" && p.saldoPendiente > 0 ? String(p.saldoPendiente) : "",
        entregado: "",
      },
    ]);
  }, []);

  useEffect(() => {
    let activo = true;
    pedidosApi
      .obtenerPedido(Number(idPedido))
      .then((p) => {
        if (!activo) return;
        setPedido(p);
        preparar(p, "TOTAL");
      })
      .catch((err) => activo && setError(getApiErrorMessage(err, "No se pudo cargar la cuenta.")))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [idPedido, preparar]);

  const totalSeleccion = useMemo(() => {
    if (!pedido) return 0;
    return (
      pedido.lineas
        .filter((l) => seleccion.includes(l.idDetallePedido))
        .reduce((acc, l) => acc + l.cantidad * aCentavos(l.precioVentaCongelado), 0) / 100
    );
  }, [pedido, seleccion]);

  function cambiarModalidad(mod: ModalidadPago) {
    setModalidad(mod);
    setError(null);
    if (pedido) preparar(pedido, mod);
  }

  function alternarProducto(id: number) {
    if (!pedido) return;
    const nueva = seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id];
    setSeleccion(nueva);
    // El valor se calcula automáticamente (HU-036 CA-01) cuando hay un único método.
    if (lineas.length === 1) {
      const total =
        pedido.lineas
          .filter((l) => nueva.includes(l.idDetallePedido))
          .reduce((acc, l) => acc + l.cantidad * aCentavos(l.precioVentaCongelado), 0) / 100;
      setLineas([{ ...lineas[0], valor: total > 0 ? String(total) : "" }]);
    }
  }

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas(lineas.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const sumaLineas = lineas.reduce((acc, l) => acc + (aCentavos(l.valor) || 0), 0) / 100;
  const vueltas =
    lineas.reduce((acc, l) => {
      const entregado = aCentavos(l.entregado);
      const valor = aCentavos(l.valor);
      return l.metodo === "EFECTIVO" && entregado > valor && valor > 0 ? acc + (entregado - valor) : acc;
    }, 0) / 100;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pedido) return;
    setError(null);
    setMensaje(null);

    const entrada: LineaPagoEntrada[] = [];
    for (const l of lineas) {
      const valor = Number(l.valor);
      if (!(valor > 0)) {
        setError("Cada método de pago debe tener un valor mayor a cero.");
        return;
      }
      const item: LineaPagoEntrada = { metodo: l.metodo, valor };
      if (l.metodo === "EFECTIVO" && l.entregado.trim() !== "") {
        item.valorEntregado = Number(l.entregado);
      }
      entrada.push(item);
    }
    if (modalidad === "PRODUCTOS" && seleccion.length === 0) {
      setError("Selecciona al menos un producto de la cuenta.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await pedidosApi.registrarPago(pedido.idPedido, {
        modalidad,
        lineas: entrada,
        idsDetallePedido: modalidad === "PRODUCTOS" ? seleccion : undefined,
      });
      setPedido(resultado.pedido);
      preparar(resultado.pedido, modalidad);
      const vueltasTxt = resultado.vueltas > 0 ? ` Vueltas a entregar: ${pesos(resultado.vueltas)}.` : "";
      setMensaje(
        resultado.pedido.estadoPago === "PAGADO"
          ? `Pago completo registrado. La cuenta quedó pagada y la mesa se liberó.${vueltasTxt}`
          : `Pago registrado. Saldo pendiente: ${pesos(resultado.pedido.saldoPendiente)}.${vueltasTxt}`
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
        {error && <div className="alert alert-error">{error}</div>}
        <Link to="/cobros" className="btn-secondary">
          Volver a Cobros
        </Link>
      </div>
    );
  }

  const pagado = pedido.estadoPago === "PAGADO";
  const cerrado = pedido.estadoPedido === "CERRADO";

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>
            Cobro · Pedido {pedido.identificadorPedido} · Mesa {pedido.identificadorMesa}
          </h2>
          <div className="table-actions">
            <Link to={`/cuenta/${pedido.idPedido}`} className="btn-secondary">
              Ver cuenta
            </Link>
            <Link to="/cobros" className="btn-secondary">
              Volver a Cobros
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}
        {!cerrado && (
          <div className="alert alert-info">El pedido sigue abierto: el Mesero debe cerrarlo antes de cobrar.</div>
        )}

        <div className="cobro-resumen">
          <div>
            <span className="cobro-etiqueta">Total de la cuenta</span>
            <strong>{pesos(pedido.total)}</strong>
          </div>
          <div>
            <span className="cobro-etiqueta">Pagado</span>
            <strong>{pesos(pedido.totalPagado)}</strong>
          </div>
          <div className={pagado ? "cobro-saldo cobro-saldo-ok" : "cobro-saldo"}>
            <span className="cobro-etiqueta">Saldo pendiente</span>
            <strong>{pesos(pedido.saldoPendiente)}</strong>
          </div>
          <div>
            <span className="cobro-etiqueta">Estado de pago</span>
            <span className={`badge ${pagado ? "badge-success" : "badge-warning"}`}>
              {etiquetaEstadoPago(pedido.estadoPago)}
            </span>
          </div>
        </div>

        <h3>Productos de la cuenta</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {modalidad === "PRODUCTOS" && !pagado && <th>Cobrar</th>}
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Subtotal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedido.lineas.map((l) => (
                <tr key={l.idDetallePedido}>
                  {modalidad === "PRODUCTOS" && !pagado && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${l.nombreProducto}`}
                        disabled={l.pagada}
                        checked={seleccion.includes(l.idDetallePedido)}
                        onChange={() => alternarProducto(l.idDetallePedido)}
                      />
                    </td>
                  )}
                  <td>
                    {l.codigoProducto} — {l.nombreProducto}
                  </td>
                  <td>{l.cantidad}</td>
                  <td>{pesos(Number(l.precioVentaCongelado) * l.cantidad)}</td>
                  <td>{l.pagada ? <span className="badge badge-success">Pagado</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cerrado && !pagado && (
        <div className="panel">
          <h2>Registrar pago</h2>

          <div className="modalidades" role="radiogroup" aria-label="Tipo de cobro">
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

          <form onSubmit={handleSubmit}>
            {modalidad === "PRODUCTOS" && (
              <p className="field-hint">
                Valor de los productos seleccionados: <strong>{pesos(totalSeleccion)}</strong>
              </p>
            )}

            {lineas.map((l, i) => (
              <div className="inline-form" key={i} style={{ marginBottom: "0.5rem" }}>
                <div className="field">
                  <label htmlFor={`metodo${i}`}>Método de pago</label>
                  <select
                    id={`metodo${i}`}
                    value={l.metodo}
                    onChange={(e) => actualizarLinea(i, { metodo: e.target.value as MetodoPago })}
                  >
                    {METODOS.map((m) => (
                      <option key={m} value={m}>
                        {ETIQUETAS_METODO[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`valor${i}`}>Valor</label>
                  <input
                    id={`valor${i}`}
                    type="number"
                    min={0}
                    step="any"
                    value={l.valor}
                    onChange={(e) => actualizarLinea(i, { valor: e.target.value })}
                  />
                </div>
                {l.metodo === "EFECTIVO" && (
                  <div className="field">
                    <label htmlFor={`entregado${i}`}>Entrega el cliente (opcional)</label>
                    <input
                      id={`entregado${i}`}
                      type="number"
                      min={0}
                      step="any"
                      value={l.entregado}
                      onChange={(e) => actualizarLinea(i, { entregado: e.target.value })}
                    />
                  </div>
                )}
                {lineas.length > 1 && (
                  <button
                    type="button"
                    className="btn-link danger"
                    onClick={() => setLineas(lineas.filter((_, idx) => idx !== i))}
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}

            {lineas.length < 6 && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setLineas([...lineas, { metodo: "TARJETA_CREDITO", valor: "", entregado: "" }])}
              >
                + Agregar otro método
              </button>
            )}

            <p className="field-hint" style={{ marginTop: "0.75rem" }}>
              Suma de los métodos: <strong>{pesos(sumaLineas)}</strong>
              {modalidad === "TOTAL" && sumaLineas !== pedido.saldoPendiente && (
                <>
                  {" "}
                  · {sumaLineas < pedido.saldoPendiente ? "Falta" : "Sobra"}:{" "}
                  <strong>{pesos(Math.abs(Math.round((pedido.saldoPendiente - sumaLineas) * 100) / 100))}</strong>
                </>
              )}
              {vueltas > 0 && (
                <>
                  {" "}
                  · Vueltas: <strong>{pesos(vueltas)}</strong>
                </>
              )}
            </p>

            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
                {guardando ? "Registrando..." : "Confirmar pago"}
              </button>
            </div>
            <p className="field-hint">
              Un pago registrado no se puede modificar ni anular.
            </p>
          </form>
        </div>
      )}

      <div className="panel">
        <h2>Pagos registrados</h2>
        {pedido.pagos.length === 0 ? (
          <p className="empty-state">Aún no se ha registrado ningún pago.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                  <th>Registró</th>
                </tr>
              </thead>
              <tbody>
                {pedido.pagos.map((p) => (
                  <tr key={p.idPago}>
                    <td>{fechaHora(p.fechaHora)}</td>
                    <td>{ETIQUETAS_METODO[p.metodo]}</td>
                    <td>{pesos(p.valor)}</td>
                    <td>
                      {p.modalidad === "TOTAL" ? "Completo" : p.modalidad === "ABONO" ? "Abono" : "Por productos"}
                    </td>
                    <td>{p.nombreUsuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
