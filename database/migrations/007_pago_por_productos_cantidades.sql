-- ============================================================================
-- Migración 007 · Pago por productos con cantidades
-- Ajuste solicitado tras la validación del avance: en "pago por productos" el
-- cajero elige producto Y cantidad (ej. 1 de 2 botellas de ron). Antes se
-- asignaban líneas completas del pedido; ahora cada asignación registra cuántas
-- unidades de la línea cubre el pago.
-- Nota: sin BEGIN/COMMIT propios (lo controla el runner de migraciones).
-- ============================================================================

-- Las filas existentes cubrían la línea completa: su cantidad es la de la línea.
-- El trigger de inmutabilidad se desactiva solo durante este relleno.
ALTER TABLE pago_detalle_pedido ADD COLUMN cantidad INTEGER;

ALTER TABLE pago_detalle_pedido DISABLE TRIGGER trg_pago_detalle_inmutable;
UPDATE pago_detalle_pedido pd
   SET cantidad = d.cantidad
  FROM detalle_pedido d
 WHERE d.id_detalle_pedido = pd.id_detalle_pedido;
ALTER TABLE pago_detalle_pedido ENABLE TRIGGER trg_pago_detalle_inmutable;

ALTER TABLE pago_detalle_pedido ALTER COLUMN cantidad SET NOT NULL;
ALTER TABLE pago_detalle_pedido ADD CONSTRAINT ck_pago_detalle_cantidad CHECK (cantidad > 0);

-- Una línea ahora puede cubrirse en varios pagos (unidad por unidad); el
-- servicio garantiza que la suma de cantidades no supere la de la línea.
ALTER TABLE pago_detalle_pedido DROP CONSTRAINT uq_pago_detalle_unico;
