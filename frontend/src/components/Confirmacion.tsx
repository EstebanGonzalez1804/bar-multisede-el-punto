import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  /** Texto del botón que confirma, con el verbo de la acción ("Inactivar", "Registrar pago"). */
  textoConfirmar: string;
  /** Acción destructiva o irreversible: el botón se pinta en ladrillo. */
  peligro?: boolean;
}

type Confirmar = (opciones: OpcionesConfirmacion) => Promise<boolean>;

const ConfirmacionContext = createContext<Confirmar | null>(null);

/**
 * Una sola forma de confirmar en toda la aplicación (antes convivían
 * window.confirm, confirmaciones en línea y acciones sin confirmación).
 * Uso: `if (!(await confirmar({ ... }))) return;`
 */
export function ConfirmacionProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);
  const botonConfirmar = useRef<HTMLButtonElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  const confirmar = useCallback<Confirmar>((nuevas) => {
    focoPrevio.current = document.activeElement as HTMLElement | null;
    setOpciones(nuevas);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cerrar = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setOpciones(null);
    focoPrevio.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!opciones) return;
    botonConfirmar.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opciones, cerrar]);

  return (
    <ConfirmacionContext.Provider value={confirmar}>
      {children}
      {opciones && (
        <div className="dialogo-fondo" onClick={() => cerrar(false)}>
          <div
            className="dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialogo-titulo"
            aria-describedby="dialogo-mensaje"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dialogo-titulo" className="dialogo-titulo">
              {opciones.titulo}
            </h2>
            <div id="dialogo-mensaje" className="dialogo-mensaje">
              {opciones.mensaje}
            </div>
            <div className="dialogo-acciones">
              <button type="button" className="btn-secondary" onClick={() => cerrar(false)}>
                Cancel
              </button>
              <button
                ref={botonConfirmar}
                type="button"
                className={opciones.peligro ? "btn-primary btn-peligro" : "btn-primary"}
                onClick={() => cerrar(true)}
              >
                {opciones.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmacionContext.Provider>
  );
}

export function useConfirmar(): Confirmar {
  const ctx = useContext(ConfirmacionContext);
  if (!ctx) throw new Error("useConfirmar debe usarse dentro de <ConfirmacionProvider>.");
  return ctx;
}
