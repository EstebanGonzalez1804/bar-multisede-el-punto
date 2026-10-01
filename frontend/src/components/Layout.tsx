import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">El Punto · Gestión Operativa</div>
        <nav className="topbar-nav">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {usuario?.perfil === "ADMINISTRADOR" && <NavLink to="/sedes">Sedes</NavLink>}
          <NavLink to="/cambiar-password">Mi contraseña</NavLink>
        </nav>
        <div className="topbar-user">
          <span>{usuario?.nombre}</span>
          <button className="btn-logout" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
