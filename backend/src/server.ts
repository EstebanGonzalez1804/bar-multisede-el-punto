import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";
import { runMigrations } from "./db/migrate";

async function main() {
  // Falla rápido y con un mensaje claro si la base de datos no está
  // disponible, en lugar de levantar un servidor que luego falla en cada
  // request.
  await pool.query("SELECT 1");

  // Aplica cualquier migración pendiente (idempotente: ver db/migrate.ts).
  // Así, cada vez que se agrega el siguiente sprint, basta con levantar el
  // backend de nuevo para que la base de datos quede al día.
  await runMigrations();

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("No se pudo iniciar el servidor:", err);
  process.exit(1);
});
