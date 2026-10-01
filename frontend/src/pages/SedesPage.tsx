import { useEffect, useState, type FormEvent } from "react";
import * as sedesApi from "../api/sedes";
import { getApiErrorMessage } from "../api/client";
import type { Sede } from "../api/types";

export function SedesPage() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargarSedes() {
    setCargando(true);
    try {
      const data = await sedesApi.listarSedes();
      setSedes(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron cargar las sedes."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargarSedes();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // CA-02: campos obligatorios.
    if (!nombre.trim() || !direccion.trim()) {
      setError("Nombre y dirección son obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      await sedesApi.crearSede(nombre.trim(), direccion.trim());
      setNombre("");
      setDireccion("");
      await cargarSedes();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo crear la sede."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>Nueva sede</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Sede Centro"
            />
          </div>
          <div className="field">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Calle 10 # 5-20"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={guardando}>
            {guardando ? "Creando..." : "Crear sede"}
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 style={{ margin: 0 }}>Sedes registradas</h2>
        </div>
        {cargando ? (
          <p className="empty-state">Cargando...</p>
        ) : sedes.length === 0 ? (
          <p className="empty-state">Aún no hay sedes registradas.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map((sede) => (
                <tr key={sede.idSede}>
                  <td>{sede.codigoSede}</td>
                  <td>{sede.nombre}</td>
                  <td>{sede.direccion}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
