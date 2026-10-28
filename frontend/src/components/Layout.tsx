import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon, ICONS } from "./icons";
import { LogoMark, LogoWordmark } from "./Logo";
import { ETIQUETAS_PERFIL, type Perfil } from "../api/types";

interface ItemMenu {
  to: string;
  etiqueta: string;
  icono: string;
  perfiles?: Perfil[];
  end?: boolean;
}

const ADMIN_CAJERO: Perfil[] = ["ADMINISTRADOR", "CAJERO"];
const SOLO_ADMIN: Perfil[] = ["ADMINISTRADOR"];

/**
 * Menú en una sola lista, sin encabezados de grupo, para que quepa completo
 * en pantalla sin desplazarse. El orden agrupa por área de trabajo (operación,
 * abastecimiento, catálogo, administración). Cada perfil ve solo lo que le
 * corresponde; las rutas siguen protegidas igual en App.tsx y en el backend.
 */
const ITEMS: ItemMenu[] = [
  { to: "/", etiqueta: "Home", icono: ICONS.inicio, end: true },
  { to: "/mesas", etiqueta: "Tables", icono: ICONS.mesas },
  { to: "/pedidos", etiqueta: "Orders", icono: ICONS.pedidos },
  { to: "/cobros", etiqueta: "Payments", icono: ICONS.cobros, perfiles: ADMIN_CAJERO },
  { to: "/inventario", etiqueta: "Inventory", icono: ICONS.inventario },
  { to: "/recepciones", etiqueta: "Receipts", icono: ICONS.recepciones, perfiles: ADMIN_CAJERO },
  { to: "/proveedores", etiqueta: "Suppliers", icono: ICONS.proveedores, perfiles: ADMIN_CAJERO },
  { to: "/productos", etiqueta: "Products", icono: ICONS.productos },
  { to: "/tipos-producto", etiqueta: "Product types", icono: ICONS.tiposProducto },
  { to: "/reportes", etiqueta: "Reports", icono: ICONS.reportes, perfiles: ADMIN_CAJERO },
  { to: "/usuarios", etiqueta: "Users", icono: ICONS.usuarios, perfiles: SOLO_ADMIN },
  { to: "/sedes", etiqueta: "Locations", icono: ICONS.sedes, perfiles: SOLO_ADMIN },
  { to: "/trazabilidad", etiqueta: "Audit trail", icono: ICONS.trazabilidad, perfiles: SOLO_ADMIN },
];

/** Título de la pestaña del navegador según la sección. */
const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, "Home"],
  [/^\/mesas/, "Tables"],
  [/^\/pedidos\/mesa\//, "Table order"],
  [/^\/pedidos/, "Orders"],
  [/^\/cobros/, "Payments"],
  [/^\/cobro\//, "Payment"],
  [/^\/cuenta\//, "Bill"],
  [/^\/inventario/, "Inventory"],
  [/^\/recepciones/, "Receipts"],
  [/^\/proveedores/, "Suppliers"],
  [/^\/productos/, "Products"],
  [/^\/tipos-producto/, "Product types"],
  [/^\/reportes/, "Reports"],
  [/^\/usuarios/, "Users"],
  [/^\/sedes/, "Locations"],
  [/^\/trazabilidad/, "Audit trail"],
  [/^\/cambiar-password/, "My password"],
];

function inicialesDe(nombre: string | undefined): string {
  if (!nombre) return "";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Layout() {
  const { usuario, cerrarSesion, segundosParaCierre } = useAuth();
  // En pantallas angostas el menú entra/sale (off-canvas) con este botón;
  // en escritorio queda fijo a la izquierda (ver styles.css).
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuAbierto(false);
    const titulo = TITULOS.find(([re]) => re.test(location.pathname))?.[1];
    document.title = titulo ? `${titulo} · El Punto` : "El Punto — Operations Management";
  }, [location.pathname]);

  const perfil = usuario?.perfil;
  const items = ITEMS.filter((i) => !i.perfiles || (perfil && i.perfiles.includes(perfil)));

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={menuAbierto ? "Close menu" : "Open menu"}
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <Icon path={menuAbierto ? ICONS.close : ICONS.menu} size={22} strokeWidth={2} />
        </button>
        <div className="topbar-title">
          <LogoMark size={22} />
          <LogoWordmark size={20} />
        </div>
      </header>

      {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />}

      <aside className={`sidebar${menuAbierto ? " open" : ""}`}>
        <div className="sidebar-brand">
          <LogoMark size={26} />
          <LogoWordmark size={24} />
        </div>

        <nav className="sidebar-nav" aria-label="Main menu">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              <Icon path={i.icono} />
              <span>{i.etiqueta}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {inicialesDe(usuario?.nombre)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{usuario?.nombre}</div>
              <div className="sidebar-user-role">
                {usuario ? ETIQUETAS_PERFIL[usuario.perfil] : ""}
                {usuario?.codigoUsuario ? ` · ${usuario.codigoUsuario}` : ""}
              </div>
            </div>
          </div>
          <div className="sidebar-footer-acciones">
            <NavLink to="/cambiar-password" className="btn-sidebar">
              <Icon path={ICONS.password} size={15} strokeWidth={2} />
              My password
            </NavLink>
            <button className="btn-sidebar" onClick={() => void cerrarSesion()}>
              <Icon path={ICONS.logout} size={15} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <main className="content">
          <Outlet />
        </main>
      </div>

      {segundosParaCierre !== null && (
        <div className="aviso-inactividad" role="alert" aria-live="assertive">
          <strong>Your session will close in {segundosParaCierre} s due to inactivity.</strong>
          <span>Move the mouse, tap the screen or press a key to stay signed in.</span>
        </div>
      )}
    </div>
  );
}
