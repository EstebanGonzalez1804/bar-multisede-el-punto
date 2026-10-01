import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Perfil } from "../api/types";

interface ProtectedRouteProps {
  children: ReactNode;
  perfilesPermitidos?: Perfil[];
}

export function ProtectedRoute({ children, perfilesPermitidos }: ProtectedRouteProps) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="login-page">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (perfilesPermitidos && !perfilesPermitidos.includes(usuario.perfil)) {
    return (
      <div className="panel">
        <h2>Acceso no disponible</h2>
        <p>Tu perfil no tiene permiso para ver esta sección.</p>
      </div>
    );
  }

  return <>{children}</>;
}
