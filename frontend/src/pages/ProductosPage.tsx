import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as productosApi from "../api/productos";
import * as tiposProductoApi from "../api/tiposProducto";
import { useAuth } from "../context/AuthContext";
import type { Estado, HistorialPrecio, Producto, TipoProducto } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { etiquetaEstado, fechaHoraCompleta, pesos } from "../utils/format";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";

interface FormularioProducto {
  nombre: string;
  idTipoProducto: string;
  valorCompra: string;
  valorVenta: string;
}

const FORMULARIO_VACIO: FormularioProducto = {
  nombre: "",
  idTipoProducto: "",
  valorCompra: "",
  valorVenta: "",
};

export function ProductosPage() {
  const confirmar = useConfirmar();
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [tipos, setTipos] = useState<TipoProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<Estado | "">("");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<FormularioProducto>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);
  const [accionEnCurso, setAccionEnCurso] = useState<number | null>(null);

  // HU-015 CA-05/06: historial de precios por producto.
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargarProductos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await productosApi.listarProductos({
        busqueda: busqueda.trim() || undefined,
        idTipoProducto: filtroTipo ? Number(filtroTipo) : undefined,
        estado: filtroEstado || undefined,
      });
      setProductos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Products could not be loaded."));
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroTipo, filtroEstado]);

  useCargaConFiltros(cargarProductos);

  useEffect(() => {
    tiposProductoApi
      .listarTiposProducto()
      .then(setTipos)
      .catch(() => {
        /* el selector de tipos queda vacío */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function abrirCreacion() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function abrirEdicion(producto: Producto) {
    setFormulario({
      nombre: producto.nombre,
      idTipoProducto: String(producto.idTipoProducto),
      valorCompra: producto.valorCompra ?? "",
      valorVenta: producto.valorVenta,
    });
    setEditandoId(producto.idProducto);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
  }

  async function handleSubmitFormulario(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formulario.nombre.trim()) {
      setError("The name is required.");
      return;
    }
    if (!formulario.idTipoProducto) {
      setError("You must select a product type.");
      return;
    }
    const valorCompra = Number(formulario.valorCompra);
    const valorVenta = Number(formulario.valorVenta);
    if (Number.isNaN(valorCompra) || valorCompra < 0 || Number.isNaN(valorVenta) || valorVenta < 0) {
      setError("Purchase and sale values must be valid numbers greater than or equal to 0.");
      return;
    }
    if (valorVenta < valorCompra) {
      setError("The sale value cannot be lower than the purchase value.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId === null) {
        await productosApi.crearProducto({
          nombre: formulario.nombre.trim(),
          idTipoProducto: Number(formulario.idTipoProducto),
          valorCompra,
          valorVenta,
        });
        setMensaje("Product created successfully.");
      } else {
        await productosApi.modificarProducto(editandoId, {
          nombre: formulario.nombre.trim(),
          idTipoProducto: Number(formulario.idTipoProducto),
          valorCompra,
          valorVenta,
        });
        setMensaje("Product updated successfully.");
      }
      cerrarFormulario();
      await cargarProductos();
    } catch (err) {
      setError(getApiErrorMessage(err, "The product could not be saved."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleCambiarEstado(producto: Producto) {
    const nuevoEstado: Estado = producto.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (
      nuevoEstado === "INACTIVO" &&
      !(await confirmar({
        titulo: `Deactivate ${producto.nombre}?`,
        mensaje: "It no longer appears for adding to orders. Its history and inventory are kept.",
        textoConfirmar: "Deactivate product",
        peligro: true,
      }))
    ) {
      return;
    }
    setAccionEnCurso(producto.idProducto);
    setError(null);
    try {
      await productosApi.cambiarEstadoProducto(producto.idProducto, nuevoEstado);
      setMensaje(nuevoEstado === "ACTIVO" ? "Product activated." : "Product deactivated.");
      await cargarProductos();
    } catch (err) {
      setError(getApiErrorMessage(err, "The product status could not be changed."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function toggleHistorial(producto: Producto) {
    if (expandidoId === producto.idProducto) {
      setExpandidoId(null);
      setHistorial([]);
      return;
    }
    setExpandidoId(producto.idProducto);
    setHistorial([]);
    setCargandoHistorial(true);
    setError(null);
    try {
      const data = await productosApi.obtenerHistorialPrecios(producto.idProducto);
      setHistorial(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "The price history could not be loaded."));
    } finally {
      setCargandoHistorial(false);
    }
  }

  const ventaMenorQueCompra =
    formulario.valorCompra !== "" &&
    formulario.valorVenta !== "" &&
    Number(formulario.valorVenta) < Number(formulario.valorCompra);

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h1 className="page-title">Products</h1>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + New product
            </button>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        <div className="toolbar">
          <div className="field field-busqueda">
            <label htmlFor="busquedaProducto">Search</label>
            <input
              id="busquedaProducto"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Name or code, e.g. PDT-CER or Club"
            />
          </div>
          <div className="field">
            <label htmlFor="filtroTipo">Type</label>
            <select id="filtroTipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">All</option>
              {tipos.map((t) => (
                <option key={t.idTipoProducto} value={t.idTipoProducto}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filtroEstadoProducto">Status</label>
            <select
              id="filtroEstadoProducto"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as Estado | "")}
            >
              <option value="">All</option>
              <option value="ACTIVO">Active</option>
              <option value="INACTIVO">Inactive</option>
            </select>
          </div>
        </div>

        {mostrarFormulario && (
          <form ref={formRef} className="row-subform" onSubmit={handleSubmitFormulario}>
            <h2 className="subform-title">{editandoId === null ? "New product" : "Edit product"}</h2>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombreProducto">Name</label>
                <input
                  id="nombreProducto"
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Águila Beer 330ml"
                />
              </div>
              <div className="field">
                <label htmlFor="idTipoProducto">Type</label>
                <select
                  id="idTipoProducto"
                  value={formulario.idTipoProducto}
                  onChange={(e) => setFormulario((f) => ({ ...f, idTipoProducto: e.target.value }))}
                >
                  <option value="">Select a type</option>
                  {tipos.filter((x) => x.estado === "ACTIVO").map((t) => (
                    <option key={t.idTipoProducto} value={t.idTipoProducto}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="valorCompra">
                  Purchase value
                  {Number(formulario.valorCompra) > 0 && <span className="etiqueta-valor"> · {pesos(formulario.valorCompra)}</span>}
                </label>
                <input
                  id="valorCompra"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.valorCompra}
                  onChange={(e) => setFormulario((f) => ({ ...f, valorCompra: e.target.value }))}
                  placeholder="2500"
                  inputMode="decimal"
                />
              </div>
              <div className="field">
                <label htmlFor="valorVenta">
                  Sale value
                  {Number(formulario.valorVenta) > 0 && <span className="etiqueta-valor"> · {pesos(formulario.valorVenta)}</span>}
                </label>
                <input
                  id="valorVenta"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.valorVenta}
                  onChange={(e) => setFormulario((f) => ({ ...f, valorVenta: e.target.value }))}
                  placeholder="5000"
                  inputMode="decimal"
                  aria-invalid={ventaMenorQueCompra}
                />
                {ventaMenorQueCompra && (
                  <p className="field-error" role="alert">
                    The sale value cannot be lower than the purchase value.
                  </p>
                )}
              </div>
            </div>
            {editandoId === null ? (
              <p className="field-hint">
                The code is generated automatically from the product type (e.g. type "Aguardiente" → code
                PDT-AGU-001).
              </p>
            ) : (
              <p className="field-hint">
                If you change the purchase or sale values, a new price history entry is recorded.
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {cargando ? (
          <p className="empty-state">Loading...</p>
        ) : productos.length === 0 ? (
          <p className="empty-state">No products match the search.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                {esAdministrador && <th className="num">Purchase value</th>}
                <th className="num">Sale value</th>
                <th>Status</th>
                {esAdministrador && (
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => (
                <Fragment key={producto.idProducto}>
                  <tr>
                    <td className="texto-suave">{producto.codigo}</td>
                    <td className="celda-titulo">{producto.nombre}</td>
                    <td>{producto.nombreTipoProducto}</td>
                    {esAdministrador && <td className="num">{pesos(producto.valorCompra)}</td>}
                    <td className="num">{pesos(producto.valorVenta)}</td>
                    <td>
                      <span className={`badge ${producto.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                        {etiquetaEstado(producto.estado)}
                      </span>
                    </td>
                    {esAdministrador && (
                    <td>
                      <div className="table-actions">
                        <button className="btn-link" onClick={() => void toggleHistorial(producto)}>
                          {expandidoId === producto.idProducto ? "Hide prices" : "Price history"}
                        </button>
                        <>
                            <button
                              className="btn-link"
                              onClick={() => abrirEdicion(producto)}
                              disabled={accionEnCurso === producto.idProducto}
                            >
                              Edit
                            </button>
                            <button
                              className={`btn-link ${producto.estado === "ACTIVO" ? "danger" : ""}`}
                              onClick={() => void handleCambiarEstado(producto)}
                              disabled={accionEnCurso === producto.idProducto}
                            >
                              {producto.estado === "ACTIVO" ? "Deactivate" : "Activate"}
                            </button>
                        </>
                      </div>
                    </td>
                    )}
                  </tr>
                  {expandidoId === producto.idProducto && (
                    <tr>
                      <td colSpan={7}>
                        {cargandoHistorial ? (
                          <p className="empty-state">Loading history...</p>
                        ) : historial.length === 0 ? (
                          <p className="empty-state">No price history.</p>
                        ) : (
                          <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Effective from</th>
                                <th className="num">Purchase value</th>
                                <th className="num">Sale value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historial.map((h) => (
                                <tr key={h.idHistorial}>
                                  <td>{fechaHoraCompleta(h.vigenteDesde)}</td>
                                  <td className="num">{pesos(h.valorCompra)}</td>
                                  <td className="num">{pesos(h.valorVenta)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
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
