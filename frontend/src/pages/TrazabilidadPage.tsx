import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "../api/client";
import * as sedesApi from "../api/sedes";
import * as trazabilidadApi from "../api/trazabilidad";
import * as usuariosApi from "../api/usuarios";
import type { EventoTrazabilidad, Sede, Usuario } from "../api/types";
import { fecha, hora, hoyBogota } from "../utils/format";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { describirEvento, detalleLegible, infoEvento, tiposPorCategoria } from "../utils/trazabilidad";
import { Aviso } from "../components/Aviso";

/** Datos adicionales del evento (valores anterior/nuevo, montos, motivo...) en etiquetas legibles. */
function DetalleEvento({ evento }: { evento: EventoTrazabilidad }) {
  const datos = detalleLegible(evento);
  if (datos.length === 0) return null;
  return (
    <details className="detalle-desplegable">
      <summary>Ver datos</summary>
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
      setError(getApiErrorMessage(err, "No se pudo consultar la trazabilidad."));
    } finally {
      setCargando(false);
    }
  }, [idUsuario, idSede, tipoEvento, desde, hasta]);

  useCargaConFiltros(cargar);

  useEffect(() => {
    usuariosApi.listarUsuarios().then(setUsuarios).catch(() => undefined);
    sedesApi.listarSedes().then(setSedes).catch(() => undefined);
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Trazabilidad</h1>
      </div>

      <div className="toolbar">
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
          <label htmlFor="tipoTraza">¿Qué pasó?</label>
          <select id="tipoTraza" value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}>
            <option value="">Todos</option>
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
          <label htmlFor="desdeTraza">Desde</label>
          <input id="desdeTraza" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hastaTraza">Hasta</label>
          <input id="hastaTraza" type="date" max={hoyBogota()} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : eventos.length === 0 ? (
        <p className="empty-state">No hay eventos que coincidan con los filtros.</p>
      ) : (
        <>
          <p className="field-hint nota-lista">
            {eventos.length >= 250
              ? "Se muestran los 250 eventos más recientes. Usa los filtros para encontrar algo más antiguo."
              : `${eventos.length} evento${eventos.length === 1 ? "" : "s"}.`}
          </p>
          <div className="table-scroll">
            <table className="tabla-apilada tabla-traza">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Quién</th>
                  <th>Qué pasó</th>
                  <th>Sede</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => {
                  const info = infoEvento(ev.tipoEvento);
                  return (
                    <tr key={ev.idEvento}>
                      <td data-label="Cuándo" className="celda-fecha">
                        <span>{fecha(ev.fechaHora)}</span>
                        <span className="texto-suave">{hora(ev.fechaHora)}</span>
                      </td>
                      <td data-label="Quién" className="celda-quien">
                        {ev.codigoUsuario ? (
                          <>
                            <span>{ev.nombreUsuario}</span>
                            <span className="texto-suave">{ev.codigoUsuario}</span>
                          </>
                        ) : (
                          "Sistema"
                        )}
                      </td>
                      <td data-label="Qué pasó">
                        <span className={`evento-etiqueta evento-${info.tono}`}>{info.etiqueta}</span>
                        <div>{describirEvento(ev)}</div>
                        <DetalleEvento evento={ev} />
                      </td>
                      <td data-label="Sede">{ev.nombreSede ?? "—"}</td>
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
