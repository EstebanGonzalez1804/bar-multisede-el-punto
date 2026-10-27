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
  { value: "TOTAL", titulo: "Pago completo", ayuda: "Un único pago por todo el saldo pendiente." },
  { value: "ABONO", titulo: "Abono por monto", ayuda: "El cliente paga el valor que quiera, hasta el saldo." },
  { value: "PRODUCTOS", titulo: "Por productos", ayuda: "Eliges producto y cantidad; el valor se calcula solo." },
];

const aCentavos = (v: string | number) => Math.round(Number(v) * 100);

interface ProductoPendiente {
  idProducto: number;
  codigo: string;
  nombre: string;
  pendiente: number;
  /** Líneas con unidades por pagar, de la más antigua a la más reciente (así las cubre el servidor). */
  lineas: Array<{ pendiente: number; precioCent: number }>;
}

/** Agrupa las unidades por pagar de la cuenta por producto. */
function productosPendientes(p: Pedido): ProductoPendiente[] {
  const mapa = new Map<number, ProductoPendiente>();
  for (const l of p.lineas) {
    if (l.cantidadPendiente <= 0) continue;
    const actual = mapa.get(l.idProducto) ?? {
      idProducto: l.idProducto,
      codigo: l.codigoProducto,
      nombre: l.nombreProducto,
      pendiente: 0,
      lineas: [],
    };
    actual.pendiente += l.cantidadPendiente;
    actual.lineas.push({ pendiente: l.cantidadPendiente, precioCent: aCentavos(l.precioVentaCongelado) });
    mapa.set(l.idProducto, actual);
  }
  return Array.from(mapa.values());
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
 * - Muestra siempre el total, lo pagado y el SALDO PENDIENTE (HU-035 CA-01).
 * - Pago completo (HU-033): un único pago, un solo método, por el saldo exacto
 *   (el valor viene fijo).
 * - Abono por monto (HU-035): cualquier valor hasta el saldo.
 * - Por productos (HU-036): el cajero elige producto y cantidad (ej. 1 de 2
 *   botellas); el valor se calcula solo y se descuenta del saldo.
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
  // idProducto -> unidades que el cliente va a pagar ahora.
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [guardando, setGuardando] = useState(false);

  const preparar = useCallback((p: Pedido, mod: ModalidadPago) => {
    setSeleccion({});
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

  const pendientes = useMemo(() => (pedido ? productosPendientes(pedido) : []), [pedido]);

  // Resumen por producto (todas las líneas del producto juntas) para la tabla.
  const resumenProductos = useMemo(() => {
    if (!pedido) return [];
    const mapa = new Map<number, { idProducto: number; codigo: string; nombre: string; pedidas: number; pendiente: number; precios: Set<string> }>();
    for (const l of pedido.lineas) {
      const r = mapa.get(l.idProducto) ?? {
        idProducto: l.idProducto,
        codigo: l.codigoProducto,
        nombre: l.nombreProducto,
        pedidas: 0,
        pendiente: 0,
        precios: new Set<string>(),
      };
      r.pedidas += l.cantidad;
      r.pendiente += l.cantidadPendiente;
      r.precios.add(pesos(l.precioVentaCongelado));
      mapa.set(l.idProducto, r);
    }
    return Array.from(mapa.values()).map((r) => ({ ...r, precios: Array.from(r.precios).join(" / ") }));
  }, [pedido]);

  const totalSeleccion = useMemo(
    () => pendientes.reduce((acc, prod) => acc + valorCentavos(prod, seleccion[prod.idProducto] ?? 0), 0) / 100,
    [pendientes, seleccion]
  );

  function cambiarModalidad(mod: ModalidadPago) {
    setModalidad(mod);
    setError(null);
    if (pedido) preparar(pedido, mod);
  }

  function fijarCantidad(prod: ProductoPendiente, cantidad: number) {
    const valida = Math.max(0, Math.min(prod.pendiente, Math.floor(cantidad) || 0));
    const nueva = { ...seleccion, [prod.idProducto]: valida };
    if (valida === 0) delete nueva[prod.idProducto];
    setSeleccion(nueva);
    // El valor se calcula automáticamente (HU-036 CA-01) cuando hay un único método.
    if (lineas.length === 1) {
      const total =
        pendientes.reduce((acc, p) => acc + valorCentavos(p, nueva[p.idProducto] ?? 0), 0) / 100;
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
    const productosElegidos = pendientes
      .map((p) => ({ idProducto: p.idProducto, cantidad: seleccion[p.idProducto] ?? 0 }))
      .filter((x) => x.cantidad > 0);
    if (modalidad === "PRODUCTOS" && productosElegidos.length === 0) {
      setError("Elige al menos un producto y la cantidad que va a pagar.");
      return;
    }

    setGuardando(true);
    try {
      const resultado = await pedidosApi.registrarPago(pedido.idPedido, {
        modalidad,
        lineas: entrada,
        productos: modalidad === "PRODUCTOS" ? productosElegidos : undefined,
      });
      setPedido(resultado.pedido);
      preparar(resultado.pedido, modalidad);
      const vueltasTxt = resultado.vueltas > 0 ? ` Vueltas a entregar: ${pesos(resultado.vueltas)}.` : "";
      setMensaje(
        resultado.pedido.estadoPago === "PAGADO"
          ? `Pago registrado. La cuenta quedó pagada y la mesa se liberó.${vueltasTxt}`
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
                <th>Producto</th>
                <th>Precio</th>
                <th>Pedidos</th>
                <th>Pagados</th>
                <th>Por pagar</th>
                {modalidad === "PRODUCTOS" && !pagado && cerrado && <th>Paga ahora</th>}
              </tr>
            </thead>
            <tbody>
              {resumenProductos.map((r) => {
                const prod = pendientes.find((x) => x.idProducto === r.idProducto);
                const elegido = seleccion[r.idProducto] ?? 0;
                return (
                  <tr key={r.idProducto}>
                    <td>
                      {r.codigo} — {r.nombre}
                    </td>
                    <td>{r.precios}</td>
                    <td>{r.pedidas}</td>
                    <td>
                      {r.pedidas - r.pendiente > 0 ? (
                        <span className="badge badge-success">{r.pedidas - r.pendiente}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{r.pendiente}</td>
                    {modalidad === "PRODUCTOS" && !pagado && cerrado && (
                      <td>
                        {prod ? (
                          <div className="cantidad-selector">
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Quitar una unidad de ${r.nombre}`}
                              disabled={elegido === 0}
                              onClick={() => fijarCantidad(prod, elegido - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={prod.pendiente}
                              aria-label={`Unidades de ${r.nombre} que paga ahora`}
                              value={elegido}
                              onChange={(e) => fijarCantidad(prod, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Agregar una unidad de ${r.nombre}`}
                              disabled={elegido >= prod.pendiente}
                              onClick={() => fijarCantidad(prod, elegido + 1)}
                            >
                              +
                            </button>
                            <button type="button" className="btn-link" onClick={() => fijarCantidad(prod, prod.pendiente)}>
                              Todas
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
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
                Valor de los productos que paga ahora: <strong>{pesos(totalSeleccion)}</strong>
                {totalSeleccion > 0 && (
                  <>
                    {" "}
                    · Saldo después del pago: <strong>{pesos(Math.round((pedido.saldoPendiente - totalSeleccion) * 100) / 100)}</strong>
                  </>
                )}
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
                    readOnly={modalidad === "TOTAL"}
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
                {modalidad !== "TOTAL" && lineas.length > 1 && (
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

            {modalidad !== "TOTAL" && lineas.length < 6 && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setLineas([...lineas, { metodo: "TARJETA_CREDITO", valor: "", entregado: "" }])}
              >
                + Agregar otro método
              </button>
            )}

            <p className="field-hint" style={{ marginTop: "0.75rem" }}>
              Valor a cobrar: <strong>{pesos(sumaLineas)}</strong>
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
