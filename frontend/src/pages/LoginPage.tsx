import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Icon, ICONS } from "../components/icons";
import { LogoMark, LogoWordmark } from "../components/Logo";
import { Aviso } from "../components/Aviso";
import type { Perfil } from "../api/types";

/**
 * HU-001 CA-01: "el sistema lo autentica y lo redirige a la vista
 * correspondiente a su rol". Mesero y Cajero caen directo en la pantalla
 * donde arranca su trabajo del día; Administrador no tiene una única
 * pantalla "principal" (su rol es transversal a todo el sistema), así que
 * se queda en Inicio. "Inicio" sigue existiendo y accesible por el menú
 * para los tres perfiles; esto solo cambia a dónde aterrizas justo después
 * de iniciar sesión.
 */
function vistaInicialPorPerfil(perfil: Perfil): string {
  if (perfil === "MESERO") return "/mesas";
  if (perfil === "CAJERO") return "/cobros";
  return "/";
}

export function LoginPage() {
  const { usuario, iniciarSesion } = useAuth();
  const [codigoUsuario, setCodigoUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  if (usuario) {
    return <Navigate to={vistaInicialPorPerfil(usuario.perfil)} replace />;
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
      setError(getApiErrorMessage(err, "Incorrect user code or password."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-hero">
        <svg
          width="460"
          height="460"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
          className="login-hero-watermark"
        >
          <circle cx="14" cy="14" r="12" stroke="#ffffff" strokeWidth="0.5" />
          <path d="M10.2 13 L17.8 13 L16.3 21 L11.7 21 Z" stroke="#ffffff" strokeWidth="0.5" />
        </svg>

        <div className="login-hero-brand">
          <LogoMark size={40} />
          <LogoWordmark size={34} />
        </div>

        <div>
          <div className="login-hero-headline">Control of your whole bar, on a single screen.</div>
          <p className="login-hero-sub">Tables, inventory and orders for all your locations, in real time.</p>
          <div className="login-hero-roles" aria-label="Platform roles">
            <div className="login-hero-role">
              <Icon path={ICONS.usuarios} size={16} strokeWidth={2.2} />
              Administrator
            </div>
            <div className="login-hero-role">
              <Icon path={ICONS.inventario} size={16} strokeWidth={2.2} />
              Cashier
            </div>
            <div className="login-hero-role">
              <Icon path={ICONS.mesas} size={16} strokeWidth={2.2} />
              Waiter
            </div>
          </div>
        </div>


        <div className="login-hero-footer">NOVATECH · Operations Management Platform</div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <h1>Sign in</h1>
          <p className="login-subtitle">Enter your user code and password.</p>

          {error && <Aviso tipo="error">{error}</Aviso>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codigoUsuario">User code</label>
              <div className="field-with-icon">
                <Icon path={ICONS.usuarios} size={16} strokeWidth={2} />
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
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field-with-icon">
                <Icon path={ICONS.password} size={16} strokeWidth={2} />
                <input
                  id="password"
                  type={verPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn-ver-password"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-pressed={verPassword}
                >
                  {verPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? "Signing in..." : "Sign in"}
              {!enviando && <Icon path={ICONS.arrowRight} size={16} strokeWidth={2.3} />}
            </button>
          </form>

          <div className="login-note">
            <Icon path={ICONS.warning} size={15} strokeWidth={2.1} />
            <span>For security, your session closes automatically after 3 minutes of inactivity.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
