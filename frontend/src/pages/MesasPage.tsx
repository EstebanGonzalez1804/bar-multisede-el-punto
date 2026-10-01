import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as mesasApi from "../api/mesas";
import * as pedidosApi from "../api/pedidos";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import type { Mesa, Sede } from "../api/types";

/** HU-024 CA-01/CA-05 — "tiempo real" vía polling: refresca sin bloquear la
 * pantalla mientras el Mesero/Administrador la tienen abierta. */
const INTERVALO_POLLING_MS = 6000;

interface FormularioMesa {
  idSede: string;
  identificador: string;
}

const FORMULARIO_VACIO: FormularioMesa = { idSede: "", identificador: "" };

export function MesasPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";
  const esMesero = usuario?.perfil === "MESERO";

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Cajero/Mesero solo ven su propia sede; el backend la fuerza igual,
  // pero el filtro aquí evita una llamada innecesaria con idSede ajeno.
  const [filtroSede, setFiltroSede] = useState<string>("");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState<FormularioMesa>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<number | null>(null);

  const cargarMesas = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      setError(null);
      try {
        const idSede = filtroSede ? Number(filtroSede) : undefined;
        const data = await mesasApi.listarMesas(idSede);
        setMesas(data);
      } catch (err) {
        // En el refresco silencioso de fondo no interrumpimos con un error
        // visible si ya había datos en pantalla; solo se reporta si falla
        // la carga inicial.
        if (!silencioso) {
          setError(getApiErrorMessage(err, "No se pudieron cargar las mesas."));
        }
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [filtroSede]
  );

  useEffect(() => {
    void cargarMesas();
    if (esAdministrador) {
      sedesApi
        .listarSedes()
        .then(setSedes)
        .catch(() => {
          /* el filtro/selector de sedes queda vacío */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HU-024 — estado de mesas en tiempo real vía polling, mientras no haya un
  // formulario o una acción en curso (para no pisarle una edición al usuario).
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (!mostrarFormulario && accionEnCurso === null) {
        void cargarMesas(true);
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [cargarMesas, mostrarFormulario, accionEnCurso]);

  async function handleAbrirPedido(mesa: Mesa) {
    setAccionEnCurso(mesa.idMesa);
    setError(null);
    try {
      await pedidosApi.abrirPedido(mesa.idMesa);
      navigate(`/pedidos/mesa/${mesa.idMesa}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo abrir el pedido."));
      setAccionEnCurso(null);
    }
  }

  function handleFiltrar(e: FormEvent) {
    e.preventDefault();
    void cargarMesas();
  }

  function abrirCreacion() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function abrirEdicion(mesa: Mesa) {
    setFormulario({ idSede: String(mesa.idSede), identificador: mesa.identificador });
    setEditandoId(mesa.idMesa);
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

    if (!formulario.idSede) {
      setError("Debes seleccionar una sede.");
      return;
    }
    if (!formulario.identificador.trim()) {
      setError("El identificador de la mesa es obligatorio.");
      return;
    }

    const datos = {
      idSede: Number(formulario.idSede),
      identificador: formulario.identificador.trim(),
    };

    setGuardando(true);
    try {
      if (editandoId === null) {
        await mesasApi.crearMesa(datos);
        setMensaje("Mesa creada correctamente.");
      } else {
        await mesasApi.modificarMesa(editandoId, datos);
        setMensaje("Mesa actualizada correctamente.");
      }
      cerrarFormulario();
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo guardar la mesa."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleInactivar(mesa: Mesa) {
    setAccionEnCurso(mesa.idMesa);
    setError(null);
    try {
      await mesasApi.inactivarMesa(mesa.idMesa);
      setMensaje(`Mesa ${mesa.identificador} inactivada.`);
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo inactivar la mesa."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleActivar(mesa: Mesa) {
    setAccionEnCurso(mesa.idMesa);
    setError(null);
    try {
      await mesasApi.activarMesa(mesa.idMesa);
      setMensaje(`Mesa ${mesa.identificador} activada (queda en estado LIBRE).`);
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo activar la mesa."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  function badgeClase(estado: Mesa["estado"]) {
    if (estado === "LIBRE") return "badge-success";
    if (estado === "OCUPADA") return "badge-danger";
    return "badge-muted";
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Mesas</h2>
          {esAdministrador && !mostrarFormulario && (
            <button className="btn-secondary" onClick={abrirCreacion}>
              + Nueva mesa
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        {esAdministrador && (
          <form className="toolbar" onSubmit={handleFiltrar}>
            <div className="field">
              <label htmlFor="filtroSede">Sede</label>
              <select id="filtroSede" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
                <option value="">Todas</option>
                {sedes.map((s) => (
                  <option key={s.idSede} value={s.idSede}>
                    {s.codigoSede} — {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Filtrar
            </button>
          </form>
        )}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmitFormulario}>
            <h3 style={{ marginTop: 0 }}>{editandoId === null ? "Nueva mesa" : "Editar mesa"}</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="idSedeMesa">Sede</label>
                <select
                  id="idSedeMesa"
                  value={formulario.idSede}
                  onChange={(e) => setFormulario((f) => ({ ...f, idSede: e.target.value }))}
                >
                  <option value="">Selecciona una sede</option>
                  {sedes.map((s) => (
                    <option key={s.idSede} value={s.idSede}>
                      {s.codigoSede} — {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="identificador">Identificador</label>
                <input
                  id="identificador"
                  type="text"
                  value={formulario.identificador}
                  onChange={(e) => setFormulario((f) => ({ ...f, identificador: e.target.value }))}
                  placeholder="Mesa 1"
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
        ) : mesas.length === 0 ? (
          <p className="empty-state">No hay mesas registradas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Sede</th>
                <th>Estado</th>
                {(esAdministrador || esMesero) && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {mesas.map((mesa) => (
                <tr key={mesa.idMesa}>
                  <td>{mesa.identificador}</td>
                  <td>{mesa.nombreSede}</td>
                  <td>
                    <span className={`badge ${badgeClase(mesa.estado)}`}>{mesa.estado}</span>
                  </td>
                  {esMesero && (
                    <td>
                      {mesa.estado === "LIBRE" && (
                        <button
                          className="btn-link"
                          onClick={() => void handleAbrirPedido(mesa)}
                          disabled={accionEnCurso === mesa.idMesa}
                        >
                          Abrir pedido
                        </button>
                      )}
                      {mesa.estado === "OCUPADA" && (
                        <button className="btn-link" onClick={() => navigate(`/pedidos/mesa/${mesa.idMesa}`)}>
                          Ver pedido
                        </button>
                      )}
                      {mesa.estado === "INACTIVA" && <span className="empty-state">—</span>}
                    </td>
                  )}
                  {esAdministrador && (
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-link"
                          onClick={() => abrirEdicion(mesa)}
                          disabled={accionEnCurso === mesa.idMesa}
                        >
                          Editar
                        </button>
                        {mesa.estado === "INACTIVA" ? (
                          <button
                            className="btn-link"
                            onClick={() => void handleActivar(mesa)}
                            disabled={accionEnCurso === mesa.idMesa}
                          >
                            Activar
                          </button>
                        ) : (
                          <button
                            className="btn-link danger"
                            onClick={() => void handleInactivar(mesa)}
                            disabled={mesa.estado === "OCUPADA" || accionEnCurso === mesa.idMesa}
                            title={mesa.estado === "OCUPADA" ? "Solo se puede inactivar una mesa libre" : undefined}
                          >
                            Inactivar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
