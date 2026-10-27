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
  { to: "/", etiqueta: "Inicio", icono: ICONS.inicio, end: true },
  { to: "/mesas", etiqueta: "Mesas", icono: ICONS.mesas },
  { to: "/pedidos", etiqueta: "Pedidos", icono: ICONS.pedidos },
  { to: "/cobros", etiqueta: "Cobros", icono: ICONS.cobros, perfiles: ADMIN_CAJERO },
  { to: "/inventario", etiqueta: "Inventario", icono: ICONS.inventario },
  { to: "/recepciones", etiqueta: "Recepciones", icono: ICONS.recepciones, perfiles: ADMIN_CAJERO },
  { to: "/proveedores", etiqueta: "Proveedores", icono: ICONS.proveedores, perfiles: ADMIN_CAJERO },
  { to: "/productos", etiqueta: "Productos", icono: ICONS.productos },
  { to: "/tipos-producto", etiqueta: "Tipos de producto", icono: ICONS.tiposProducto },
  { to: "/reportes", etiqueta: "Reportes", icono: ICONS.reportes, perfiles: ADMIN_CAJERO },
  { to: "/usuarios", etiqueta: "Usuarios", icono: ICONS.usuarios, perfiles: SOLO_ADMIN },
  { to: "/sedes", etiqueta: "Sedes", icono: ICONS.sedes, perfiles: SOLO_ADMIN },
  { to: "/trazabilidad", etiqueta: "Trazabilidad", icono: ICONS.trazabilidad, perfiles: SOLO_ADMIN },
];

/** Título de la pestaña del navegador según la sección. */
const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, "Inicio"],
  [/^\/mesas/, "Mesas"],
  [/^\/pedidos\/mesa\//, "Pedido de mesa"],
  [/^\/pedidos/, "Pedidos"],
  [/^\/cobros/, "Cobros"],
  [/^\/cobro\//, "Cobro"],
  [/^\/cuenta\//, "Cuenta"],
  [/^\/inventario/, "Inventario"],
  [/^\/recepciones/, "Recepciones"],
  [/^\/proveedores/, "Proveedores"],
  [/^\/productos/, "Productos"],
  [/^\/tipos-producto/, "Tipos de producto"],
  [/^\/reportes/, "Reportes"],
  [/^\/usuarios/, "Usuarios"],
  [/^\/sedes/, "Sedes"],
  [/^\/trazabilidad/, "Trazabilidad"],
  [/^\/cambiar-password/, "Mi contraseña"],
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
    document.title = titulo ? `${titulo} · El Punto` : "El Punto — Gestión Operativa";
  }, [location.pathname]);

  const perfil = usuario?.perfil;
  const items = ITEMS.filter((i) => !i.perfiles || (perfil && i.perfiles.includes(perfil)));

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
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

        <nav className="sidebar-nav" aria-label="Menú principal">
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
              Mi contraseña
            </NavLink>
            <button className="btn-sidebar" onClick={() => void cerrarSesion()}>
              <Icon path={ICONS.logout} size={15} strokeWidth={2} />
              Cerrar sesión
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
          <strong>Tu sesión se cerrará en {segundosParaCierre} s por inactividad.</strong>
          <span>Mueve el mouse, toca la pantalla o pulsa una tecla para seguir conectado.</span>
        </div>
      )}
    </div>
  );
}
