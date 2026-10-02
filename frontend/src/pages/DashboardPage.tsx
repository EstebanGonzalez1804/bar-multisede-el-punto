import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as mesasApi from "../api/mesas";
import * as inventarioApi from "../api/inventario";
import * as recepcionesApi from "../api/recepciones";
import { Icon, ICONS } from "../components/icons";
import { ETIQUETAS_PERFIL } from "../api/types";
import type { ItemInventario, Mesa } from "../api/types";

function fechaHoyISO(): string {
  // yyyy-mm-dd en la zona horaria local del navegador, no UTC (evita que
  // cerca de medianoche "hoy" se corra un día).
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * Los indicadores de esta pantalla salen todos de endpoints que ya existen
 * (mesas, inventario, recepciones) — no se agregó ningún endpoint nuevo para
 * esto. No se incluye un feed de "actividad reciente" (trazabilidad) porque
 * esa tabla hoy no tiene ningún endpoint de lectura expuesto — se puede
 * agregar en un siguiente ajuste si se quiere ese panel con datos reales,
 * en vez de inventar datos que no existen.
 */
export function DashboardPage() {
  const { usuario } = useAuth();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [recepcionesHoy, setRecepcionesHoy] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const hoy = fechaHoyISO();
      const [mesasRes, inventarioRes, recepcionesRes] = await Promise.allSettled([
        mesasApi.listarMesas(),
        inventarioApi.listarInventario(),
        recepcionesApi.listarRecepciones({ desde: hoy, hasta: hoy }),
      ]);
      if (!activo) return;
      if (mesasRes.status === "fulfilled") setMesas(mesasRes.value);
      if (inventarioRes.status === "fulfilled") setInventario(inventarioRes.value);
      if (recepcionesRes.status === "fulfilled") setRecepcionesHoy(recepcionesRes.value.length);
      setCargando(false);
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, []);

  const ocupadas = mesas.filter((m) => m.estado === "OCUPADA").length;
  const totalMesas = mesas.filter((m) => m.estado !== "INACTIVA").length;
  const agotados = inventario.filter((i) => i.cantidadDisponible === 0);
  const mesasOcupadas = mesas.filter((m) => m.estado === "OCUPADA");

  const primerNombre = usuario?.nombre?.split(" ")[0] ?? "";

  return (
    <div>
      <h1 className="dashboard-heading">Hola, {primerNombre}</h1>
      <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
        {usuario ? ETIQUETAS_PERFIL[usuario.perfil] : ""}
        {usuario?.idSede ? " · tu sede" : " · todas las sedes"} — esto es lo que está pasando ahora.
      </p>

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-icon" style={{ background: "#e3ece8", color: "#173a33" }}>
                <Icon path={ICONS.mesas} size={19} strokeWidth={1.9} />
              </div>
              <div className="kpi-card-value">
                {ocupadas} / {totalMesas}
              </div>
              <div className="kpi-card-label">Mesas ocupadas</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-icon" style={{ background: "#f6e0da", color: "#8e2f1e" }}>
                <Icon path={ICONS.warning} size={19} strokeWidth={1.9} />
              </div>
              <div className="kpi-card-value">{agotados.length}</div>
              <div className="kpi-card-label">Productos agotados</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-icon" style={{ background: "#f5e7c8", color: "#6e4a05" }}>
                <Icon path={ICONS.recepciones} size={19} strokeWidth={1.9} />
              </div>
              <div className="kpi-card-value">{recepcionesHoy ?? "—"}</div>
              <div className="kpi-card-label">Recepciones hoy</div>
            </div>
          </div>

          <div className="dashboard-panels">
            <div className="panel" style={{ padding: 0, marginBottom: 0 }}>
              <div className="dashboard-panel-title">Mesas ocupadas ahora</div>
              {mesasOcupadas.length === 0 ? (
                <p className="empty-state" style={{ padding: "13px 22px" }}>
                  No hay mesas ocupadas en este momento.
                </p>
              ) : (
                mesasOcupadas.map((m) => (
                  <div className="dashboard-panel-row" key={m.idMesa}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.identificador}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{m.nombreSede}</span>
                  </div>
                ))
              )}
            </div>

            <div className="panel" style={{ padding: 0, marginBottom: 0 }}>
              <div className="dashboard-panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Productos agotados</span>
                {agotados.length > 0 && <span className="badge badge-danger">{agotados.length}</span>}
              </div>
              {agotados.length === 0 ? (
                <p className="empty-state" style={{ padding: "13px 22px" }}>
                  No hay productos agotados.
                </p>
              ) : (
                agotados.map((item) => (
                  <div className="dashboard-panel-row" key={`${item.idProducto}-${item.idSede}`}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.nombreProducto}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.nombreSede}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
