/**
 * Marca de "El Punto": vaso con hielo y una estrella, dentro de un anillo —
 * versión vectorial simplificada del logo real del cliente (ver canvas de
 * mockups, tablero "Sistema"), construida para leerse nítida desde 18 px.
 * El latón (#C8962E) marca el líquido y la estrella, igual que en el logo
 * original — el resto del trazo hereda el color del texto sobre el fondo
 * (`ink`), para que la misma marca sirva sobre verde botella o sobre blanco.
 */
interface LogoMarkProps {
  size?: number;
  ink?: string;
  /** Tirillas/impresión en un solo color: el líquido y la estrella también usan `ink`. */
  monochrome?: boolean;
}

export function LogoMark({ size = 26, ink = "#F2F5F1", monochrome = false }: LogoMarkProps) {
  const brass = monochrome ? ink : "#C8962E";
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="14" cy="14" r="12" stroke={ink} strokeWidth="1.4" />
      <path d="M10.6 16.6 L17.4 16.6 L16.3 21 L11.7 21 Z" fill={brass} />
      <path d="M10.2 13 L17.8 13 L16.3 21 L11.7 21 Z" stroke={ink} strokeWidth="1.3" />
      <rect x="11.5" y="17.4" width="1.9" height="1.9" stroke={ink} strokeWidth="1.1" />
      <rect x="14.3" y="16.7" width="1.7" height="1.7" stroke={ink} strokeWidth="1.1" />
      <path
        d="M14 5.4 L14.9 7.6 L17.1 8.5 L14.9 9.4 L14 11.6 L13.1 9.4 L10.9 8.5 L13.1 7.6 Z"
        fill={brass}
      />
    </svg>
  );
}

interface LogoWordmarkProps {
  size?: number;
  ink?: string;
}

/** El wordmark "El Punto." con el punto final en latón — condensado (clase `.cond`), como en los mockups. */
export function LogoWordmark({ size = 26, ink = "#F2F5F1" }: LogoWordmarkProps) {
  return (
    <span
      className="cond"
      style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.01em", color: ink, lineHeight: 1 }}
    >
      El Punto
      <span style={{ color: "#C8962E" }}>.</span>
    </span>
  );
}
