/**
 * Set de iconos de línea, dibujados a mano como paths SVG (sin librería
 * externa: el sandbox donde se escribe este proyecto no tiene salida a
 * `npm install`, así que cualquier dependencia nueva solo se puede validar
 * hasta que el usuario corre `docker compose up --build` — se evita aquí
 * para no introducir un paso de instalación extra sin poder probarlo antes).
 */
interface IconProps {
  path: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ path, size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export const ICONS = {
  inicio: "M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5",
  mesas: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  inventario: "M3 8 12 4l9 4-9 4-9-4Zm0 0v9l9 4 9-4V8M12 12v9",
  recepciones: "M12 3v11m0 0 4-4m-4 4-4-4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  proveedores: "M3 7h10v7H3zM13 10h4l3 3v1h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  productos: "M12 2 21 11l-9 9-9-9V2h9ZM7 7h.01",
  tiposProducto: "M4 5h16M4 12h16M4 19h10",
  usuarios:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 8a3 3 0 1 0 0-6M22 20v-1a5 5 0 0 0-3.8-4.85",
  sedes: "M4 21V7l8-4 8 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01",
  password: "M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6-7V7a6 6 0 1 0-12 0v3M5 10h14v10H5V10Z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  tumbler: "M6 3h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8L6 3Zm0 6h12",
  plus: "M12 5v14M5 12h14",
  checkCircle: "M20 6 9 17l-5-5",
  warning: "M12 3 2 20h20L12 3Zm0 6v5m0 3h.01",
  receipt: "M6 2h9l3 3v17H6V2Zm3 6h6m-6 4h6m-6 4h4",
  capacity:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M17 8a3 3 0 1 0 0-6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  rebuild: "M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0 1 14-4.9M20 14a8 8 0 0 1-14 4.9",
};
