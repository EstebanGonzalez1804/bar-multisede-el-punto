import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as pedidosController from "./pedidos.controller";

export const pedidosRouter = Router();

pedidosRouter.use(authenticate);

/**
 * HU-025 y HU-026 solo usan "Como Mesero" como actor, sin ningún CA que
 * otorgue la acción a Administrador o Cajero (a diferencia de HU-020/HU-021,
 * que sí son explícitas sobre qué otros perfiles entran). Se interpreta
 * como exclusivo de Mesero, igual que HU-023/HU-024 — documentado también
 * en README bajo "Decisiones técnicas relevantes".
 */
pedidosRouter.post("/", requireRole("MESERO"), pedidosController.postPedido);
pedidosRouter.get(
  "/por-mesa/:idMesa",
  requireRole("MESERO"),
  pedidosController.getPedidoAbiertoPorMesa
);
pedidosRouter.post(
  "/:idPedido/lineas",
  requireRole("MESERO"),
  pedidosController.postLineaPedido
);
