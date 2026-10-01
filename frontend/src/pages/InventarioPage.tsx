import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as inventarioApi from "../api/inventario";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import { MOTIVOS_AJUSTE } from "../api/types";
import type { ItemInventario, MotivoAjuste, Sede } from "../api/types";

/** HU-020 (consulta) + HU-022 (ajuste) — Inventario por sede. */
export function InventarioPage() {
  const { usuario } = useAuth();
  const puedeAjustar = usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO";
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [items, setItems] = useState<ItemInventario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [filtroSede, setFiltroSede] = useState("");

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idProductoAjuste, setIdProductoAjuste] = useState("");
  const [idSedeAjuste, setIdSedeAjuste] = useState("");
  const [cantidadAjuste, setCantidadAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState<MotivoAjuste | "">("");
  const [guardando, setGuardando] = useState(false);

  async function cargarInventario() {
    setCargando(true);
    setError(null);
    try {
      const data = await inventarioApi.listarInventario(filtroSede ? Number(filtroSede) : undefined);
      setItems(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cargar el inventario."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarInventario();
    if (esAdministrador) {
      sedesApi.listarSedes().then(setSedes).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiltrar(e: FormEvent) {
    e.preventDefault();
    void cargarInventario();
  }

  function abrirFormulario(item?: ItemInventario) {
    setIdProductoAjuste(item ? String(item.idProducto) : "");
    setIdSedeAjuste(item ? String(item.idSede) : esAdministrador ? "" : String(usuario?.idSede ?? ""));
    setCantidadAjuste("");
    setMotivoAjuste("");
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cantidad = Number(cantidadAjuste);
    if (!idProductoAjuste) {
      setError("Debes indicar el producto.");
      return;
    }
    if (esAdministrador && !idSedeAjuste) {
      setError("Debes seleccionar una sede.");
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      setError("La cantidad del ajuste debe ser un entero distinto de cero (usa un número negativo para restar).");
      return;
    }
    if (!motivoAjuste) {
      setError("Debes seleccionar un motivo.");
      return;
    }

    setGuardando(true);
    try {
      await inventarioApi.registrarAjuste({
        idProducto: Number(idProductoAjuste),
        idSede: Number(idSedeAjuste || usuario?.idSede),
        cantidadAjuste: cantidad,
        motivo: motivoAjuste,
      });
      setMensaje("Ajuste de inventario registrado correctamente.");
      cerrarFormulario();
      await cargarInventario();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo registrar el ajuste."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Inventario</h2>
          {puedeAjustar && !mostrarFormulario && (
            <button className="btn-secondary" onClick={() => abrirFormulario()}>
              + Registrar ajuste
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {mensaje && !error && <div className="alert alert-success">{mensaje}</div>}

        {mostrarFormulario && (
          <form className="row-subform" onSubmit={handleSubmit}>
            <h3 style={{ marginTop: 0 }}>Nuevo ajuste de inventario</h3>
            <div className="inline-form">
              <div className="field">
                <label htmlFor="productoAjuste">Producto</label>
                <select
                  id="productoAjuste"
                  value={idProductoAjuste && idSedeAjuste ? `${idProductoAjuste}-${idSedeAjuste}` : ""}
                  onChange={(e) => {
                    const [idProducto, idSede] = e.target.value.split("-");
                    setIdProductoAjuste(idProducto ?? "");
                    if (esAdministrador) setIdSedeAjuste(idSede ?? "");
                  }}
                >
                  <option value="">Selecciona un producto</option>
                  {items.map((item) => (
                    <option key={`${item.idProducto}-${item.idSede}`} value={`${item.idProducto}-${item.idSede}`}>
                      {item.codigoProducto} — {item.nombreProducto}
                      {esAdministrador ? ` (${item.nombreSede})` : ""} — disponible: {item.cantidadDisponible}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ maxWidth: 160 }}>
                <label htmlFor="cantidadAjuste">Cantidad (+/-)</label>
                <input
                  id="cantidadAjuste"
                  type="number"
                  step={1}
                  value={cantidadAjuste}
                  onChange={(e) => setCantidadAjuste(e.target.value)}
                  placeholder="-2"
                />
              </div>
              <div className="field">
                <label htmlFor="motivoAjuste">Motivo</label>
                <select
                  id="motivoAjuste"
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value as MotivoAjuste)}
                >
                  <option value="">Selecciona un motivo</option>
                  {MOTIVOS_AJUSTE.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="field-hint">
              Usa un número positivo para sumar existencia (p. ej. un conteo físico mayor al registrado) y uno
              negativo para restarla (pérdida, daño, rotura). El ajuste se aplica de inmediato, sin aprobación.
            </p>
            <div className="table-actions">
              <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar ajuste"}
              </button>
              <button type="button" className="btn-secondary" onClick={cerrarFormulario}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {esAdministrador && (
          <form className="toolbar" onSubmit={handleFiltrar}>
            <div className="field">
              <label htmlFor="filtroSedeInventario">Sede</label>
              <select id="filtroSedeInventario" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
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

        {cargando ? (
          <p className="empty-state">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="empty-state">No hay productos para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Tipo</th>
                {esAdministrador && <th>Sede</th>}
                <th>Disponible</th>
                <th>Estado</th>
                {puedeAjustar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.idProducto}-${item.idSede}`}>
                  <td>{item.codigoProducto}</td>
                  <td>{item.nombreProducto}</td>
                  <td>{item.nombreTipoProducto}</td>
                  {esAdministrador && <td>{item.nombreSede}</td>}
                  <td>{item.cantidadDisponible}</td>
                  <td>
                    {item.cantidadDisponible === 0 ? (
                      <span className="badge badge-danger">Agotado</span>
                    ) : (
                      <span className="badge badge-success">Disponible</span>
                    )}
                    {item.estadoProducto === "INACTIVO" && (
                      <span className="badge badge-muted" style={{ marginLeft: "0.4rem" }}>
                        Producto inactivo
                      </span>
                    )}
                  </td>
                  {puedeAjustar && (
                    <td>
                      <button className="btn-link" onClick={() => abrirFormulario(item)}>
                        Ajustar
                      </button>
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
