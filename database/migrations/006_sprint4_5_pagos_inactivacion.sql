-- ============================================================================
-- Migración 006 · Sprints 4 y 5 — Cierre de pedidos, pagos e inactivación
-- Historias cubiertas: HU-027 a HU-040 (ver README) + ajuste acordado con el
-- cliente: todo lo configurable se puede inactivar (sedes, proveedores y tipos
-- de producto, que hasta ahora no tenían estado).
-- Nota: sin BEGIN/COMMIT propios (lo controla el runner de migraciones).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Inactivación de SEDE, PROVEEDOR y TIPO_PRODUCTO.
-- Ajuste solicitado por el cliente tras la revisión del primer avance: reemplaza
-- el CA-04 original de HU-010 ("no existe inactivación de sedes"). Nada se
-- elimina: la fila y su histórico se conservan; solo cambia su disponibilidad.
-- ----------------------------------------------------------------------------
ALTER TABLE sede
    ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO', 'INACTIVO'));

ALTER TABLE proveedor
    ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO', 'INACTIVO'));

ALTER TABLE tipo_producto
    ADD COLUMN estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO'
        CHECK (estado IN ('ACTIVO', 'INACTIVO'));

-- ----------------------------------------------------------------------------
-- PAGO (HU-033 a HU-038)
-- Cada fila es UNA línea de pago (un método + un valor). Un pago combinado
-- (HU-034) son varias filas registradas en la misma operación.
-- `valor` es solo el ingreso de la venta: las vueltas de un pago en efectivo
-- NO se almacenan (HU-033 CA-02).
-- modalidad: TOTAL (paga todo el saldo, HU-033/034), ABONO (parte libre del
-- total, HU-035) o PRODUCTOS (parte correspondiente a líneas elegidas, HU-036).
-- ----------------------------------------------------------------------------
CREATE TABLE pago (
    id_pago         BIGSERIAL PRIMARY KEY,
    id_pedido       INTEGER NOT NULL REFERENCES pedido(id_pedido),
    id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario),
    metodo          VARCHAR(20) NOT NULL
                        CHECK (metodo IN ('EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO')),
    valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    modalidad       VARCHAR(10) NOT NULL
                        CHECK (modalidad IN ('TOTAL', 'ABONO', 'PRODUCTOS')),
    fecha_hora      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pago_pedido ON pago(id_pedido);
CREATE INDEX idx_pago_fecha ON pago(fecha_hora);

-- Líneas del pedido cubiertas por un pago de modalidad PRODUCTOS (HU-036).
-- UNIQUE(id_detalle_pedido): una línea solo puede asignarse a un pago.
CREATE TABLE pago_detalle_pedido (
    id_pago             BIGINT NOT NULL REFERENCES pago(id_pago),
    id_detalle_pedido   BIGINT NOT NULL REFERENCES detalle_pedido(id_detalle_pedido),
    PRIMARY KEY (id_pago, id_detalle_pedido),
    CONSTRAINT uq_pago_detalle_unico UNIQUE (id_detalle_pedido)
);

-- ----------------------------------------------------------------------------
-- HU-038 CA-03: un pago confirmado no se puede modificar ni anular. Además de
-- no exponer ningún endpoint para hacerlo, la base de datos lo impide.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION impedir_modificar_pago() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Los pagos registrados son irreversibles: no se pueden modificar ni eliminar.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pago_inmutable
    BEFORE UPDATE OR DELETE ON pago
    FOR EACH ROW EXECUTE FUNCTION impedir_modificar_pago();

CREATE TRIGGER trg_pago_detalle_inmutable
    BEFORE UPDATE OR DELETE ON pago_detalle_pedido
    FOR EACH ROW EXECUTE FUNCTION impedir_modificar_pago();

-- Consultas de pedidos por sede/estado de pago (HU-030, HU-032).
CREATE INDEX idx_pedido_estado_pago ON pedido(estado_pago);
