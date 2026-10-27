import { useState, type FormEvent } from "react";
import * as authApi from "../api/auth";
import { getApiErrorMessage } from "../api/client";
import { Aviso } from "../components/Aviso";

export function CambiarPasswordPage() {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(false);

    // CA-03: el campo de nueva contraseña no puede quedar vacío.
    if (!passwordNueva) {
      setError("Debes indicar la nueva contraseña.");
      return;
    }
    if (passwordNueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordNueva !== confirmacion) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setEnviando(true);
    try {
      await authApi.cambiarPasswordPropia(passwordActual, passwordNueva);
      setExito(true);
      setPasswordActual("");
      setPasswordNueva("");
      setConfirmacion("");
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar la contraseña."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="panel panel-angosto">
      <h1 className="page-title">Cambiar mi contraseña</h1>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">Tu contraseña se actualizó correctamente.</Aviso>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="passwordActual">Contraseña actual</label>
          <input
            id="passwordActual"
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="passwordNueva">Nueva contraseña</label>
          <input
            id="passwordNueva"
            type="password"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            autoComplete="new-password"
            aria-describedby="ayudaPassword"
            required
          />
          <div id="ayudaPassword" className="field-hint">
            Mínimo 8 caracteres.
          </div>
        </div>
        <div className="field">
          <label htmlFor="confirmacion">Confirmar nueva contraseña</label>
          <input
            id="confirmacion"
            type="password"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar nueva contraseña"}
        </button>
      </form>
    </div>
  );
}
