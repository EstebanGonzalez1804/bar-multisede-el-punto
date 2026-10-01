import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { sedesRouter } from "./modules/sedes/sedes.routes";
import { usuariosRouter } from "./modules/usuarios/usuarios.routes";
import { mesasRouter } from "./modules/mesas/mesas.routes";
import { tiposProductoRouter } from "./modules/tipos-producto/tipos-producto.routes";
import { productosRouter } from "./modules/productos/productos.routes";
import { proveedoresRouter } from "./modules/proveedores/proveedores.routes";
import { recepcionesRouter } from "./modules/recepciones/recepciones.routes";
import { inventarioRouter } from "./modules/inventario/inventario.routes";
import { pedidosRouter } from "./modules/pedidos/pedidos.routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/sedes", sedesRouter);
  app.use("/api/usuarios", usuariosRouter);
  app.use("/api/mesas", mesasRouter);
  app.use("/api/tipos-producto", tiposProductoRouter);
  app.use("/api/productos", productosRouter);
  app.use("/api/proveedores", proveedoresRouter);
  app.use("/api/recepciones", recepcionesRouter);
  app.use("/api/inventario", inventarioRouter);
  app.use("/api/pedidos", pedidosRouter);

  // 404 para cualquier ruta no reconocida.
  app.use((req, res) => {
    res.status(404).json({
      error: { code: "RUTA_NO_ENCONTRADA", message: `No existe la ruta ${req.method} ${req.path}` },
    });
  });

  app.use(errorHandler);

  return app;
}
