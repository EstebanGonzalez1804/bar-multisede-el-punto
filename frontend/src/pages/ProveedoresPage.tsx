import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as proveedoresApi from "../api/proveedores";
import { useAuth } from "../context/AuthContext";
import type { Proveedor } from "../api/types";

interface FormularioProveedor {
  nombre: string;
  informacionContacto: string;
}

const FORMULARIO_VACIO: FormularioProveedor = { nombre: "", informacionContacto: "" };

/** HU-018 — Parametrización de proveedores. Crear/modificar: solo Administrador. */
export function ProveedoresPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<FormularioProveedor>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);

  async function cargarProveedores() {
    setCargando(true);
    setError(null);
    try {
      const data = await proveedoresApi.listarProveedores();
      setProveedores(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los proveedores."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarProveedores();
  }, []);

  function abrirCreacion() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function abrirEdicion(proveedor: Proveedor) {
    setFormulario({ nombre: proveedor.nombre, informacionContacto: proveedor.informacionContacto });
    setEditandoId(proveedor.idProveedor);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formulario.nombre.trim()) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }
    if (!formulario.informacionContacto.trim()) {
      setError("La información de contacto es obligatoria.");
      return;
    }

    const datos = {
      nombre: formulario.nombre.trim(),
      informacionContacto: formulario.informacionContacto.trim(),
    };

    setGuardando(true);
    try {
      if (editandoId === null) {
        await proveedoresApi.crearProveedor(datos);
        setMensaje("Proveedor creado correctamente.");
      } else {
        await proveedoresApi.modificarProveedor(editandoId, datos);
        setMensaje("Proveedor actualizado correctamente.");
      }
      cerrarFormulario();
      await cargarProveedores();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar el proveedor."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Proveedores</h2>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + Nuevo proveedor
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmit}>
            <h3 style={{ marginTop: 0 }}>{editandoId === null ? "Nuevo proveedor" : "Editar proveedor"}</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombreProveedor">Nombre</label>
                <input
                  id="nombreProveedor"
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Distribuidora XYZ"
                />
              </div>
              <div className="field">
                <label htmlFor="contactoProveedor">Información de contacto</label>
                <input
                  id="contactoProveedor"
                  type="text"
                  value={formulario.informacionContacto}
                  onChange={(e) => setFormulario((f) => ({ ...f, informacionContacto: e.target.value }))}
                  placeholder="correo@proveedor.com / 300 123 4567"
                />
              </div>
            </div>
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
        ) : proveedores.length === 0 ? (
          <p className="empty-state">Aún no hay proveedores registrados.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                {esAdministrador && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.idProveedor}>
                  <td>{p.nombre}</td>
                  <td>{p.informacionContacto}</td>
                  {esAdministrador && (
                    <td>
                      <button className="btn-link" onClick={() => abrirEdicion(p)}>
                        Editar
                      </button>
                    </td>
                  )}
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
