import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { usuario, iniciarSesion } = useAuth();
  const [codigoUsuario, setCodigoUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(codigoUsuario.trim(), password);
    } catch (err) {
      // CA-04: mensaje genérico, visible bajo el formulario, sin indicar si
      // el usuario existe o si fue la contraseña la incorrecta. Para los
      // casos de usuario inactivo/bloqueado el backend sí da un mensaje
      // específico, que se muestra tal cual.
      setError(getApiErrorMessage(err, "Usuario o contraseña incorrectos."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>El Punto</h1>
        <p className="login-subtitle">Gestión operativa — inicia sesión para continuar</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="codigoUsuario">Código de usuario</label>
            <input
              id="codigoUsuario"
              type="text"
              autoComplete="username"
              value={codigoUsuario}
              onChange={(e) => setCodigoUsuario(e.target.value)}
              placeholder="SE01-CAJ-001"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
