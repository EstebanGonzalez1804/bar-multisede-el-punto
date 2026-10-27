import { Fragment, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as tiposProductoApi from "../api/tiposProducto";
import { useAuth } from "../context/AuthContext";
import type { Estado, TipoProducto, TipoProductoConProductos } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { etiquetaEstado } from "../utils/format";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";

export function TiposProductoPage() {
  const confirmar = useConfirmar();
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
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);

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

  async function handleCambiarEstado(tipo: TipoProducto) {
    const nuevoEstado: Estado = tipo.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    setError(null);
    if (
      nuevoEstado === "INACTIVO" &&
      !(await confirmar({
        titulo: `¿Inactivar el tipo ${tipo.nombre}?`,
        mensaje: "También se inactivarán todos los productos de este tipo. Al activarlo de nuevo, los productos siguen inactivos hasta que los actives uno a uno.",
        textoConfirmar: "Inactivar tipo y productos",
        peligro: true,
      }))
    ) {
      return;
    }
    try {
      const resultado = await tiposProductoApi.cambiarEstadoTipoProducto(tipo.idTipoProducto, nuevoEstado);
      const n = resultado.productosInactivados ?? 0;
      setMensaje(
        nuevoEstado === "ACTIVO"
          ? "Tipo de producto activado. Sus productos siguen inactivos hasta que los actives uno a uno desde Productos."
          : `Tipo de producto inactivado${n > 0 ? ` junto con ${n} producto${n === 1 ? "" : "s"} de este tipo` : ""}.`
      );
      await cargarTipos();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar el estado del tipo de producto."));
    }
  }

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
          <h1 className="page-title">Tipos de producto</h1>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + Nuevo tipo
            </button>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        {mostrarFormulario && (
          <form ref={formRef} className="row-subform" onSubmit={handleSubmit}>
            <h2 className="subform-title">{editandoId === null ? "Nuevo tipo de producto" : "Editar tipo de producto"}</h2>
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
            </div>
            {editandoId === null && (
              <p className="field-hint">La abreviación de 3 letras (para el código de los productos) se genera sola.</p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={guardando}>
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
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <Fragment key={tipo.idTipoProducto}>
                  <tr>
                    <td className="celda-titulo">{tipo.nombre}</td>
                    <td>
                      <span className="badge badge-muted">{tipo.abreviacion}</span>
                    </td>
                    <td>
                      <span className={`badge ${tipo.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                        {etiquetaEstado(tipo.estado)}
                      </span>
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
                        {esAdministrador && (
                          <button
                            className={`btn-link ${tipo.estado === "ACTIVO" ? "danger" : ""}`}
                            onClick={() => void handleCambiarEstado(tipo)}
                          >
                            {tipo.estado === "ACTIVO" ? "Inactivar" : "Activar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandidoId === tipo.idTipoProducto && (
                    <tr className="fila-detalle">
                      <td colSpan={4}>
                        {cargandoDetalle ? (
                          <p className="empty-state">Cargando productos...</p>
                        ) : detalle && detalle.productos.length > 0 ? (
                          <ul className="lista-detalle">
                            {detalle.productos.map((p) => (
                              <li key={p.idProducto}>
                                <span>
                                  {p.nombre} <span className="texto-suave">· {p.codigo}</span>
                                </span>
                                <span className={`badge ${p.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                                  {etiquetaEstado(p.estado)}
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
