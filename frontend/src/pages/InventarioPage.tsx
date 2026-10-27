import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../api/client";
import * as inventarioApi from "../api/inventario";
import * as sedesApi from "../api/sedes";
import { useAuth } from "../context/AuthContext";
import { MOTIVOS_AJUSTE } from "../api/types";
import type { ItemInventario, MotivoAjuste, Sede } from "../api/types";
import { Aviso } from "../components/Aviso";
import { useConfirmar } from "../components/Confirmacion";
import { useCargaConFiltros } from "../hooks/useCargaConFiltros";

/**
 * HU-020 (consulta) + HU-022 (ajuste) — Inventario por sede.
 * Por defecto se ocultan los productos inactivos (no se venden); el
 * Administrador, con "Todas las sedes", ve el inventario agrupado por sede.
 */
export function InventarioPage() {
  const { usuario } = useAuth();
  const confirmar = useConfirmar();
  const puedeAjustar = usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO";
  const esAdministrador = usuario?.perfil === "ADMINISTRADOR";

  const [items, setItems] = useState<ItemInventario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [filtroSede, setFiltroSede] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloAgotados, setSoloAgotados] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [idProductoAjuste, setIdProductoAjuste] = useState("");
  const [idSedeAjuste, setIdSedeAjuste] = useState("");
  const [cantidadAjuste, setCantidadAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState<MotivoAjuste | "">("");
  const [guardando, setGuardando] = useState(false);
  const formularioRef = useRef<HTMLFormElement>(null);

  const cargarInventario = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setItems(await inventarioApi.listarInventario(filtroSede ? Number(filtroSede) : undefined));
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cargar el inventario."));
    } finally {
      setCargando(false);
    }
  }, [filtroSede]);

  useCargaConFiltros(cargarInventario, 0);

  useEffect(() => {
    if (esAdministrador) sedesApi.listarSedes().then(setSedes).catch(() => undefined);
  }, [esAdministrador]);

  // Al abrir el formulario desde una fila del final de la tabla, se lleva a la vista.
  useEffect(() => {
    if (mostrarFormulario) formularioRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [mostrarFormulario, idProductoAjuste]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (i) =>
        (verInactivos || i.estadoProducto === "ACTIVO") &&
        (!soloAgotados || i.cantidadDisponible === 0) &&
        (!q || i.nombreProducto.toLowerCase().includes(q) || i.codigoProducto.toLowerCase().includes(q))
    );
  }, [items, busqueda, soloAgotados, verInactivos]);

  const inactivosOcultos = items.filter((i) => i.estadoProducto !== "ACTIVO").length;

  // Administrador viendo todas las sedes: una sección por sede.
  const agrupar = esAdministrador && !filtroSede;
  const secciones = useMemo(() => {
    if (!agrupar) return [{ clave: "todo", titulo: null as string | null, items: visibles }];
    const lista: Array<{ clave: string; titulo: string | null; items: ItemInventario[] }> = [];
    for (const i of visibles) {
      let s = lista.find((x) => x.clave === String(i.idSede));
      if (!s) {
        s = { clave: String(i.idSede), titulo: i.nombreSede, items: [] };
        lista.push(s);
      }
      s.items.push(i);
    }
    return lista;
  }, [agrupar, visibles]);

  const itemAjuste = items.find((i) => String(i.idProducto) === idProductoAjuste && String(i.idSede) === idSedeAjuste);

  function abrirFormulario(item?: ItemInventario) {
    setIdProductoAjuste(item ? String(item.idProducto) : "");
    setIdSedeAjuste(item ? String(item.idSede) : esAdministrador ? "" : String(usuario?.idSede ?? ""));
    setCantidadAjuste("");
    setMotivoAjuste("");
    setMostrarFormulario(true);
    setError(null);
    setMensaje(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cantidad = Number(cantidadAjuste);
    if (!idProductoAjuste || !itemAjuste) {
      setError("Elige el producto que vas a ajustar.");
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      setError("La cantidad debe ser un entero distinto de cero (negativo para restar).");
      return;
    }
    if (!motivoAjuste) {
      setError("Elige el motivo del ajuste.");
      return;
    }
    const resultante = itemAjuste.cantidadDisponible + cantidad;
    if (resultante < 0) {
      setError(`No puedes restar más de lo disponible (${itemAjuste.cantidadDisponible}).`);
      return;
    }
    const motivo = MOTIVOS_AJUSTE.find((m) => m.value === motivoAjuste)?.label ?? motivoAjuste;
    const ok = await confirmar({
      titulo: "¿Registrar ajuste de inventario?",
      mensaje: (
        <>
          <strong>{itemAjuste.nombreProducto}</strong>
          {esAdministrador ? ` · ${itemAjuste.nombreSede}` : ""}: pasa de {itemAjuste.cantidadDisponible} a{" "}
          <strong>{resultante}</strong> unidades ({cantidad > 0 ? `+${cantidad}` : cantidad}). Motivo: {motivo}. Se aplica de
          inmediato y queda en la trazabilidad.
        </>
      ),
      textoConfirmar: "Registrar ajuste",
    });
    if (!ok) return;

    setGuardando(true);
    try {
      await inventarioApi.registrarAjuste({
        idProducto: Number(idProductoAjuste),
        idSede: Number(idSedeAjuste || usuario?.idSede),
        cantidadAjuste: cantidad,
        motivo: motivoAjuste,
      });
      setMensaje(`Ajuste registrado: ${itemAjuste.nombreProducto} queda en ${resultante} unidades.`);
      setMostrarFormulario(false);
      await cargarInventario();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo registrar el ajuste."));
    } finally {
      setGuardando(false);
    }
  }

  const cantidadNum = Number(cantidadAjuste);

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Inventario</h1>
        {puedeAjustar && !mostrarFormulario && (
          <button className="btn-secondary" onClick={() => abrirFormulario()}>
            + Registrar ajuste
          </button>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

      {mostrarFormulario && (
        <form ref={formularioRef} className="row-subform" onSubmit={handleSubmit}>
          <h2 className="subform-title">Ajuste de inventario</h2>
          <div className="inline-form">
            <div className="field field-ancho">
              <label htmlFor="productoAjuste">Producto</label>
              <select
                id="productoAjuste"
                value={idProductoAjuste && idSedeAjuste ? `${idProductoAjuste}-${idSedeAjuste}` : ""}
                onChange={(e) => {
                  const [idProducto, idSede] = e.target.value.split("-");
                  setIdProductoAjuste(idProducto ?? "");
                  setIdSedeAjuste(idSede ?? "");
                }}
              >
                <option value="">Elige un producto</option>
                {items.map((item) => (
                  <option key={`${item.idProducto}-${item.idSede}`} value={`${item.idProducto}-${item.idSede}`}>
                    {item.nombreProducto}
                    {item.estadoProducto === "INACTIVO" ? " (inactivo)" : ""}
                    {esAdministrador ? ` · ${item.nombreSede}` : ""} · hay {item.cantidadDisponible}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-corto">
              <label htmlFor="cantidadAjuste">Sumar o restar</label>
              <input
                id="cantidadAjuste"
                type="number"
                inputMode="numeric"
                step={1}
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                placeholder="p. ej. -2"
              />
            </div>
            <div className="field">
              <label htmlFor="motivoAjuste">Motivo</label>
              <select id="motivoAjuste" value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value as MotivoAjuste)}>
                <option value="">Elige un motivo</option>
                {MOTIVOS_AJUSTE.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="field-hint">
            {itemAjuste && Number.isInteger(cantidadNum) && cantidadNum !== 0
              ? `Quedará en ${itemAjuste.cantidadDisponible + cantidadNum} unidades (hoy hay ${itemAjuste.cantidadDisponible}).`
              : "Número positivo para sumar (p. ej. un conteo mayor) y negativo para restar (pérdida, daño, rotura). Se aplica de inmediato."}
          </p>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Registrar ajuste"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarFormulario(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="field field-busqueda">
          <label htmlFor="busquedaInventario">Buscar</label>
          <input
            id="busquedaInventario"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o código"
          />
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="filtroSedeInventario">Sede</label>
            <select id="filtroSedeInventario" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="">Todas</option>
              {sedes.map((s) => (
                <option key={s.idSede} value={s.idSede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={soloAgotados} onChange={(e) => setSoloAgotados(e.target.checked)} />
          Solo agotados
        </label>
        {inactivosOcultos > 0 && (
          <label className="check">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Ver productos inactivos
          </label>
        )}
      </div>

      {cargando ? (
        <p className="empty-state">Cargando...</p>
      ) : visibles.length === 0 ? (
        <p className="empty-state">No hay productos que coincidan.</p>
      ) : (
        secciones.map((sec) => (
          <section key={sec.clave} className="seccion-tabla">
            {sec.titulo && (
              <h2 className="sede-grupo-titulo">
                {sec.titulo}
                <small> · {sec.items.length} productos</small>
              </h2>
            )}
            <div className="table-scroll">
              <table className="tabla-apilada">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Código</th>
                    <th>Tipo</th>
                    {esAdministrador && !agrupar && <th>Sede</th>}
                    <th className="num">Disponible</th>
                    <th>Estado</th>
                    {puedeAjustar && (
                      <th>
                        <span className="sr-only">Acciones</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((item) => (
                    <tr key={`${item.idProducto}-${item.idSede}`}>
                      <td data-label="Producto" className="celda-titulo">
                        {item.nombreProducto}
                      </td>
                      <td data-label="Código" className="texto-suave">
                        {item.codigoProducto}
                      </td>
                      <td data-label="Tipo">{item.nombreTipoProducto}</td>
                      {esAdministrador && !agrupar && <td data-label="Sede">{item.nombreSede}</td>}
                      <td data-label="Disponible" className="num">
                        <strong>{item.cantidadDisponible}</strong>
                      </td>
                      <td data-label="Estado">
                        {item.estadoProducto === "INACTIVO" ? (
                          <span className="badge badge-muted">Producto inactivo</span>
                        ) : item.cantidadDisponible === 0 ? (
                          <span className="badge badge-danger">Agotado</span>
                        ) : (
                          <span className="badge badge-success">Disponible</span>
                        )}
                      </td>
                      {puedeAjustar && (
                        <td data-label="" className="celda-acciones">
                          <button className="btn-link" onClick={() => abrirFormulario(item)}>
                            Ajustar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
