import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { pool } from "../config/db";

/**
 * Runner de migraciones, mínimo pero con control de qué ya se aplicó.
 *
 * Se eligió esto en vez de depender únicamente del mecanismo de
 * `docker-entrypoint-initdb.d` de la imagen oficial de Postgres porque ese
 * mecanismo solo corre una vez, la primera vez que se crea el volumen de
 * datos: si en un sprint posterior se agrega un nuevo archivo
 * `00N_sprintX_*.sql`, un volumen que ya existía de un sprint anterior nunca
 * lo aplicaría. Este runner corre en cada arranque del backend y aplica
 * únicamente los archivos que todavía no estén registrados en
 * `schema_migrations`, así que agregar un nuevo sprint es tan simple como
 * añadir el siguiente archivo numerado a `database/migrations/`.
 */

// En runtime (dist/db/migrate.js) la carpeta queda tres niveles arriba de
// dist/db/: dist/db -> dist -> backend -> (raíz del repo)/database/migrations.
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "database", "migrations");

async function ensureSchemaMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre_archivo  VARCHAR(255) PRIMARY KEY,
      aplicada_en     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function obtenerAplicadas(): Promise<Set<string>> {
  const { rows } = await pool.query<{ nombre_archivo: string }>(
    "SELECT nombre_archivo FROM schema_migrations"
  );
  return new Set(rows.map((r) => r.nombre_archivo));
}

export async function runMigrations(): Promise<void> {
  await ensureSchemaMigrationsTable();
  const aplicadas = await obtenerAplicadas();

  const archivos = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, archivo), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (nombre_archivo) VALUES ($1)", [archivo]);
      await client.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log(`Migración aplicada: ${archivo}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Falló la migración "${archivo}": ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

// Permite correrlo también como script suelto: `npm run migrate`.
if (require.main === module) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Migraciones al día.");
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
