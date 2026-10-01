import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon, ICONS } from "./icons";
import { ETIQUETAS_PERFIL } from "../api/types";

export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  // Responsive: en pantallas angostas (celular/tablet) la barra lateral se
  // comporta como un panel que entra/sale (off-canvas), controlado por este
  // botón. En desktop (ver styles.css, @media min-width) estos elementos ni
  // siquiera se muestran y el sidebar queda fijo, como siempre.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  function inicialesDe(nombre: string | undefined): string {
    if (!nombre) return "";
    const partes = nombre.trim().split(/\s+/);
    const primeras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
    return primeras.join("");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <Icon path={menuAbierto ? ICONS.close : ICONS.menu} size={22} strokeWidth={2} />
        </button>
        <div className="topbar-title">
          <Icon path={ICONS.tumbler} size={18} strokeWidth={2} />
          El Punto
        </div>
      </header>

      {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />}

      <aside className={`sidebar${menuAbierto ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <Icon path={ICONS.tumbler} size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="sidebar-brand-name">El Punto</div>
            <div className="sidebar-brand-sub">Gestión operativa</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end>
            <Icon path={ICONS.inicio} />
            <span>Inicio</span>
          </NavLink>
          <NavLink to="/mesas">
            <Icon path={ICONS.mesas} />
            <span>Mesas</span>
          </NavLink>
          <NavLink to="/inventario">
            <Icon path={ICONS.inventario} />
            <span>Inventario</span>
          </NavLink>
          {(usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO") && (
            <NavLink to="/recepciones">
              <Icon path={ICONS.recepciones} />
              <span>Recepciones</span>
            </NavLink>
          )}
          {(usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO") && (
            <NavLink to="/proveedores">
              <Icon path={ICONS.proveedores} />
              <span>Proveedores</span>
            </NavLink>
          )}
          <NavLink to="/productos">
            <Icon path={ICONS.productos} />
            <span>Productos</span>
          </NavLink>
          <NavLink to="/tipos-producto">
            <Icon path={ICONS.tiposProducto} />
            <span>Tipos de producto</span>
          </NavLink>
          {usuario?.perfil === "ADMINISTRADOR" && (
            <NavLink to="/usuarios">
              <Icon path={ICONS.usuarios} />
              <span>Usuarios</span>
            </NavLink>
          )}
          {usuario?.perfil === "ADMINISTRADOR" && (
            <NavLink to="/sedes">
              <Icon path={ICONS.sedes} />
              <span>Sedes</span>
            </NavLink>
          )}
          <NavLink to="/cambiar-password">
            <Icon path={ICONS.password} />
            <span>Mi contraseña</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{inicialesDe(usuario?.nombre)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">{usuario?.nombre}</div>
              <div className="sidebar-user-role">{usuario ? ETIQUETAS_PERFIL[usuario.perfil] : ""}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={() => void cerrarSesion()}>
            <Icon path={ICONS.logout} size={15} strokeWidth={2} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-column">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
