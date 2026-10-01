import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on("error", (err) => {
  // Error en un cliente ocioso del pool: no debe tumbar el proceso, pero sí
  // quedar visible, porque normalmente indica que la base de datos se cayó.
  // eslint-disable-next-line no-console
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Ejecuta `fn` dentro de una transacción. Si `fn` lanza, se hace ROLLBACK
 * y se re-lanza el error; si termina bien, se hace COMMIT.
 *
 * Se usa en toda operación que combine más de una escritura que deba
 * aplicarse como una sola unidad (p. ej. HU-026: registrar producto en el
 * pedido Y descontar inventario Y registrar movimiento Y trazabilidad).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
