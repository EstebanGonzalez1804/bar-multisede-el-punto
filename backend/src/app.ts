import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { sedesRouter } from "./modules/sedes/sedes.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/sedes", sedesRouter);

  // 404 para cualquier ruta no reconocida.
  app.use((req, res) => {
    res.status(404).json({
      error: { code: "RUTA_NO_ENCONTRADA", message: `No existe la ruta ${req.method} ${req.path}` },
    });
  });

  app.use(errorHandler);

  return app;
}
