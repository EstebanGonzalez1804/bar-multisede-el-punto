import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import * as pedidosApi from "../api/pedidos";
import * as sedesApi from "../api/sedes";
import type { ResumenPedido, Sede } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useAuth } from "../context/AuthContext";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";
import { fechaHora, pesos } from "../utils/format";

type Vista = "PENDIENTE" | "PAGADO" | "TODOS";

const VISTAS: { value: Vista; etiqueta: string }[] = [
  { value: "PENDIENTE", etiqueta: "En curso" },
  { value: "PAGADO", etiqueta: "Pagados" },
  { value: "TODOS", etiqueta: "Todos" },
];

/** Un solo estado legible que combina estado del pedido y estado de pago. */
function estadoCombinado(p: ResumenPedido): { texto: string; clase: string } {
  if (p.estadoPedido === "ABIERTO") return { texto: "Abierto", clase: "badge-success" };
  if (p.estadoPago === "PAGADO") return { texto: "Pagado", clase: "badge-muted" };
  if (p.estadoPago === "PARCIAL") return { texto: "Pago parcial", clase: "badge-warning" };
  return { texto: "Por cobrar", clase: "badge-warning" };
}

/**
 * HU-030 — Consulta de pedidos por rol y sede. Mesero y Cajero ven solo los
 * de su sede (lo garantiza el backend); el Administrador ve todas y puede
 * filtrar por sede. Por defecto se ven los pedidos en curso: los pagados no
 * se eliminan, quedan archivados y se consultan con "Pagados" o "Todos".
 */
export function PedidosPage() {
  const { usuario } = useAuth();
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";
  const esMesero = usuario?.perfil === "MESERO";
  const puedeCobrar = usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO";

  const [pedidos, setPedidos] = useState<ResumenPedido[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("PENDIENTE");
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroSede, setFiltroSede] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await pedidosApi.listarPedidos({
        estadoPedido: filtroEstadoPedido || undefined,
        estadoPago: vista,
        busqueda: filtroBusqueda.trim() || undefined,
        idSede: filtroSede ? Number(filtroSede) : undefined,
      });
      setPedidos(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar los pedidos."));
    } finally {
      setCargando(false);
    }
  }, [filtroEstadoPedido, vista, filtroBusqueda, filtroSede]);

  useCargaConFiltros(cargar);

  useEffect(() => {
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
  }, [esAdministrador]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Pedidos</h1>
        <div className="segmentado" role="radiogroup" aria-label="Qué pedidos mostrar">
          {VISTAS.map((v) => (
            <label key={v.value} className={vista === v.value ? "activo" : ""}>
              <input type="radio" name="vistaPedidos" value={v.value} checked={vista === v.value} onChange={() => setVista(v.value)} />
              {v.etiqueta}
            </label>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="field field-busqueda">
          <label htmlFor="busquedaPedido">Buscar</label>
          <input
            id="busquedaPedido"
            type="search"
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            placeholder="Mesa o n.º de pedido, p. ej. Mesa 3"
          />
        </div>
        <div className="field">
          <label htmlFor="estadoPedido">Estado del pedido</label>
          <select id="estadoPedido" value={filtroEstadoPedido} onChange={(e) => setFiltroEstadoPedido(e.target.value)}>
            <option value="">Todos</option>
            <option value="ABIERTO">Abiertos</option>
            <option value="CERRADO">Cerrados</option>
          </select>
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="sedePedido">Sede</label>
            <select id="sedePedido" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="">Todas</option>
              {sedes.map((s) => (
                <option key={s.idSede} value={s.idSede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {vista === "PENDIENTE" && (
        <p className="field-hint nota-lista">
          Los pedidos pagados no se eliminan: quedan archivados en “Pagados”.
        </p>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="empty-state">No hay pedidos que coincidan con la búsqueda.</p>
      ) : (
        <div className="table-scroll">
          <table className="tabla-apilada">
            <thead>
              <tr>
                <th>Mesa</th>
                <th>Pedido</th>
                {esAdministrador && <th>Sede</th>}
                <th>Estado</th>
                <th>Apertura</th>
                <th className="num">Total</th>
                <th className="num">Saldo</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const estado = estadoCombinado(p);
                const cerrado = p.estadoPedido === "CERRADO";
                return (
                  <tr key={p.idPedido}>
                    <td data-label="Mesa" className="celda-titulo">
                      {p.identificadorMesa}
                    </td>
                    <td data-label="Pedido">{p.identificadorPedido}</td>
                    {esAdministrador && <td data-label="Sede">{p.nombreSede}</td>}
                    <td data-label="Estado">
                      <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                    </td>
                    <td data-label="Apertura">{fechaHora(p.fechaApertura)}</td>
                    <td data-label="Total" className="num">
                      {pesos(p.total)}
                    </td>
                    <td data-label="Saldo" className="num">
                      {cerrado ? pesos(p.saldoPendiente) : "—"}
                    </td>
                    <td data-label="" className="celda-acciones">
                      <div className="table-actions">
                        {esMesero && !cerrado && (
                          <Link className="btn-link" to={`/pedidos/mesa/${p.idMesa}`}>
                            Ver pedido
                          </Link>
                        )}
                        {cerrado && (
                          <Link className="btn-link" to={`/cuenta/${p.idPedido}`}>
                            Ver cuenta
                          </Link>
                        )}
                        {puedeCobrar && cerrado && p.estadoPago !== "PAGADO" && (
                          <Link className="btn-link" to={`/cobro/${p.idPedido}`}>
                            Cobrar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
