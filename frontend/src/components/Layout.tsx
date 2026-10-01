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
          {usuario?.perfil === "ADMINISTRADOR" && <NavLink to="/usuarios">Usuarios</NavLink>}
          <NavLink to="/mesas">Mesas</NavLink>
          <NavLink to="/tipos-producto">Tipos de producto</NavLink>
          <NavLink to="/productos">Productos</NavLink>
          {(usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO") && (
            <NavLink to="/proveedores">Proveedores</NavLink>
          )}
          {(usuario?.perfil === "ADMINISTRADOR" || usuario?.perfil === "CAJERO") && (
            <NavLink to="/recepciones">Recepciones</NavLink>
          )}
          <NavLink to="/inventario">Inventario</NavLink>
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
