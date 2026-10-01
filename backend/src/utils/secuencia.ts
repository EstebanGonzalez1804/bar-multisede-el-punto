import type { Pool, PoolClient } from "pg";
import { pool } from "../config/db";

type Queryable = Pool | PoolClient;

/**
 * Incrementa atómicamente el consecutivo asociado a `clave` (tabla
 * SECUENCIA_CODIGO) y devuelve el nuevo valor.
 *
 * Usa `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` en una sola
 * sentencia: si la clave no existía, la fila queda en 1; si ya existía, se
 * incrementa en 1 respecto al último valor guardado. Al ser una única
 * sentencia atómica a nivel de base de datos, es seguro bajo escrituras
 * concurrentes (HU-007 CA-06: "el sistema garantiza que el nuevo
 * consecutivo sea único"), sin necesidad de un SELECT ... FOR UPDATE previo.
 *
 * Se usa tanto para el código de sede ("SEDE") como para el código de
 * usuario ("GEN-ADM" para Administrador, "{codigoSede}-{ROL}" para
 * Cajero/Mesero).
 */
export async function siguienteConsecutivo(
  clave: string,
  ejecutor: Queryable = pool
): Promise<number> {
  const { rows } = await ejecutor.query<{ ultimo_valor: number }>(
    `INSERT INTO secuencia_codigo (clave, ultimo_valor) VALUES ($1, 1)
     ON CONFLICT (clave) DO UPDATE SET ultimo_valor = secuencia_codigo.ultimo_valor + 1
     RETURNING ultimo_valor`,
    [clave]
  );
  return rows[0].ultimo_valor;
}
