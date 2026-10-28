import { useEffect, useState, type FormEvent } from "react";
import * as sedesApi from "../api/sedes";
import { getApiErrorMessage } from "../api/client";
import type { Sede } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";
import { etiquetaEstado } from "../utils/format";

/**
 * HU-010 — Creación y parametrización de sedes (crear y modificar nombre y
 * dirección; el código SE01, SE02... es fijo porque arma los códigos de
 * usuarios y pedidos). Inactivación: ajuste acordado con el cliente.
 */
export function SedesPage() {
  const confirmar = useConfirmar();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);

  async function cargarSedes() {
    setCargando(true);
    try {
      setSedes(await sedesApi.listarSedes());
    } catch (err) {
      setError(getApiErrorMessage(err, "Locations could not be loaded."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarSedes();
  }, []);

  function abrirCreacion() {
    setEditandoId(null);
    setNombre("");
    setDireccion("");
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function abrirEdicion(sede: Sede) {
    setEditandoId(sede.idSede);
    setNombre(sede.nombre);
    setDireccion(sede.direccion);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditandoId(null);
  }

  async function handleCambiarEstado(sede: Sede) {
    if (
      sede.estado === "ACTIVO" &&
      !(await confirmar({
        titulo: `Deactivate ${sede.nombre}?`,
        mensaje:
          "Orders cannot be opened, tables created or receipts recorded at this location. It is only possible if it has no occupied tables or unpaid bills. Its history is kept.",
        textoConfirmar: "Deactivate location",
        peligro: true,
      }))
    ) {
      return;
    }
    setError(null);
    setMensaje(null);
    try {
      if (sede.estado === "ACTIVO") {
        await sedesApi.inactivarSede(sede.idSede);
        setMensaje(`${sede.nombre} deactivated. Its history is kept.`);
      } else {
        await sedesApi.activarSede(sede.idSede);
        setMensaje(`${sede.nombre} activated.`);
      }
      await cargarSedes();
    } catch (err) {
      setError(getApiErrorMessage(err, "The location status could not be changed."));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // CA-02: campos obligatorios.
    if (!nombre.trim() || !direccion.trim()) {
      setError("Name and address are required.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId === null) {
        const sede = await sedesApi.crearSede(nombre.trim(), direccion.trim());
        setMensaje(`${sede.nombre} created with code ${sede.codigoSede}.`);
      } else {
        await sedesApi.modificarSede(editandoId, nombre.trim(), direccion.trim());
        setMensaje("Location updated.");
      }
      cerrarFormulario();
      await cargarSedes();
    } catch (err) {
      setError(getApiErrorMessage(err, "The location could not be saved."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Locations</h1>
        {!mostrarFormulario && (
          <button className="btn-secondary" onClick={abrirCreacion}>
            + New location
          </button>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

      {mostrarFormulario && (
        <form ref={formRef} className="row-subform" onSubmit={handleSubmit}>
          <h2 className="subform-title">{editandoId === null ? "New location" : "Edit location"}</h2>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="nombre">Name</label>
              <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sede Centro" />
            </div>
            <div className="field">
              <label htmlFor="direccion">Address</label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle 10 # 5-20"
              />
            </div>
          </div>
          {editandoId === null && <p className="field-hint">The location code (SE01, SE02…) is assigned automatically.</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Saving..." : editandoId === null ? "Create location" : "Save changes"}
            </button>
            <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="empty-state">Loading...</p>
      ) : sedes.length === 0 ? (
        <p className="empty-state">There are no registered locations yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Address</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sedes.map((sede) => (
                <tr key={sede.idSede}>
                  <td className="texto-suave">{sede.codigoSede}</td>
                  <td className="celda-titulo">{sede.nombre}</td>
                  <td>{sede.direccion}</td>
                  <td>
                    <span className={`badge ${sede.estado === "ACTIVO" ? "badge-success" : "badge-muted"}`}>
                      {etiquetaEstado(sede.estado)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-link" onClick={() => abrirEdicion(sede)}>
                        Edit
                      </button>
                      <button
                        className={`btn-link ${sede.estado === "ACTIVO" ? "danger" : ""}`}
                        onClick={() => void handleCambiarEstado(sede)}
                      >
                        {sede.estado === "ACTIVO" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
