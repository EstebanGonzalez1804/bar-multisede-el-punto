-- ============================================================================
-- Migración 005 · Sprint 3 — Inventario y operación en sala
-- Historias cubiertas: HU-018 a HU-026
-- Tablas nuevas: PROVEEDOR, PEDIDO, DETALLE_PEDIDO, RECEPCION_MERCANCIA,
--                INVENTARIO, MOVIMIENTO_INVENTARIO
-- Campos y relaciones tomados literalmente del Documento de Arquitectura de
-- Software (sección 6, Modelo de datos), no inventados.
-- Orden de creación: cada tabla antes de la primera que la referencia por FK;
-- MOVIMIENTO_INVENTARIO queda al final porque referencia tanto a
-- RECEPCION_MERCANCIA como a DETALLE_PEDIDO.
-- Sin BEGIN/COMMIT propios — ver nota en 001_sprint1_fundaciones.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROVEEDOR (HU-018)
-- Solo datos de contacto: CA-03 es explícito en que este formulario NO
-- incluye valores de compra/venta (esos viven en PRODUCTO). No existe
-- inactivación de proveedores: HU-018 solo define crear y modificar.
-- ----------------------------------------------------------------------------
CREATE TABLE proveedor (
    id_proveedor            SERIAL PRIMARY KEY,
    nombre                  VARCHAR(150) NOT NULL,
    informacion_contacto    VARCHAR(255) NOT NULL,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- PEDIDO (HU-025)
-- identificador_pedido: prefijo = código de la sede + consecutivo SIN
-- relleno de ceros (CA-03 HU-025, a diferencia de los códigos de usuario y
-- producto, que sí lo tienen) — ver generarIdentificadorPedido() en
-- pedidos.service.ts. Un pedido queda ligado a una única mesa para siempre
-- (CA-04): no hay columna ni mecanismo para "trasladar" un pedido de mesa.
-- estado_pago ya incluye PARCIAL/PAGADO pensando en Sprint 4 (pagos), pero
-- en Sprint 3 ningún camino de código distinto de PENDIENTE es alcanzable
-- todavía, porque no existe ninguna HU de registro de pago.
-- ----------------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido           SERIAL PRIMARY KEY,
    identificador_pedido VARCHAR(30) NOT NULL UNIQUE,
    id_mesa             INTEGER NOT NULL REFERENCES mesa(id_mesa),
    id_sede             INTEGER NOT NULL REFERENCES sede(id_sede),
    id_usuario_mesero   INTEGER NOT NULL REFERENCES usuario(id_usuario),
    estado_pedido       VARCHAR(10) NOT NULL DEFAULT 'ABIERTO'
                            CHECK (estado_pedido IN ('ABIERTO', 'CERRADO')),
    estado_pago         VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado_pago IN ('PENDIENTE', 'PARCIAL', 'PAGADO')),
    fecha_apertura      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_cierre        TIMESTAMPTZ
);

CREATE INDEX idx_pedido_mesa ON pedido(id_mesa);
CREATE INDEX idx_pedido_sede ON pedido(id_sede);
CREATE INDEX idx_pedido_estado ON pedido(estado_pedido);

-- ----------------------------------------------------------------------------
-- DETALLE_PEDIDO (HU-026)
-- precio_venta_congelado/precio_compra_congelado: copia del valor vigente de
-- PRODUCTO en el instante en que se agrega la línea (CA-04), para que un
-- cambio de precio posterior (HU-015) nunca altere pedidos ya en curso.
-- CA-05 es absoluto: una vez creada, una línea no se edita ni se elimina —
-- por eso, intencionalmente, no hay columna "cantidad editable" ni estado de
-- línea, y el backend (pedidos.service.ts) no expone ningún endpoint de
-- modificación o borrado sobre esta tabla.
-- ----------------------------------------------------------------------------
CREATE TABLE detalle_pedido (
    id_detalle_pedido       BIGSERIAL PRIMARY KEY,
    id_pedido               INTEGER NOT NULL REFERENCES pedido(id_pedido),
    id_producto             INTEGER NOT NULL REFERENCES producto(id_producto),
    cantidad                INTEGER NOT NULL CHECK (cantidad > 0),
    precio_venta_congelado  NUMERIC(12,2) NOT NULL CHECK (precio_venta_congelado >= 0),
    precio_compra_congelado NUMERIC(12,2) NOT NULL CHECK (precio_compra_congelado >= 0),
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_detalle_pedido_pedido ON detalle_pedido(id_pedido);

-- ----------------------------------------------------------------------------
-- RECEPCION_MERCANCIA (HU-019, HU-021)
-- Tabla de encabezado únicamente: el Documento de Arquitectura no define una
-- tabla de líneas separada para la recepción — cada producto recibido queda
-- representado directamente como su propia fila en MOVIMIENTO_INVENTARIO
-- (tipo_movimiento = 'RECEPCION', id_recepcion apuntando aquí), que es donde
-- ya se necesitaban cantidad/producto de todos modos.
-- fecha_recepcion es la fecha que el usuario selecciona en el formulario
-- (CA-01 HU-021: "se selecciona sede, proveedor, fecha..."); creado_en es el
-- momento real de registro en el sistema (la "hora" que exige CA-01 HU-019).
-- ----------------------------------------------------------------------------
CREATE TABLE recepcion_mercancia (
    id_recepcion    SERIAL PRIMARY KEY,
    id_proveedor    INTEGER NOT NULL REFERENCES proveedor(id_proveedor),
    id_sede         INTEGER NOT NULL REFERENCES sede(id_sede),
    id_usuario      INTEGER NOT NULL REFERENCES usuario(id_usuario),
    fecha_recepcion DATE NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recepcion_proveedor ON recepcion_mercancia(id_proveedor);
CREATE INDEX idx_recepcion_sede ON recepcion_mercancia(id_sede);
CREATE INDEX idx_recepcion_fecha ON recepcion_mercancia(fecha_recepcion);

-- ----------------------------------------------------------------------------
-- INVENTARIO (HU-020, HU-022, HU-023)
-- Resuelve la relación N:M entre PRODUCTO y SEDE: una fila por combinación,
-- creada perezosamente (ON CONFLICT DO NOTHING) la primera vez que esa
-- combinación recibe un movimiento — no se pre-crean filas en 0 para todo el
-- catálogo. cantidad_disponible nunca es negativa (CHECK) ni fraccionaria
-- (INTEGER, CA-03 HU-020): toda la aritmética pasa por
-- aplicarMovimientoInventario() en utils/inventario.ts, que bloquea la fila
-- con FOR UPDATE antes de escribir.
-- ----------------------------------------------------------------------------
CREATE TABLE inventario (
    id_inventario       SERIAL PRIMARY KEY,
    id_producto         INTEGER NOT NULL REFERENCES producto(id_producto),
    id_sede             INTEGER NOT NULL REFERENCES sede(id_sede),
    cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_inventario_producto_sede UNIQUE (id_producto, id_sede)
);

CREATE INDEX idx_inventario_sede ON inventario(id_sede);

-- ----------------------------------------------------------------------------
-- MOVIMIENTO_INVENTARIO (HU-019 CA-01, HU-021, HU-022, HU-026)
-- Bitácora unificada de todo lo que entra o sale de INVENTARIO. cantidad va
-- con signo (positiva = entra, negativa = sale); cantidad_anterior/
-- cantidad_resultante son la foto de antes/después exigida por CA-08 de
-- HU-022 y reutilizada para CA-01 de HU-019. Exactamente uno de
-- (id_recepcion, id_detalle_pedido) va lleno según tipo_movimiento, y motivo
-- solo existe para AJUSTE — los tres CHECK siguientes lo hacen imposible de
-- violar por error de aplicación, no solo por convención.
-- ----------------------------------------------------------------------------
CREATE TABLE movimiento_inventario (
    id_movimiento       BIGSERIAL PRIMARY KEY,
    id_producto         INTEGER NOT NULL REFERENCES producto(id_producto),
    id_sede             INTEGER NOT NULL REFERENCES sede(id_sede),
    id_usuario          INTEGER NOT NULL REFERENCES usuario(id_usuario),
    tipo_movimiento     VARCHAR(20) NOT NULL
                            CHECK (tipo_movimiento IN ('RECEPCION', 'VENTA', 'AJUSTE')),
    cantidad            INTEGER NOT NULL CHECK (cantidad <> 0),
    cantidad_anterior   INTEGER NOT NULL CHECK (cantidad_anterior >= 0),
    cantidad_resultante INTEGER NOT NULL CHECK (cantidad_resultante >= 0),
    motivo              VARCHAR(30)
                            CHECK (motivo IS NULL OR motivo IN
                                ('PERDIDA', 'DANO', 'ROTURA', 'DIFERENCIA_FISICA', 'ERROR_REGISTRO', 'OTRO')),
    id_recepcion        INTEGER REFERENCES recepcion_mercancia(id_recepcion),
    id_detalle_pedido   BIGINT REFERENCES detalle_pedido(id_detalle_pedido),
    fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_movimiento_motivo_segun_tipo CHECK (
        (tipo_movimiento = 'AJUSTE' AND motivo IS NOT NULL)
        OR (tipo_movimiento <> 'AJUSTE' AND motivo IS NULL)
    ),
    CONSTRAINT chk_movimiento_recepcion_segun_tipo CHECK (
        (tipo_movimiento = 'RECEPCION' AND id_recepcion IS NOT NULL)
        OR (tipo_movimiento <> 'RECEPCION' AND id_recepcion IS NULL)
    ),
    CONSTRAINT chk_movimiento_detalle_segun_tipo CHECK (
        (tipo_movimiento = 'VENTA' AND id_detalle_pedido IS NOT NULL)
        OR (tipo_movimiento <> 'VENTA' AND id_detalle_pedido IS NULL)
    )
);

CREATE INDEX idx_movimiento_producto_sede ON movimiento_inventario(id_producto, id_sede);
CREATE INDEX idx_movimiento_tipo ON movimiento_inventario(tipo_movimiento);
CREATE INDEX idx_movimiento_fecha ON movimiento_inventario(fecha_hora);
