import type { PoolClient } from "pg";
import { pool } from "../config/db";

export interface RegistrarEventoInput {
  idUsuario: number | null;
  tipoEvento: string;
  entidadAfectada: string;
  idAfectado?: string | number | null;
  idSede?: number | null;
  detalle?: Record<string, unknown> | null;
}

/**
 * Registro automático de eventos (HU-041). Se llama desde cada operación
 * relevante de seguridad, usuarios, productos, inventario, pedidos, pagos y
 * proveedores — nunca requiere intervención manual (CA-01 a CA-07).
 *
 * Acepta un `client` opcional para poder participar en la MISMA transacción
 * que la operación que está registrando (p. ej. HU-026: el descuento de
 * inventario y su traza deben confirmarse o revertirse juntos).
 */
export async function registrarEvento(
  input: RegistrarEventoInput,
  client?: PoolClient
): Promise<void> {
  const ejecutor = client ?? pool;
  await ejecutor.query(
    `INSERT INTO trazabilidad
       (id_usuario, tipo_evento, entidad_afectada, id_afectado, id_sede, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.idUsuario,
      input.tipoEvento,
      input.entidadAfectada,
      input.idAfectado != null ? String(input.idAfectado) : null,
      input.idSede ?? null,
      input.detalle ? JSON.stringify(input.detalle) : null,
    ]
  );
}
