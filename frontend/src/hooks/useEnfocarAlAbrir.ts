import { useEffect, useRef } from "react";

/**
 * Formularios en línea (crear/editar): al abrirse —p. ej. con "Editar" desde
 * una fila al final de la tabla— se llevan a la vista y se enfoca el primer
 * campo, para que el usuario no tenga que buscar dónde apareció.
 */
export function useEnfocarAlAbrir<T extends HTMLElement>(abierto: boolean, clave?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!abierto || !ref.current) return;
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({ block: "start", behavior: reducir ? "auto" : "smooth" });
    const campo = ref.current.querySelector<HTMLElement>("input, select, textarea");
    campo?.focus({ preventScroll: true });
  }, [abierto, clave]);
  return ref;
}
