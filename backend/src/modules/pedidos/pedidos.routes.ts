import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth";
import * as pedidosController from "./pedidos.controller";

export const pedidosRouter = Router();

pedidosRouter.use(authenticate);

// HU-030 — consulta de pedidos: los tres perfiles, acotada por sede.
pedidosRouter.get("/", pedidosController.getPedidos);
// HU-032 — pedidos pendientes de pago (Cajero de su sede; Administrador todas).
pedidosRouter.get("/pendientes-pago", requireRole("CAJERO", "ADMINISTRADOR"), pedidosController.getPedidosPendientesPago);

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

// Detalle del pedido y cuenta (HU-031): Mesero y Cajero entregan/usan la cuenta; Administrador consulta.
pedidosRouter.get("/:idPedido", pedidosController.getPedido);
pedidosRouter.get("/:idPedido/cuenta.pdf", pedidosController.getCuentaPdf);

// HU-028 / HU-029 — cierre y reapertura excepcional: Mesero (de su sede).
pedidosRouter.post("/:idPedido/cerrar", requireRole("MESERO"), pedidosController.postCerrarPedido);
pedidosRouter.post("/:idPedido/reabrir", requireRole("MESERO"), pedidosController.postReabrirPedido);

// HU-033 a HU-038 — registro de pagos: Cajero (su sede) y Administrador. No existe
// ninguna ruta para editar o anular un pago (HU-038 CA-03).
pedidosRouter.post("/:idPedido/pagos", requireRole("CAJERO", "ADMINISTRADOR"), pedidosController.postPago);
