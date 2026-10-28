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
      setError(getApiErrorMessage(err, "Inventory could not be loaded."));
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
      setError("Choose the product you are going to adjust.");
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      setError("The quantity must be a non-zero integer (negative to subtract).");
      return;
    }
    if (!motivoAjuste) {
      setError("Choose the reason for the adjustment.");
      return;
    }
    const resultante = itemAjuste.cantidadDisponible + cantidad;
    if (resultante < 0) {
      setError(`You cannot subtract more than what is available (${itemAjuste.cantidadDisponible}).`);
      return;
    }
    const motivo = MOTIVOS_AJUSTE.find((m) => m.value === motivoAjuste)?.label ?? motivoAjuste;
    const ok = await confirmar({
      titulo: "Record inventory adjustment?",
      mensaje: (
        <>
          <strong>{itemAjuste.nombreProducto}</strong>
          {esAdministrador ? ` · ${itemAjuste.nombreSede}` : ""}: goes from {itemAjuste.cantidadDisponible} to{" "}
          <strong>{resultante}</strong> units ({cantidad > 0 ? `+${cantidad}` : cantidad}). Reason: {motivo}. It is applied
          immediately and recorded in the audit trail.
        </>
      ),
      textoConfirmar: "Record adjustment",
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
      setMensaje(`Adjustment recorded: ${itemAjuste.nombreProducto} now has ${resultante} units.`);
      setMostrarFormulario(false);
      await cargarInventario();
    } catch (err) {
      setError(getApiErrorMessage(err, "The adjustment could not be recorded."));
    } finally {
      setGuardando(false);
    }
  }

  const cantidadNum = Number(cantidadAjuste);

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="page-title">Inventory</h1>
        {puedeAjustar && !mostrarFormulario && (
          <button className="btn-secondary" onClick={() => abrirFormulario()}>
            + Record adjustment
          </button>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && !error && <Aviso tipo="exito">{mensaje}</Aviso>}

      {mostrarFormulario && (
        <form ref={formularioRef} className="row-subform" onSubmit={handleSubmit}>
          <h2 className="subform-title">Inventory adjustment</h2>
          <div className="inline-form">
            <div className="field field-ancho">
              <label htmlFor="productoAjuste">Product</label>
              <select
                id="productoAjuste"
                value={idProductoAjuste && idSedeAjuste ? `${idProductoAjuste}-${idSedeAjuste}` : ""}
                onChange={(e) => {
                  const [idProducto, idSede] = e.target.value.split("-");
                  setIdProductoAjuste(idProducto ?? "");
                  setIdSedeAjuste(idSede ?? "");
                }}
              >
                <option value="">Choose a product</option>
                {items.map((item) => (
                  <option key={`${item.idProducto}-${item.idSede}`} value={`${item.idProducto}-${item.idSede}`}>
                    {item.nombreProducto}
                    {item.estadoProducto === "INACTIVO" ? " (inactive)" : ""}
                    {esAdministrador ? ` · ${item.nombreSede}` : ""} · {item.cantidadDisponible} in stock
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-corto">
              <label htmlFor="cantidadAjuste">Add or subtract</label>
              <input
                id="cantidadAjuste"
                type="number"
                inputMode="numeric"
                step={1}
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                placeholder="e.g. -2"
              />
            </div>
            <div className="field">
              <label htmlFor="motivoAjuste">Reason</label>
              <select id="motivoAjuste" value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value as MotivoAjuste)}>
                <option value="">Choose a reason</option>
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
              ? `It will become ${itemAjuste.cantidadDisponible + cantidadNum} units (currently ${itemAjuste.cantidadDisponible}).`
              : "Positive number to add (e.g. a higher count) and negative to subtract (loss, damage, breakage). It is applied immediately."}
          </p>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Saving..." : "Record adjustment"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarFormulario(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="field field-busqueda">
          <label htmlFor="busquedaInventario">Search</label>
          <input
            id="busquedaInventario"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        {esAdministrador && (
          <div className="field">
            <label htmlFor="filtroSedeInventario">Location</label>
            <select id="filtroSedeInventario" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="">All</option>
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
          Out of stock only
        </label>
        {inactivosOcultos > 0 && (
          <label className="check">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Show inactive products
          </label>
        )}
      </div>

      {cargando ? (
        <p className="empty-state">Loading...</p>
      ) : visibles.length === 0 ? (
        <p className="empty-state">No products match.</p>
      ) : (
        secciones.map((sec) => (
          <section key={sec.clave} className="seccion-tabla">
            {sec.titulo && (
              <h2 className="sede-grupo-titulo">
                {sec.titulo}
                <small> · {sec.items.length} products</small>
              </h2>
            )}
            <div className="table-scroll">
              <table className="tabla-apilada">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Code</th>
                    <th>Type</th>
                    {esAdministrador && !agrupar && <th>Location</th>}
                    <th className="num">Available</th>
                    <th>Status</th>
                    {puedeAjustar && (
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((item) => (
                    <tr key={`${item.idProducto}-${item.idSede}`}>
                      <td data-label="Product" className="celda-titulo">
                        {item.nombreProducto}
                      </td>
                      <td data-label="Code" className="texto-suave">
                        {item.codigoProducto}
                      </td>
                      <td data-label="Type">{item.nombreTipoProducto}</td>
                      {esAdministrador && !agrupar && <td data-label="Location">{item.nombreSede}</td>}
                      <td data-label="Available" className="num">
                        <strong>{item.cantidadDisponible}</strong>
                      </td>
                      <td data-label="Status">
                        {item.estadoProducto === "INACTIVO" ? (
                          <span className="badge badge-muted">Inactive product</span>
                        ) : item.cantidadDisponible === 0 ? (
                          <span className="badge badge-danger">Out of stock</span>
                        ) : (
                          <span className="badge badge-success">Available</span>
                        )}
                      </td>
                      {puedeAjustar && (
                        <td data-label="" className="celda-acciones">
                          <button className="btn-link" onClick={() => abrirFormulario(item)}>
                            Adjust
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
