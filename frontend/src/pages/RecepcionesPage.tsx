import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as proveedoresApi from "../api/proveedores";
import * as recepcionesApi from "../api/recepciones";
import * as productosApi from "../api/productos";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import type { Producto, Proveedor, Recepcion, Sede } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { fecha, hora, hoyBogota } from "../utils/format";

interface FilaLinea {
  idProducto: string;
  cantidad: string;
}

const LINEA_VACIA: FilaLinea = { idProducto: "", cantidad: "" };

/** HU-019 (consulta) + HU-021 (registro) — Recepciones de mercancía. */
export function RecepcionesPage() {
  const { usuario } = useAuth();
  const confirmar = useConfirmar();
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
  const [fechaNueva, setFechaNueva] = useState(hoyBogota());
  const [lineas, setLineas] = useState<FilaLinea[]>([{ ...LINEA_VACIA }]);
  const [guardando, setGuardando] = useState(false);

  const cargarRecepciones = useCallback(async () => {
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
      setError(getApiErrorMessage(err, "Receipts could not be loaded."));
    } finally {
      setCargando(false);
    }
  }, [filtroProveedor, filtroSede, filtroDesde, filtroHasta]);

  useCargaConFiltros(cargarRecepciones);

  useEffect(() => {
    proveedoresApi.listarProveedores().then(setProveedores).catch(() => undefined);
    productosApi.listarProductos({ estado: "ACTIVO" }).then(setProductos).catch(() => undefined);
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirFormulario() {
    setIdProveedorNueva("");
    setIdSedeNueva(esAdministrador ? "" : String(usuario?.idSede ?? ""));
    setFechaNueva(hoyBogota());
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
      setError("You must select a supplier.");
      return;
    }
    if (esAdministrador && !idSedeNueva) {
      setError("You must select a location.");
      return;
    }
    if (!fechaNueva) {
      setError("You must enter the receipt date.");
      return;
    }
    if (fechaNueva > hoyBogota()) {
      setError("The receipt date cannot be later than today.");
      return;
    }

    const lineasValidas: { idProducto: number; cantidad: number }[] = [];
    for (const linea of lineas) {
      if (!linea.idProducto && !linea.cantidad) continue;
      const cantidad = Number(linea.cantidad);
      if (!linea.idProducto || !Number.isInteger(cantidad) || cantidad <= 0) {
        setError("Each product in the receipt must have a whole quantity greater than zero.");
        return;
      }
      lineasValidas.push({ idProducto: Number(linea.idProducto), cantidad });
    }
    if (lineasValidas.length === 0) {
      setError("Add at least one product to the receipt.");
      return;
    }
    const unidades = lineasValidas.reduce((acc, l) => acc + l.cantidad, 0);
    const proveedor = proveedores.find((p) => String(p.idProveedor) === idProveedorNueva)?.nombre ?? "";
    const ok = await confirmar({
      titulo: "Record the receipt?",
      mensaje: (
        <>
          {lineasValidas.length} product{lineasValidas.length === 1 ? "" : "s"} ({unidades} units) from{" "}
          <strong>{proveedor}</strong>, dated {fecha(fechaNueva)}. Inventory is updated immediately and the
          receipt cannot be edited afterwards.
        </>
      ),
      textoConfirmar: "Record receipt",
    });
    if (!ok) return;

    setGuardando(true);
    try {
      await recepcionesApi.crearRecepcion({
        idProveedor: Number(idProveedorNueva),
        idSede: Number(idSedeNueva || usuario?.idSede),
        fechaRecepcion: fechaNueva,
        lineas: lineasValidas,
      });
      setMensaje("Receipt recorded successfully. Inventory has been updated.");
      cerrarFormulario();
      await cargarRecepciones();
    } catch (err) {
      setError(getApiErrorMessage(err, "The receipt could not be recorded."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h1 className="page-title">Goods receipts</h1>
          {!mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirFormulario}>
              + Record receipt
            </button>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmit}>
            <h2 className="subform-title">New receipt</h2>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="proveedorNueva">Supplier</label>
                <select
                  id="proveedorNueva"
                  value={idProveedorNueva}
                  onChange={(e) => setIdProveedorNueva(e.target.value)}
                >
                  <option value="">Select a supplier</option>
                  {proveedores.filter((x) => x.estado === "ACTIVO").map((p) => (
                    <option key={p.idProveedor} value={p.idProveedor}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {esAdministrador && (
                <div className="field">
                  <label htmlFor="sedeNueva">Location</label>
                  <select id="sedeNueva" value={idSedeNueva} onChange={(e) => setIdSedeNueva(e.target.value)}>
                    <option value="">Select a location</option>
                    {sedes.filter((x) => x.estado === "ACTIVO").map((s) => (
                      <option key={s.idSede} value={s.idSede}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="fechaNueva">Date</label>
                <input
                  id="fechaNueva"
                  type="date"
                  max={hoyBogota()}
                  value={fechaNueva}
                  onChange={(e) => setFechaNueva(e.target.value)}
                />
              </div>
            </div>

            <h3 className="subform-subtitle">Products received</h3>
            {lineas.map((linea, index) => (
              <div className="inline-form linea-recepcion" key={index}>
                <div className="field field-ancho">
                  <label htmlFor={`productoRecepcion${index}`}>Product</label>
                  <select
                    id={`productoRecepcion${index}`}
                    value={linea.idProducto}
                    onChange={(e) => actualizarLinea(index, { idProducto: e.target.value })}
                  >
                    <option value="">Select a product</option>
                    {productos.map((p) => (
                      <option key={p.idProducto} value={p.idProducto}>
                        {p.nombre} · {p.codigo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field field-corto">
                  <label htmlFor={`cantidadRecepcion${index}`}>Quantity</label>
                  <input
                    id={`cantidadRecepcion${index}`}
                    inputMode="numeric"
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
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn-link agregar-linea" onClick={agregarLinea}>
              + Add another product
            </button>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Saving..." : "Record receipt"}
              </button>
              <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="toolbar">
          <div className="field">
            <label htmlFor="filtroProveedor">Supplier</label>
            <select id="filtroProveedor" value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)}>
              <option value="">All</option>
              {proveedores.map((p) => (
                <option key={p.idProveedor} value={p.idProveedor}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          {esAdministrador && (
            <div className="field">
              <label htmlFor="filtroSedeRecepcion">Location</label>
              <select id="filtroSedeRecepcion" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
                <option value="">All</option>
                {sedes.map((s) => (
                  <option key={s.idSede} value={s.idSede}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="filtroDesde">From</label>
            <input id="filtroDesde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="filtroHasta">To</label>
            <input id="filtroHasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
        </div>

        {cargando ? (
          <p className="empty-state">Loading...</p>
        ) : recepciones.length === 0 ? (
          <p className="empty-state">No receipts recorded with these filters.</p>
        ) : (
          <div className="table-scroll">
          <table className="tabla-apilada">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                {esAdministrador && <th>Location</th>}
                <th>Recorded by</th>
                <th>Time recorded</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {recepciones.map((r) => (
                <Fragment key={r.idRecepcion}>
                  <tr>
                    <td data-label="Date" className="celda-titulo">
                      {fecha(r.fechaRecepcion)}
                    </td>
                    <td data-label="Supplier">{r.nombreProveedor}</td>
                    {esAdministrador && <td data-label="Location">{r.nombreSede}</td>}
                    <td data-label="Recorded by">{r.nombreUsuario}</td>
                    <td data-label="Time">{hora(r.creadoEn)}</td>
                    <td data-label="" className="celda-acciones">
                      <button
                        className="btn-link"
                        onClick={() => setExpandidoId(expandidoId === r.idRecepcion ? null : r.idRecepcion)}
                      >
                        {expandidoId === r.idRecepcion ? "Hide products" : `View products (${r.lineas.length})`}
                      </button>
                    </td>
                  </tr>
                  {expandidoId === r.idRecepcion && (
                    <tr className="fila-detalle">
                      <td colSpan={6} data-label="">
                        <ul className="lista-detalle">
                          {r.lineas.map((l) => (
                            <li key={l.idProducto}>
                              <span>{l.nombreProducto}</span>
                              <strong className="num">{l.cantidad} units</strong>
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
