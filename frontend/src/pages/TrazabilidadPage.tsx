import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as sedesApi from "../api/sedes";
import * as trazabilidadApi from "../api/trazabilidad";
import * as usuariosApi from "../api/usuarios";
import type { EventoTrazabilidad, Sede, Usuario } from "../api/types";
import { fechaHora } from "../utils/format";
import { describirEvento, detalleLegible, infoEvento, tiposPorCategoria } from "../utils/trazabilidad";

/** Datos adicionales del evento (valores anterior/nuevo, montos, motivo...) en etiquetas legibles. */
function DetalleEvento({ evento }: { evento: EventoTrazabilidad }) {
  const datos = detalleLegible(evento);
  if (datos.length === 0) return null;
  return (
    <details className="detalle-desplegable">
      <summary>View data</summary>
      <ul className="detalle-evento">
        {datos.map((d) => (
          <li key={d.etiqueta}>
            <span className="detalle-clave">{d.etiqueta}:</span> {d.valor}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * HU-040 — Consulta de trazabilidad (solo Administrador): usuario, acción,
 * información afectada, sede, fecha y hora, con filtros por usuario, sede,
 * tipo de evento y rango de fechas.
 */
export function TrazabilidadPage() {
  const [eventos, setEventos] = useState<EventoTrazabilidad[]>([]);
  const [tiposEvento, setTiposEvento] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idUsuario, setIdUsuario] = useState("");
  const [idSede, setIdSede] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await trazabilidadApi.consultarTrazabilidad({
        idUsuario: idUsuario ? Number(idUsuario) : undefined,
        idSede: idSede ? Number(idSede) : undefined,
        tipoEvento: tipoEvento || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setEventos(data.eventos);
      setTiposEvento(data.tiposEvento);
    } catch (err) {
      setError(getApiErrorMessage(err, "The audit trail could not be loaded."));
    } finally {
      setCargando(false);
    }
  }, [idUsuario, idSede, tipoEvento, desde, hasta]);

  useEffect(() => {
    void cargar();
    // Solo al montar; los filtros se aplican con el botón Filtrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    usuariosApi.listarUsuarios().then(setUsuarios).catch(() => undefined);
    sedesApi.listarSedes().then(setSedes).catch(() => undefined);
  }, []);

  function handleFiltrar(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Audit trail</h2>
      </div>

      <form className="inline-form" onSubmit={handleFiltrar} style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="usuarioTraza">User</label>
          <select id="usuarioTraza" value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)}>
            <option value="">All</option>
            {usuarios.map((u) => (
              <option key={u.idUsuario} value={u.idUsuario}>
                {u.codigoUsuario} — {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sedeTraza">Location</label>
          <select id="sedeTraza" value={idSede} onChange={(e) => setIdSede(e.target.value)}>
            <option value="">All</option>
            {sedes.map((s) => (
              <option key={s.idSede} value={s.idSede}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tipoTraza">What happened?</label>
          <select id="tipoTraza" value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}>
            <option value="">All</option>
            {tiposPorCategoria(tiposEvento).map((g) => (
              <optgroup key={g.categoria} label={g.categoria}>
                {g.tipos.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.etiqueta}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="desdeTraza">From</label>
          <input id="desdeTraza" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hastaTraza">To</label>
          <input id="hastaTraza" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? (
        <p className="empty-state">Loading...</p>
      ) : eventos.length === 0 ? (
        <p className="empty-state">No events match the filters.</p>
      ) : (
        <>
          <p className="field-hint">
            Showing the {eventos.length} most recent events (maximum 250). Use the filters to find
            something older.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date and time</th>
                  <th>Who</th>
                  <th>What happened</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => {
                  const info = infoEvento(ev.tipoEvento);
                  return (
                    <tr key={ev.idEvento}>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaHora(ev.fechaHora)}</td>
                      <td>
                        {ev.codigoUsuario ? (
                          <>
                            {ev.nombreUsuario}
                            <br />
                            <small className="detalle-clave">{ev.codigoUsuario}</small>
                          </>
                        ) : (
                          "System"
                        )}
                      </td>
                      <td>
                        <span className={`evento-etiqueta evento-${info.tono}`}>{info.etiqueta}</span>
                        <div>{describirEvento(ev)}</div>
                        <DetalleEvento evento={ev} />
                      </td>
                      <td>{ev.nombreSede ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
