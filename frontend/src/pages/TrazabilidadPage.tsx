import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as sedesApi from "../api/sedes";
import * as trazabilidadApi from "../api/trazabilidad";
import * as usuariosApi from "../api/usuarios";
import type { EventoTrazabilidad, Sede, Usuario } from "../api/types";
import { fechaHora } from "../utils/format";

function formatearValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Muestra el detalle; si trae valor anterior y resultante los destaca (HU-040 CA-04). */
function DetalleEvento({ detalle }: { detalle: Record<string, unknown> | null }) {
  if (!detalle) return <span>—</span>;
  const pares = Object.entries(detalle);
  if (pares.length === 0) return <span>—</span>;
  return (
    <ul className="detalle-evento">
      {pares.map(([clave, valor]) => (
        <li key={clave}>
          <span className="detalle-clave">{clave}:</span> {formatearValor(valor)}
        </li>
      ))}
    </ul>
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
      setError(getApiErrorMessage(err, "No se pudo consultar la trazabilidad."));
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
        <h2 style={{ margin: 0 }}>Trazabilidad</h2>
      </div>

      <form className="inline-form" onSubmit={handleFiltrar} style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="usuarioTraza">Usuario</label>
          <select id="usuarioTraza" value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.idUsuario} value={u.idUsuario}>
                {u.codigoUsuario} — {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sedeTraza">Sede</label>
          <select id="sedeTraza" value={idSede} onChange={(e) => setIdSede(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map((s) => (
              <option key={s.idSede} value={s.idSede}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tipoTraza">Tipo de evento</label>
          <select id="tipoTraza" value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}>
            <option value="">Todos</option>
            {tiposEvento.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="desdeTraza">Desde</label>
          <input id="desdeTraza" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hastaTraza">Hasta</label>
          <input id="hastaTraza" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : eventos.length === 0 ? (
        <p className="empty-state">No hay eventos que coincidan con los filtros.</p>
      ) : (
        <>
          <p className="field-hint">Se muestran los 500 eventos más recientes que cumplen el filtro.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Información afectada</th>
                  <th>Sede</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.idEvento}>
                    <td>{fechaHora(ev.fechaHora)}</td>
                    <td>{ev.codigoUsuario ? `${ev.codigoUsuario} — ${ev.nombreUsuario}` : "—"}</td>
                    <td>{ev.tipoEvento}</td>
                    <td>
                      {ev.entidadAfectada}
                      {ev.idAfectado ? ` #${ev.idAfectado}` : ""}
                    </td>
                    <td>{ev.nombreSede ?? "—"}</td>
                    <td>
                      <DetalleEvento detalle={ev.detalle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
