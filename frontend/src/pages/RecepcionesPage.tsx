import { Fragment, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as proveedoresApi from "../api/proveedores";
import * as recepcionesApi from "../api/recepciones";
import * as productosApi from "../api/productos";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import type { Producto, Proveedor, Recepcion, Sede } from "../api/types";

interface FilaLinea {
  idProducto: string;
  cantidad: string;
}

const LINEA_VACIA: FilaLinea = { idProducto: "", cantidad: "" };

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** HU-019 (consulta) + HU-021 (registro) — Recepciones de mercancía. */
export function RecepcionesPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  // Filtros de consulta (HU-019 CA-02).
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idProveedorNueva, setIdProveedorNueva] = useState("");
  const [idSedeNueva, setIdSedeNueva] = useState("");
  const [fechaNueva, setFechaNueva] = useState(hoyISO());
  const [lineas, setLineas] = useState<FilaLinea[]>([{ ...LINEA_VACIA }]);
  const [guardando, setGuardando] = useState(false);

  async function cargarRecepciones() {
    setCargando(true);
    setError(null);
    try {
      const data = await recepcionesApi.listarRecepciones({
        idProveedor: filtroProveedor ? Number(filtroProveedor) : undefined,
        idSede: filtroSede ? Number(filtroSede) : undefined,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
      });
      setRecepciones(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar las recepciones."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarRecepciones();
    proveedoresApi.listarProveedores().then(setProveedores).catch(() => undefined);
    productosApi.listarProductos({ estado: "ACTIVO" }).then(setProductos).catch(() => undefined);
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiltrar(e: FormEvent) {
    e.preventDefault();
    void cargarRecepciones();
  }

  function abrirFormulario() {
    setIdProveedorNueva("");
    setIdSedeNueva(esAdministrador ? "" : String(usuario?.idSede ?? ""));
    setFechaNueva(hoyISO());
    setLineas([{ ...LINEA_VACIA }]);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
  }

  function actualizarLinea(index: number, cambios: Partial<FilaLinea>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!idProveedorNueva) {
      setError("Debes seleccionar un proveedor.");
      return;
    }
    if (esAdministrador && !idSedeNueva) {
      setError("Debes seleccionar una sede.");
      return;
    }
    if (!fechaNueva) {
      setError("Debes indicar la fecha de la recepción.");
      return;
    }

    const lineasValidas: { idProducto: number; cantidad: number }[] = [];
    for (const linea of lineas) {
      if (!linea.idProducto && !linea.cantidad) continue;
      const cantidad = Number(linea.cantidad);
      if (!linea.idProducto || !Number.isInteger(cantidad) || cantidad <= 0) {
        setError("Cada producto de la recepción debe tener una cantidad entera mayor a cero.");
        return;
      }
      lineasValidas.push({ idProducto: Number(linea.idProducto), cantidad });
    }
    if (lineasValidas.length === 0) {
      setError("Agrega al menos un producto a la recepción.");
      return;
    }

    setGuardando(true);
    try {
      await recepcionesApi.crearRecepcion({
        idProveedor: Number(idProveedorNueva),
        idSede: Number(idSedeNueva || usuario?.idSede),
        fechaRecepcion: fechaNueva,
        lineas: lineasValidas,
      });
      setMensaje("Recepción registrada correctamente. El inventario ya quedó actualizado.");
      cerrarFormulario();
      await cargarRecepciones();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo registrar la recepción."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Recepciones de mercancía</h2>
          {!mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirFormulario}>
              + Registrar recepción
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmit}>
            <h3 style={{ marginTop: 0 }}>Nueva recepción</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="proveedorNueva">Proveedor</label>
                <select
                  id="proveedorNueva"
                  value={idProveedorNueva}
                  onChange={(e) => setIdProveedorNueva(e.target.value)}
                >
                  <option value="">Selecciona un proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.idProveedor} value={p.idProveedor}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {esAdministrador && (
                <div className="field">
                  <label htmlFor="sedeNueva">Sede</label>
                  <select id="sedeNueva" value={idSedeNueva} onChange={(e) => setIdSedeNueva(e.target.value)}>
                    <option value="">Selecciona una sede</option>
                    {sedes.map((s) => (
                      <option key={s.idSede} value={s.idSede}>
                        {s.codigoSede} — {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="fechaNueva">Fecha</label>
                <input
                  id="fechaNueva"
                  type="date"
                  value={fechaNueva}
                  onChange={(e) => setFechaNueva(e.target.value)}
                />
              </div>
            </div>

            <h4>Productos recibidos</h4>
            {lineas.map((linea, index) => (
              <div className="inline-form" key={index}>
                <div className="field">
                  <label>Producto</label>
                  <select
                    value={linea.idProducto}
                    onChange={(e) => actualizarLinea(index, { idProducto: e.target.value })}
                  >
                    <option value="">Selecciona un producto</option>
                    {productos.map((p) => (
                      <option key={p.idProducto} value={p.idProducto}>
                        {p.codigo} — {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ maxWidth: 140 }}>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={linea.cantidad}
                    onChange={(e) => actualizarLinea(index, { cantidad: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="btn-link danger"
                  onClick={() => quitarLinea(index)}
                  disabled={lineas.length === 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <div className="table-actions" style={{ marginBottom: "1rem" }}>
              <button type="button" className="btn-secondary" onClick={agregarLinea}>
                + Agregar producto
              </button>
            </div>

            <div className="table-actions">
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar recepción"}
              </button>
              <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <form className="toolbar" onSubmit={handleFiltrar}>
          <div className="field">
            <label htmlFor="filtroProveedor">Proveedor</label>
            <select id="filtroProveedor" value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)}>
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.idProveedor} value={p.idProveedor}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          {esAdministrador && (
            <div className="field">
              <label htmlFor="filtroSedeRecepcion">Sede</label>
              <select id="filtroSedeRecepcion" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
                <option value="">Todas</option>
                {sedes.map((s) => (
                  <option key={s.idSede} value={s.idSede}>
                    {s.codigoSede} — {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="filtroDesde">Desde</label>
            <input id="filtroDesde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filtroHasta">Hasta</label>
            <input id="filtroHasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <button type="submit" className="btn-secondary">
            Filtrar
          </button>
        </form>

        {cargando ? (
          <p className="empty-state">Cargando...</p>
        ) : recepciones.length === 0 ? (
          <p className="empty-state">No hay recepciones registradas con estos filtros.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Sede</th>
                <th>Usuario</th>
                <th>Hora</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {recepciones.map((r) => (
                <Fragment key={r.idRecepcion}>
                  <tr>
                    <td>{r.fechaRecepcion}</td>
                    <td>{r.nombreProveedor}</td>
                    <td>{r.nombreSede}</td>
                    <td>{r.nombreUsuario}</td>
                    <td>{new Date(r.creadoEn).toLocaleTimeString()}</td>
                    <td>
                      <button
                        className="btn-link"
                        onClick={() => setExpandidoId(expandidoId === r.idRecepcion ? null : r.idRecepcion)}
                      >
                        {expandidoId === r.idRecepcion ? "Ocultar" : "Ver productos"}
                      </button>
                    </td>
                  </tr>
                  {expandidoId === r.idRecepcion && (
                    <tr>
                      <td colSpan={6}>
                        <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                          {r.lineas.map((l) => (
                            <li key={l.idProducto}>
                              {l.codigoProducto} — {l.nombreProducto}: {l.cantidad} unidad(es)
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
