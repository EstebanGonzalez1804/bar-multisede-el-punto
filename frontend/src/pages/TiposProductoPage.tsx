import { Fragment, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as tiposProductoApi from "../api/tiposProducto";
import { useAuth } from "../context/AuthContext";
import type { TipoProducto, TipoProductoConProductos } from "../api/types";

export function TiposProductoPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [tipos, setTipos] = useState<TipoProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  // HU-013 CA-03: ver los productos asociados a un tipo.
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<TipoProductoConProductos | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  async function cargarTipos() {
    setCargando(true);
    setError(null);
    try {
      const data = await tiposProductoApi.listarTiposProducto();
      setTipos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los tipos de producto."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarTipos();
  }, []);

  function abrirCreacion() {
    setNombre("");
    setEditandoId(null);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function abrirEdicion(tipo: TipoProducto) {
    setNombre(tipo.nombre);
    setEditandoId(tipo.idTipoProducto);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setNombre("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId === null) {
        await tiposProductoApi.crearTipoProducto(nombre.trim());
        setMensaje("Tipo de producto creado correctamente.");
      } else {
        await tiposProductoApi.modificarTipoProducto(editandoId, nombre.trim());
        setMensaje("Tipo de producto actualizado correctamente.");
      }
      cerrarFormulario();
      await cargarTipos();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar el tipo de producto."));
    } finally {
      setGuardando(false);
    }
  }

  async function toggleDetalle(tipo: TipoProducto) {
    if (expandidoId === tipo.idTipoProducto) {
      setExpandidoId(null);
      setDetalle(null);
      return;
    }
    setExpandidoId(tipo.idTipoProducto);
    setDetalle(null);
    setCargandoDetalle(true);
    setError(null);
    try {
      const data = await tiposProductoApi.obtenerTipoProducto(tipo.idTipoProducto);
      setDetalle(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los productos de este tipo."));
    } finally {
      setCargandoDetalle(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Tipos de producto</h2>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + Nuevo tipo
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmit}>
            <h3 style={{ marginTop: 0 }}>{editandoId === null ? "Nuevo tipo de producto" : "Editar tipo de producto"}</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombreTipo">Nombre</label>
                <input
                  id="nombreTipo"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Licores"
                />
              </div>
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
        ) : tipos.length === 0 ? (
          <p className="empty-state">Aún no hay tipos de producto registrados.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Abreviación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <Fragment key={tipo.idTipoProducto}>
                  <tr>
                    <td>{tipo.nombre}</td>
                    <td>
                      <span className="badge badge-muted">{tipo.abreviacion}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-link" onClick={() => void toggleDetalle(tipo)}>
                          {expandidoId === tipo.idTipoProducto ? "Ocultar productos" : "Ver productos"}
                        </button>
                        {esAdministrador && (
                          <button className="btn-link" onClick={() => abrirEdicion(tipo)}>
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandidoId === tipo.idTipoProducto && (
                    <tr>
                      <td colSpan={3}>
                        {cargandoDetalle ? (
                          <p className="empty-state">Cargando productos...</p>
                        ) : detalle && detalle.productos.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                            {detalle.productos.map((p) => (
                              <li key={p.idProducto}>
                                {p.codigo} — {p.nombre}{" "}
                                <span className={`badge ${p.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                                  {p.estado}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty-state">Este tipo aún no tiene productos asociados.</p>
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
