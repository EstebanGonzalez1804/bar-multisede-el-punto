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
      setError("You must enter the new password.");
      return;
    }
    if (passwordNueva.length < 8) {
      setError("The new password must be at least 8 characters long.");
      return;
    }
    if (passwordNueva !== confirmacion) {
      setError("The confirmation does not match the new password.");
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
      setError(getApiErrorMessage(err, "The password could not be changed."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="panel panel-angosto">
      <h1 className="page-title">Change my password</h1>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {exito && <Aviso tipo="exito">Your password was updated successfully.</Aviso>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="passwordActual">Current password</label>
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
          <label htmlFor="passwordNueva">New password</label>
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
            At least 8 characters.
          </div>
        </div>
        <div className="field">
          <label htmlFor="confirmacion">Confirm new password</label>
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
          {enviando ? "Saving..." : "Save new password"}
        </button>
      </form>
    </div>
  );
}
