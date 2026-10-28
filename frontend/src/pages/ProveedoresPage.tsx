import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as proveedoresApi from "../api/proveedores";
import { useAuth } from "../context/AuthContext";
import type { Estado, Proveedor } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { etiquetaEstado } from "../utils/format";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";

interface FormularioProveedor {
  nombre: string;
  informacionContacto: string;
}

const FORMULARIO_VACIO: FormularioProveedor = { nombre: "", informacionContacto: "" };

/** HU-018 — Parametrización de proveedores. Crear/modificar: solo Administrador. */
export function ProveedoresPage() {
  const confirmar = useConfirmar();
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
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);

  async function cargarProveedores() {
    setCargando(true);
    setError(null);
    try {
      const data = await proveedoresApi.listarProveedores();
      setProveedores(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Suppliers could not be loaded."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarProveedores();
  }, []);

  async function handleCambiarEstado(proveedor: Proveedor) {
    const nuevoEstado: Estado = proveedor.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (
      nuevoEstado === "INACTIVO" &&
      !(await confirmar({
        titulo: `Deactivate ${proveedor.nombre}?`,
        mensaje: "New receipts from this supplier can no longer be recorded. Its history is kept and you can activate it again.",
        textoConfirmar: "Deactivate supplier",
        peligro: true,
      }))
    ) {
      return;
    }
    setError(null);
    try {
      await proveedoresApi.cambiarEstadoProveedor(proveedor.idProveedor, nuevoEstado);
      setMensaje(nuevoEstado === "ACTIVO" ? "Supplier activated." : "Supplier deactivated.");
      await cargarProveedores();
    } catch (err) {
      setError(getApiErrorMessage(err, "The supplier status could not be changed."));
    }
  }

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
      setError("The supplier name is required.");
      return;
    }
    if (!formulario.informacionContacto.trim()) {
      setError("The contact information is required.");
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
        setMensaje("Supplier created successfully.");
      } else {
        await proveedoresApi.modificarProveedor(editandoId, datos);
        setMensaje("Supplier updated successfully.");
      }
      cerrarFormulario();
      await cargarProveedores();
    } catch (err) {
      setError(getApiErrorMessage(err, "The supplier could not be saved."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h1 className="page-title">Suppliers</h1>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + New supplier
            </button>
          )}
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        {mostrarFormulario && (
          <form ref={formRef} className="row-subform" onSubmit={handleSubmit}>
            <h2 className="subform-title">{editandoId === null ? "New supplier" : "Edit supplier"}</h2>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="nombreProveedor">Name</label>
                <input
                  id="nombreProveedor"
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="XYZ Distributors"
                />
              </div>
              <div className="field">
                <label htmlFor="contactoProveedor">Contact information</label>
                <input
                  id="contactoProveedor"
                  type="text"
                  value={formulario.informacionContacto}
                  onChange={(e) => setFormulario((f) => ({ ...f, informacionContacto: e.target.value }))}
                  placeholder="email@supplier.com / 300 123 4567"
                />
              </div>
            </div>
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
        ) : proveedores.length === 0 ? (
          <p className="empty-state">There are no registered suppliers yet.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                {esAdministrador && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.idProveedor}>
                  <td>{p.nombre}</td>
                  <td>{p.informacionContacto}</td>
                  <td>
                    <span className={`badge ${p.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                      {etiquetaEstado(p.estado)}
                    </span>
                  </td>
                  {esAdministrador && (
                    <td>
                      <div className="table-actions">
                        <button className="btn-link" onClick={() => abrirEdicion(p)}>
                          Edit
                        </button>
                        <button
                          className={`btn-link ${p.estado === "ACTIVO" ? "danger" : ""}`}
                          onClick={() => void handleCambiarEstado(p)}
                        >
                          {p.estado === "ACTIVO" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
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
