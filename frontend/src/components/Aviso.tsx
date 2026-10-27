import { useEffect, useRef, type ReactNode } from "react";

interface AvisoProps {
  tipo: "error" | "exito" | "info";
  children: ReactNode;
  className?: string;
}

const CLASES = { error: "alert-error", exito: "alert-success", info: "alert-info" } as const;

/**
 * Mensaje de resultado (error, éxito o información). Se anuncia a lectores de
 * pantalla (role alert/status) y, si quedó fuera de la vista —p. ej. tras
 * confirmar un pago al final de una página larga en celular—, se desplaza
 * hasta él para que nunca pase desapercibido.
 */
export function Aviso({ tipo, children, className }: AvisoProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || tipo === "info") return;
    const r = el.getBoundingClientRect();
    const visible = r.top >= 0 && r.bottom <= window.innerHeight;
    if (!visible) {
      const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reducir ? "auto" : "smooth" });
    }
  }, [children, tipo]);

  return (
    <div
      ref={ref}
      className={`alert ${CLASES[tipo]}${className ? ` ${className}` : ""}`}
      role={tipo === "error" ? "alert" : "status"}
      aria-live={tipo === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
