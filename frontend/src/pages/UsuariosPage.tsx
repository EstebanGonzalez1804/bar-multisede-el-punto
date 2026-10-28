import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import * as authApi from "../api/auth";
import { getApiErrorMessage } from "../api/client";
import * as sedesApi from "../api/sedes";
import * as usuariosApi from "../api/usuarios";
import { ETIQUETAS_PERFIL, type Estado, type Perfil, type Sede, type Usuario } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { etiquetaEstado } from "../utils/format";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";

const PERFILES: Perfil[] = ["ADMINISTRADOR", "CAJERO", "MESERO"];

interface FormularioUsuario {
  nombre: string;
  perfil: Perfil;
  idSede: string; // "" = sin sede (Administrador, o aún no elegida)
  password: string;
}

const FORMULARIO_VACIO: FormularioUsuario = {
  nombre: "",
  perfil: "CAJERO",
  idSede: "",
  password: "",
};

export function UsuariosPage() {
  const confirmar = useConfirmar();
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Filtros de búsqueda (HU-009)
  const [busqueda, setBusqueda] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<Perfil | "">("");
  const [filtroEstado, setFiltroEstado] = useState<Estado | "">("");

  // Formulario de creación/edición (HU-007 / HU-008 CA-01)
  const [editandoId, setEditandoId] = useState<number | null>(null); // null + mostrarFormulario = creando
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formulario, setFormulario] = useState<FormularioUsuario>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);

  // Fila con el formulario de "cambiar contraseña" abierto (HU-005)
  const [filaPassword, setFilaPassword] = useState<number | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState("");

  // Deshabilita los botones de una fila mientras se ejecuta su acción.
  const [accionEnCurso, setAccionEnCurso] = useState<number | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await usuariosApi.listarUsuarios({
        busqueda: busqueda.trim() || undefined,
        perfil: filtroPerfil || undefined,
        estado: filtroEstado || undefined,
      });
      setUsuarios(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Users could not be loaded."));
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroPerfil, filtroEstado]);

  useCargaConFiltros(cargarUsuarios);

  useEffect(() => {
    sedesApi
      .listarSedes()
      .then(setSedes)
      .catch(() => {
        /* el selector de sedes queda vacío; el resto de la página sigue funcionando */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirCreacion() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setMostrarFormulario(true);
    setMensaje(null);
    setError(null);
  }

  function abrirEdicion(usuario: Usuario) {
    setFormulario({
      nombre: usuario.nombre,
      perfil: usuario.perfil,
      idSede: usuario.idSede !== null ? String(usuario.idSede) : "",
      password: "",
    });
    setEditandoId(usuario.idUsuario);
    setMostrarFormulario(true);
    setMensaje(null);
    setError(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
  }

  function handleCambiarPerfil(perfil: Perfil) {
    setFormulario((f) => ({
      ...f,
      perfil,
      // HU-007 CA-02: Administrador no usa sede.
      idSede: perfil === "ADMINISTRADOR" ? "" : f.idSede,
    }));
  }

  async function handleSubmitFormulario(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formulario.nombre.trim()) {
      setError("The name is required.");
      return;
    }
    if (formulario.perfil !== "ADMINISTRADOR" && !formulario.idSede) {
      setError("Cashier and Waiter profiles require a location.");
      return;
    }
    if (editandoId === null && formulario.password.trim().length < 8) {
      setError("The password must be at least 8 characters long.");
      return;
    }

    const idSede = formulario.perfil === "ADMINISTRADOR" ? null : Number(formulario.idSede);

    setGuardando(true);
    try {
      if (editandoId === null) {
        await usuariosApi.crearUsuario({
          nombre: formulario.nombre.trim(),
          perfil: formulario.perfil,
          idSede,
          password: formulario.password,
        });
        setMensaje("User created successfully.");
      } else {
        await usuariosApi.modificarUsuario(editandoId, {
          nombre: formulario.nombre.trim(),
          perfil: formulario.perfil,
          idSede,
        });
        setMensaje("User updated successfully.");
      }
      cerrarFormulario();
      await cargarUsuarios();
    } catch (err) {
      setError(getApiErrorMessage(err, "The user could not be saved."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleCambiarEstado(usuario: Usuario) {
    const nuevoEstado: Estado = usuario.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (
      nuevoEstado === "INACTIVO" &&
      !(await confirmar({
        titulo: `Deactivate ${usuario.nombre}?`,
        mensaje: "They will not be able to sign in until you activate them again. Their history is kept.",
        textoConfirmar: "Deactivate user",
        peligro: true,
      }))
    ) {
      return;
    }
    setAccionEnCurso(usuario.idUsuario);
    setError(null);
    try {
      await usuariosApi.cambiarEstadoUsuario(usuario.idUsuario, nuevoEstado);
      setMensaje(
        nuevoEstado === "ACTIVO" ? "User activated." : "User deactivated."
      );
      await cargarUsuarios();
    } catch (err) {
      setError(getApiErrorMessage(err, "The user status could not be changed."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleDesbloquear(usuario: Usuario) {
    setAccionEnCurso(usuario.idUsuario);
    setError(null);
    try {
      await authApi.desbloquearUsuario(usuario.idUsuario);
      setMensaje(`${usuario.codigoUsuario} was unlocked.`);
      await cargarUsuarios();
    } catch (err) {
      setError(getApiErrorMessage(err, "The user could not be unlocked."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  function abrirCambioPassword(usuario: Usuario) {
    setFilaPassword(usuario.idUsuario);
    setNuevaPassword("");
    setError(null);
    setMensaje(null);
  }

  async function handleGuardarPassword(usuario: Usuario) {
    if (nuevaPassword.trim().length < 8) {
      setError("The new password must be at least 8 characters long.");
      return;
    }
    setAccionEnCurso(usuario.idUsuario);
    setError(null);
    try {
      await authApi.cambiarPasswordDeTercero(usuario.idUsuario, nuevaPassword);
      setMensaje(`Password for ${usuario.codigoUsuario} updated.`);
      setFilaPassword(null);
      setNuevaPassword("");
    } catch (err) {
      setError(getApiErrorMessage(err, "The password could not be changed."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h1 className="page-title">Users</h1>
          {!mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + New user
            </button>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        <div className="toolbar">
          <div className="field field-busqueda">
            <label htmlFor="busqueda">Search</label>
            <input
              id="busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Name or code, e.g. SE01-CAJ"
            />
          </div>
          <div className="field">
            <label htmlFor="filtroPerfil">Role</label>
            <select
              id="filtroPerfil"
              value={filtroPerfil}
              onChange={(e) => setFiltroPerfil(e.target.value as Perfil | "")}
            >
              <option value="">All</option>
              {PERFILES.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETAS_PERFIL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filtroEstado">Status</label>
            <select
              id="filtroEstado"
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
            <h2 className="subform-title">{editandoId === null ? "New user" : "Edit user"}</h2>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombre">Name</label>
                <input
                  id="nombre"
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="John Smith"
                />
              </div>
              <div className="field">
                <label htmlFor="perfil">Role</label>
                <select
                  id="perfil"
                  value={formulario.perfil}
                  onChange={(e) => handleCambiarPerfil(e.target.value as Perfil)}
                >
                  {PERFILES.map((p) => (
                    <option key={p} value={p}>
                      {ETIQUETAS_PERFIL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="idSede">Location</label>
                <select
                  id="idSede"
                  value={formulario.idSede}
                  onChange={(e) => setFormulario((f) => ({ ...f, idSede: e.target.value }))}
                  disabled={formulario.perfil === "ADMINISTRADOR"}
                >
                  <option value="">
                    {formulario.perfil === "ADMINISTRADOR" ? "Not applicable" : "Select a location"}
                  </option>
                  {sedes.filter((x) => x.estado === "ACTIVO").map((s) => (
                    <option key={s.idSede} value={s.idSede}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {editandoId === null && (
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={formulario.password}
                    onChange={(e) => setFormulario((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 8 characters"
                  />
                </div>
              )}
            </div>
            {editandoId === null && (
              <p className="field-hint">
                The user code is generated automatically on save (e.g. SE01-CAJ-001).
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
        ) : usuarios.length === 0 ? (
          <p className="empty-state">No users match the search.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Role</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <Fragment key={usuario.idUsuario}>
                  <tr>
                    <td className="texto-suave">{usuario.codigoUsuario}</td>
                    <td className="celda-titulo">
                      {usuario.nombre}
                      {usuario.idUsuario === usuarioActual?.idUsuario && <span className="texto-suave"> (you)</span>}
                    </td>
                    <td>{usuario.nombreSede ?? "All"}</td>
                    <td>{ETIQUETAS_PERFIL[usuario.perfil]}</td>
                    <td>
                      <span className={`badge ${usuario.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                        {etiquetaEstado(usuario.estado)}
                      </span>{" "}
                      {usuario.bloqueado && <span className="badge badge-danger">Locked</span>}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-link"
                          onClick={() => abrirEdicion(usuario)}
                          disabled={accionEnCurso === usuario.idUsuario}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-link"
                          onClick={() => abrirCambioPassword(usuario)}
                          disabled={accionEnCurso === usuario.idUsuario}
                        >
                          Password
                        </button>
                        {usuario.bloqueado && (
                          <button
                            className="btn-link"
                            onClick={() => void handleDesbloquear(usuario)}
                            disabled={accionEnCurso === usuario.idUsuario}
                          >
                            Unlock
                          </button>
                        )}
                        {usuario.idUsuario !== usuarioActual?.idUsuario && (
                          <button
                            className={`btn-link ${usuario.estado === "ACTIVO" ? "danger" : ""}`}
                            onClick={() => void handleCambiarEstado(usuario)}
                            disabled={accionEnCurso === usuario.idUsuario}
                          >
                            {usuario.estado === "ACTIVO" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {filaPassword === usuario.idUsuario && (
                    <tr>
                      <td colSpan={6}>
                        <div className="row-subform row-subform-fila">
                          <div className="inline-form">
                            <div className="field">
                              <label htmlFor={`nueva-password-${usuario.idUsuario}`}>
                                New password for {usuario.codigoUsuario}
                              </label>
                              <input
                                id={`nueva-password-${usuario.idUsuario}`}
                                type="password"
                                value={nuevaPassword}
                                onChange={(e) => setNuevaPassword(e.target.value)}
                                placeholder="At least 8 characters"
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => void handleGuardarPassword(usuario)}
                              disabled={accionEnCurso === usuario.idUsuario}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setFilaPassword(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
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
