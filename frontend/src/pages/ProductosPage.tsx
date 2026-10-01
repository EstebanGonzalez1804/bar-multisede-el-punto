import { Fragment, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as productosApi from "../api/productos";
import * as tiposProductoApi from "../api/tiposProducto";
import { useAuth } from "../context/AuthContext";
import type { Estado, HistorialPrecio, Producto, TipoProducto } from "../api/types";

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

function formatearMoneda(valor: string): string {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
}

export function ProductosPage() {
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
  const [accionEnCurso, setAccionEnCurso] = useState<number | null>(null);

  // HU-015 CA-05/06: historial de precios por producto.
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  async function cargarProductos() {
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
      setError(getApiErrorMessage(err, "No se pudieron cargar los productos."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarProductos();
    tiposProductoApi
      .listarTiposProducto()
      .then(setTipos)
      .catch(() => {
        /* el selector de tipos queda vacío */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBuscar(e: FormEvent) {
    e.preventDefault();
    void cargarProductos();
  }

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
      valorCompra: producto.valorCompra,
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
      setError("El nombre es obligatorio.");
      return;
    }
    if (!formulario.idTipoProducto) {
      setError("Debes seleccionar un tipo de producto.");
      return;
    }
    const valorCompra = Number(formulario.valorCompra);
    const valorVenta = Number(formulario.valorVenta);
    if (Number.isNaN(valorCompra) || valorCompra < 0 || Number.isNaN(valorVenta) || valorVenta < 0) {
      setError("Los valores de compra y venta deben ser números válidos mayores o iguales a 0.");
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
        setMensaje("Producto creado correctamente.");
      } else {
        await productosApi.modificarProducto(editandoId, {
          nombre: formulario.nombre.trim(),
          idTipoProducto: Number(formulario.idTipoProducto),
          valorCompra,
          valorVenta,
        });
        setMensaje("Producto actualizado correctamente.");
      }
      cerrarFormulario();
      await cargarProductos();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar el producto."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleCambiarEstado(producto: Producto) {
    const nuevoEstado: Estado = producto.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    setAccionEnCurso(producto.idProducto);
    setError(null);
    try {
      await productosApi.cambiarEstadoProducto(producto.idProducto, nuevoEstado);
      setMensaje(nuevoEstado === "ACTIVO" ? "Producto activado." : "Producto inactivado.");
      await cargarProductos();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar el estado del producto."));
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
      setError(getApiErrorMessage(err, "No se pudo cargar el historial de precios."));
    } finally {
      setCargandoHistorial(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Productos</h2>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + Nuevo producto
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        <form className="toolbar" onSubmit={handleBuscar}>
          <div className="field">
            <label htmlFor="busquedaProducto">Buscar (código o nombre)</label>
            <input
              id="busquedaProducto"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="PRD-001 o Cerveza"
            />
          </div>
          <div className="field">
            <label htmlFor="filtroTipo">Tipo</label>
            <select id="filtroTipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t.idTipoProducto} value={t.idTipoProducto}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filtroEstadoProducto">Estado</label>
            <select
              id="filtroEstadoProducto"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as Estado | "")}
            >
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            Buscar
          </button>
        </form>

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmitFormulario}>
            <h3 style={{ marginTop: 0 }}>{editandoId === null ? "Nuevo producto" : "Editar producto"}</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombreProducto">Nombre</label>
                <input
                  id="nombreProducto"
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Cerveza Águila 330ml"
                />
              </div>
              <div className="field">
                <label htmlFor="idTipoProducto">Tipo</label>
                <select
                  id="idTipoProducto"
                  value={formulario.idTipoProducto}
                  onChange={(e) => setFormulario((f) => ({ ...f, idTipoProducto: e.target.value }))}
                >
                  <option value="">Selecciona un tipo</option>
                  {tipos.map((t) => (
                    <option key={t.idTipoProducto} value={t.idTipoProducto}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="valorCompra">Valor de compra</label>
                <input
                  id="valorCompra"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.valorCompra}
                  onChange={(e) => setFormulario((f) => ({ ...f, valorCompra: e.target.value }))}
                  placeholder="2500"
                />
              </div>
              <div className="field">
                <label htmlFor="valorVenta">Valor de venta</label>
                <input
                  id="valorVenta"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.valorVenta}
                  onChange={(e) => setFormulario((f) => ({ ...f, valorVenta: e.target.value }))}
                  placeholder="5000"
                />
              </div>
            </div>
            {editandoId === null ? (
              <p className="field-hint">
                El código se genera automáticamente a partir del tipo de producto (ej. tipo "Aguardiente" → código
                PDT-AGU-001).
              </p>
            ) : (
              <p className="field-hint">
                Si cambias los valores de compra o venta, se registrará un nuevo historial de precios.
              </p>
            )}
            <div className="table-actions">
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {cargando ? (
          <p className="empty-state">Cargando...</p>
        ) : productos.length === 0 ? (
          <p className="empty-state">No hay productos que coincidan con la búsqueda.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Valor compra</th>
                <th>Valor venta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => (
                <Fragment key={producto.idProducto}>
                  <tr>
                    <td>{producto.codigo}</td>
                    <td>{producto.nombre}</td>
                    <td>{producto.nombreTipoProducto}</td>
                    <td>{formatearMoneda(producto.valorCompra)}</td>
                    <td>{formatearMoneda(producto.valorVenta)}</td>
                    <td>
                      <span className={`badge ${producto.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                        {producto.estado}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-link" onClick={() => void toggleHistorial(producto)}>
                          {expandidoId === producto.idProducto ? "Ocultar historial" : "Ver historial"}
                        </button>
                        {esAdministrador && (
                          <>
                            <button
                              className="btn-link"
                              onClick={() => abrirEdicion(producto)}
                              disabled={accionEnCurso === producto.idProducto}
                            >
                              Editar
                            </button>
                            <button
                              className={`btn-link ${producto.estado === "ACTIVO" ? "danger" : ""}`}
                              onClick={() => void handleCambiarEstado(producto)}
                              disabled={accionEnCurso === producto.idProducto}
                            >
                              {producto.estado === "ACTIVO" ? "Inactivar" : "Activar"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandidoId === producto.idProducto && (
                    <tr>
                      <td colSpan={7}>
                        {cargandoHistorial ? (
                          <p className="empty-state">Cargando historial...</p>
                        ) : historial.length === 0 ? (
                          <p className="empty-state">Sin historial de precios.</p>
                        ) : (
                          <table>
                            <thead>
                              <tr>
                                <th>Vigente desde</th>
                                <th>Valor compra</th>
                                <th>Valor venta</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historial.map((h) => (
                                <tr key={h.idHistorial}>
                                  <td>{new Date(h.vigenteDesde).toLocaleString("es-CO")}</td>
                                  <td>{formatearMoneda(h.valorCompra)}</td>
                                  <td>{formatearMoneda(h.valorVenta)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
