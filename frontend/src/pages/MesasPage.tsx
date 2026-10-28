import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as mesasApi from "../api/mesas";
import * as pedidosApi from "../api/pedidos";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import { Icon, ICONS } from "../components/icons";
import type { Mesa, Sede } from "../api/types";
import { useConfirmar } from "../components/Confirmacion";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { etiquetaEstadoMesa } from "../utils/format";
import { Aviso } from "../components/Aviso";
import { useEnfocarAlAbrir } from "../hooks/useEnfocarAlAbrir";

/** HU-024 CA-01/CA-05 — "tiempo real" vía polling: refresca sin bloquear la
 * pantalla mientras el Mesero/Administrador la tienen abierta. */
const INTERVALO_POLLING_MS = 6000;

/**
 * Colores de sede para la vista del Administrador. Sin verde ni rojo para no
 * confundirse con los estados (libre/ocupada) ni con "Inactivar". Todos dan
 * contraste ≥ 4,5:1 con texto blanco. El color de una sede es fijo: depende
 * de su posición por id entre todas las sedes.
 */
const COLORES_SEDE = ["#2f6f9f", "#94690f", "#7a4fa3", "#b0457a", "#16707c", "#5b6b7a"];

interface FormularioMesa {
  idSede: string;
  identificador: string;
}

const FORMULARIO_VACIO: FormularioMesa = { idSede: "", identificador: "" };

export function MesasPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const confirmar = useConfirmar();
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
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(mostrarFormulario, editandoId);
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
          setError(getApiErrorMessage(err, "Tables could not be loaded."));
        }
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [filtroSede]
  );

  useCargaConFiltros(cargarMesas, 0);

  useEffect(() => {
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
      setError(getApiErrorMessage(err, "The order could not be opened."));
      setAccionEnCurso(null);
    }
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
      setError("You must select a location.");
      return;
    }
    if (!formulario.identificador.trim()) {
      setError("The table identifier is required.");
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
        setMensaje("Table created successfully.");
      } else {
        await mesasApi.modificarMesa(editandoId, datos);
        setMensaje("Table updated successfully.");
      }
      cerrarFormulario();
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "The table could not be saved."));
    } finally {
      setGuardando(false);
    }
  }

  async function handleInactivar(mesa: Mesa) {
    const ok = await confirmar({
      titulo: `Deactivate ${mesa.identificador}?`,
      mensaje: "The table no longer appears for opening orders. You can activate it again at any time.",
      textoConfirmar: "Deactivate table",
      peligro: true,
    });
    if (!ok) return;
    setAccionEnCurso(mesa.idMesa);
    setError(null);
    try {
      await mesasApi.inactivarMesa(mesa.idMesa);
      setMensaje(`${mesa.identificador} deactivated.`);
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "The table could not be deactivated."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function handleActivar(mesa: Mesa) {
    setAccionEnCurso(mesa.idMesa);
    setError(null);
    try {
      await mesasApi.activarMesa(mesa.idMesa);
      setMensaje(`${mesa.identificador} activated; it is now free.`);
      await cargarMesas();
    } catch (err) {
      setError(getApiErrorMessage(err, "The table could not be activated."));
    } finally {
      setAccionEnCurso(null);
    }
  }

  function badgeClase(estado: Mesa["estado"]) {
    // Ocupada es el estado normal de trabajo de una mesa, no un error: su
    // badge usa un tratamiento propio legible sobre la tarjeta en verde
    // botella (ver .badge-ocupada en styles.css), no el rojo de "danger"
    // que queda reservado a agotado/bloqueado/errores.
    if (estado === "LIBRE") return "badge-success";
    if (estado === "OCUPADA") return "badge-ocupada";
    return "badge-muted";
  }

  const colorSede = (idSede: number): string => {
    const ids = [...sedes.map((x) => x.idSede), ...mesas.map((m) => m.idSede)]
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a - b);
    return COLORES_SEDE[Math.max(0, ids.indexOf(idSede)) % COLORES_SEDE.length];
  };

  // Vista del Administrador: mesas agrupadas por sede (Cajero/Mesero ven una sola lista).
  const gruposSede: Array<{ idSede: number; nombre: string; mesas: Mesa[] }> = [];
  for (const m of mesas) {
    let g = gruposSede.find((x) => x.idSede === m.idSede);
    if (!g) {
      g = { idSede: m.idSede, nombre: m.nombreSede, mesas: [] };
      gruposSede.push(g);
    }
    g.mesas.push(m);
  }
  gruposSede.sort((a, b) => a.idSede - b.idSede);

  const libres = mesas.filter((m) => m.estado === "LIBRE").length;
  const ocupadas = mesas.filter((m) => m.estado === "OCUPADA").length;

  function renderMesa(mesa: Mesa, conColorSede: boolean) {
              const libre = mesa.estado === "LIBRE";
              const ocupada = mesa.estado === "OCUPADA";
              const barColor = libre
                ? "var(--color-primary)"
                : ocupada
                  ? "var(--color-primary)"
                  : "var(--color-border)";
              const color = conColorSede ? colorSede(mesa.idSede) : null;
              return (
                <div className={`mesa-card${ocupada ? " ocupada" : ""}`} key={mesa.idMesa}>
                  <div className="mesa-card-bar" style={{ background: color ?? barColor }} />
                  <div className="mesa-card-body">
                    <div className="mesa-card-top">
                      <div>
                        <div className="mesa-card-title">{mesa.identificador}</div>
                        {color ? (
                          <span className="sede-pill" style={{ background: color }}>
                            {mesa.nombreSede}
                          </span>
                        ) : (
                          <div className="mesa-card-meta">{mesa.nombreSede}</div>
                        )}
                      </div>
                      <span className={`badge ${badgeClase(mesa.estado)}`}>{etiquetaEstadoMesa(mesa.estado)}</span>
                    </div>

                    {esMesero && (
                      <>
                        <div className="mesa-card-info">
                          {libre ? "Available for a new order" : ocupada ? "Order in progress" : "Inactive table"}
                        </div>
                        {libre && (
                          <button
                            className="mesa-card-btn libre"
                            onClick={() => void handleAbrirPedido(mesa)}
                            disabled={accionEnCurso === mesa.idMesa}
                          >
                            <Icon path={ICONS.plus} size={15} strokeWidth={2.2} />
                            Open order
                          </button>
                        )}
                        {ocupada && (
                          <button
                            className="mesa-card-btn ocupada"
                            onClick={() => navigate(`/pedidos/mesa/${mesa.idMesa}`)}
                          >
                            <Icon path={ICONS.receipt} size={15} strokeWidth={2.2} />
                            View order
                          </button>
                        )}
                      </>
                    )}

                    {esAdministrador && (
                      <div className="mesa-card-actions">
                        <button
                          className="btn-link"
                          onClick={() => abrirEdicion(mesa)}
                          disabled={accionEnCurso === mesa.idMesa}
                        >
                          Edit
                        </button>
                        {mesa.estado === "INACTIVA" ? (
                          <button
                            className="btn-link"
                            onClick={() => void handleActivar(mesa)}
                            disabled={accionEnCurso === mesa.idMesa}
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            className="btn-link danger"
                            onClick={() => void handleInactivar(mesa)}
                            disabled={mesa.estado === "OCUPADA" || accionEnCurso === mesa.idMesa}
                            title={mesa.estado === "OCUPADA" ? "Only a free table can be deactivated" : undefined}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
              }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h1 className="page-title">Tables</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>Live · updates automatically</span>
            </div>
            {esAdministrador && !mostrarFormulario && (
              <button className="btn-secondary" onClick={abrirCreacion}>
                + New table
              </button>
            )}
          </div>
        </div>

        {error && <Aviso tipo="error">{error}</Aviso>}
        {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

        {esAdministrador && (
          <div className="toolbar">
            <div className="field">
              <label htmlFor="filtroSede">Location</label>
              <select id="filtroSede" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
                <option value="">All</option>
                {sedes.map((s) => (
                  <option key={s.idSede} value={s.idSede}>
                    {s.codigoSede} — {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mostrarFormulario && (
          <form ref={formRef} className="row-subform" onSubmit={handleSubmitFormulario}>
            <h2 className="subform-title">{editandoId === null ? "New table" : "Edit table"}</h2>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="idSedeMesa">Location</label>
                <select
                  id="idSedeMesa"
                  value={formulario.idSede}
                  onChange={(e) => setFormulario((f) => ({ ...f, idSede: e.target.value }))}
                >
                  <option value="">Select a location</option>
                  {sedes.filter((x) => x.estado === "ACTIVO").map((s) => (
                    <option key={s.idSede} value={s.idSede}>
                      {s.codigoSede} — {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="identificador">Identifier</label>
                <input
                  id="identificador"
                  type="text"
                  value={formulario.identificador}
                  onChange={(e) => setFormulario((f) => ({ ...f, identificador: e.target.value }))}
                  placeholder="Mesa 1"
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

        {!cargando && mesas.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span className="legend-chip">
              <span className="legend-dot" style={{ background: "var(--color-success-bg)", border: "1.5px solid var(--color-primary)" }} />
              Free · {libres}
            </span>
            <span className="legend-chip">
              <span className="legend-dot" style={{ background: "var(--color-primary)" }} />
              Occupied · {ocupadas}
            </span>
          </div>
        )}

        {cargando ? (
          <p className="empty-state">Loading...</p>
        ) : mesas.length === 0 ? (
          <p className="empty-state">There are no registered tables.</p>
        ) : (
          esAdministrador ? (
            <div>
              {gruposSede.map((g) => {
                const color = colorSede(g.idSede);
                const ocup = g.mesas.filter((m) => m.estado === "OCUPADA").length;
                return (
                  <section key={g.idSede} className="sede-grupo">
                    <h3 className="sede-grupo-titulo">
                      <i style={{ background: color }} />
                      {g.nombre}
                      <small>
                        {" "}
                        · {g.mesas.length} table{g.mesas.length === 1 ? "" : "s"} · {ocup} occupied
                      </small>
                    </h3>
                    <div className="mesas-grid">{g.mesas.map((m) => renderMesa(m, true))}</div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mesas-grid">{mesas.map((m) => renderMesa(m, false))}</div>
          )
        )}
      </div>
    </div>
  );
}
