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
      setError(getApiErrorMessage(err, "No se pudieron cargar las sedes."));
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
        titulo: `¿Inactivar ${sede.nombre}?`,
        mensaje:
          "No se podrán abrir pedidos, crear mesas ni registrar recepciones en esta sede. Solo es posible si no tiene mesas ocupadas ni cuentas por cobrar. Su historial se conserva.",
        textoConfirmar: "Inactivar sede",
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
        setMensaje(`${sede.nombre} inactivada. Su historial se conserva.`);
      } else {
        await sedesApi.activarSede(sede.idSede);
        setMensaje(`${sede.nombre} activada.`);
      }
      await cargarSedes();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar el estado de la sede."));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // CA-02: campos obligatorios.
    if (!nombre.trim() || !direccion.trim()) {
      setError("Nombre y dirección son obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      if (editandoId === null) {
        const sede = await sedesApi.crearSede(nombre.trim(), direccion.trim());
        setMensaje(`${sede.nombre} creada con el código ${sede.codigoSede}.`);
      } else {
        await sedesApi.modificarSede(editandoId, nombre.trim(), direccion.trim());
        setMensaje("Sede actualizada.");
      }
      cerrarFormulario();
      await cargarSedes();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar la sede."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Sedes</h1>
        {!mostrarFormulario && (
          <button className="btn-secondary" onClick={abrirCreacion}>
            + Nueva sede
          </button>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

      {mostrarFormulario && (
        <form ref={formRef} className="row-subform" onSubmit={handleSubmit}>
          <h2 className="subform-title">{editandoId === null ? "Nueva sede" : "Editar sede"}</h2>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sede Centro" />
            </div>
            <div className="field">
              <label htmlFor="direccion">Dirección</label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle 10 # 5-20"
              />
            </div>
          </div>
          {editandoId === null && <p className="field-hint">El código de la sede (SE01, SE02…) se asigna solo.</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : editandoId === null ? "Crear sede" : "Guardar cambios"}
            </button>
            <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : sedes.length === 0 ? (
        <p className="empty-state">Aún no hay sedes registradas.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
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
                        Editar
                      </button>
                      <button
                        className={`btn-link ${sede.estado === "ACTIVO" ? "danger" : ""}`}
                        onClick={() => void handleCambiarEstado(sede)}
                      >
                        {sede.estado === "ACTIVO" ? "Inactivar" : "Activar"}
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
