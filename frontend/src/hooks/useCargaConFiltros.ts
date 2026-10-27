import { useEffect, useRef } from "react";

/**
 * Filtros que se aplican solos (sin botón "Filtrar"): carga de inmediato al
 * entrar y, cada vez que cambia `cargar` (porque cambió algún filtro), vuelve
 * a cargar tras una pequeña espera para no consultar en cada tecla.
 */
export function useCargaConFiltros(cargar: () => unknown, demoraMs = 350): void {
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      void cargar();
      return;
    }
    const t = setTimeout(() => void cargar(), demoraMs);
    return () => clearTimeout(t);
  }, [cargar, demoraMs]);
}
