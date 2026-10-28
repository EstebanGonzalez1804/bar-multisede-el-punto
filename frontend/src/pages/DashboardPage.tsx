import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
 * Inicio: indicadores que salen de endpoints existentes (mesas, inventario,
 * recepciones). Cada tarjeta y cada fila llevan a la pantalla donde se
 * actúa. "Agotados" cuenta solo productos activos; "Recepciones hoy" no se
 * muestra al Mesero (no las registra).
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
      const verRecepciones = usuario?.perfil !== "MESERO";
      const [mesasRes, inventarioRes, recepcionesRes] = await Promise.allSettled([
        mesasApi.listarMesas(),
        inventarioApi.listarInventario(),
        verRecepciones ? recepcionesApi.listarRecepciones({ desde: hoy, hasta: hoy }) : Promise.resolve(null),
      ]);
      if (!activo) return;
      if (mesasRes.status === "fulfilled") setMesas(mesasRes.value);
      if (inventarioRes.status === "fulfilled") setInventario(inventarioRes.value);
      if (recepcionesRes.status === "fulfilled" && recepcionesRes.value) {
        setRecepcionesHoy(recepcionesRes.value.length);
      }
      setCargando(false);
    }
    void cargar();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ocupadas = mesas.filter((m) => m.estado === "OCUPADA").length;
  const totalMesas = mesas.filter((m) => m.estado !== "INACTIVA").length;
  // Solo productos activos: uno inactivo no se vende, así que no está "agotado".
  const agotados = inventario.filter((i) => i.estadoProducto === "ACTIVO" && i.cantidadDisponible === 0);
  const esMesero = usuario?.perfil === "MESERO";
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";
  // Máximo de filas por lista en Inicio; el resto se ve en la pantalla completa.
  const MAX_FILAS = 6;
  const mesasOcupadas = mesas.filter((m) => m.estado === "OCUPADA");

  const primerNombre = usuario?.nombre?.split(" ")[0] ?? "";

  return (
    <div>
      <h1 className="dashboard-heading">Hola, {primerNombre}</h1>
      <p className="dashboard-sub">
        {usuario ? ETIQUETAS_PERFIL[usuario.perfil] : ""}
        {usuario?.idSede ? " · tu sede" : " · todas las sedes"} — esto es lo que está pasando ahora.
      </p>

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Link to="/mesas" className="kpi-card">
              <div className="kpi-card-icon kpi-icon-mesas">
                <Icon path={ICONS.mesas} size={19} strokeWidth={1.9} />
              </div>
              <div className="kpi-card-value cond num">
                {ocupadas} / {totalMesas}
              </div>
              <div className="kpi-card-label">Mesas ocupadas</div>
            </Link>

            <Link to="/inventario" className="kpi-card">
              <div className="kpi-card-icon kpi-icon-agotados">
                <Icon path={ICONS.warning} size={19} strokeWidth={1.9} />
              </div>
              <div className="kpi-card-value cond num">{agotados.length}</div>
              <div className="kpi-card-label">Productos agotados</div>
            </Link>

            {!esMesero && (
              <Link to="/recepciones" className="kpi-card">
                <div className="kpi-card-icon kpi-icon-recepciones">
                  <Icon path={ICONS.recepciones} size={19} strokeWidth={1.9} />
                </div>
                <div className="kpi-card-value cond num">{recepcionesHoy ?? "—"}</div>
                <div className="kpi-card-label">Recepciones hoy</div>
              </Link>
            )}
          </div>

          <div className="dashboard-panels">
            <div className="panel panel-lista">
              <div className="dashboard-panel-title">Mesas ocupadas ahora</div>
              {mesasOcupadas.length === 0 ? (
                <p className="empty-state dashboard-vacio">No hay mesas ocupadas en este momento.</p>
              ) : (
                <>
                  {mesasOcupadas.slice(0, MAX_FILAS).map((m) => (
                    <Link
                      className="dashboard-panel-row"
                      key={m.idMesa}
                      to={esMesero ? `/pedidos/mesa/${m.idMesa}` : "/mesas"}
                    >
                      <span className="dashboard-row-titulo">{m.identificador}</span>
                      <span className="dashboard-row-meta">{esMesero ? "Ver pedido" : m.nombreSede}</span>
                    </Link>
                  ))}
                  {mesasOcupadas.length > 0 && (
                    <Link className="dashboard-panel-row dashboard-ver-todos" to="/mesas">
                      Ver las {mesasOcupadas.length} mesas ocupadas en Mesas
                    </Link>
                  )}
                </>
              )}
            </div>

            <div className="panel panel-lista">
              <div className="dashboard-panel-title dashboard-panel-title-flex">
                <span>Productos agotados</span>
                {agotados.length > 0 && <span className="badge badge-danger">{agotados.length}</span>}
              </div>
              {agotados.length === 0 ? (
                <p className="empty-state dashboard-vacio">No hay productos agotados.</p>
              ) : (
                <>
                  {agotados.slice(0, MAX_FILAS).map((item) => (
                    <div className="dashboard-panel-row" key={`${item.idProducto}-${item.idSede}`}>
                      <span className="dashboard-row-titulo">{item.nombreProducto}</span>
                      {esAdministrador && <span className="dashboard-row-meta">{item.nombreSede}</span>}
                    </div>
                  ))}
                  {agotados.length > 0 && (
                    <Link className="dashboard-panel-row dashboard-ver-todos" to="/inventario">
                      Ver los {agotados.length} productos agotados en Inventario
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
