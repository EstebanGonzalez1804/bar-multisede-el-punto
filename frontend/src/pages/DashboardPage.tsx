import { useAuth } from "../context/AuthContext";

const ETIQUETA_PERFIL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  CAJERO: "Cajero",
  MESERO: "Mesero",
};

export function DashboardPage() {
  const { usuario } = useAuth();

  return (
    <div className="panel">
      <h2>Hola, {usuario?.nombre}</h2>
      <p>
        Perfil: <strong>{usuario ? ETIQUETA_PERFIL[usuario.perfil] : ""}</strong>
        {usuario?.idSede ? ` · Sede asignada #${usuario.idSede}` : " · Acceso a todas las sedes"}
      </p>
      <p className="empty-state">
        Este es el punto de partida del sistema (Sprint 1). Las pantallas de
        usuarios, mesas, catálogo, inventario y pedidos se irán habilitando
        aquí a medida que avancemos por los siguientes sprints.
      </p>
    </div>
  );
}
