-- ============================================================================
-- Migración 003 · Sprint 2 — Administración base y catálogo
-- Historias cubiertas: HU-007 a HU-009, HU-011 a HU-017
-- (HU-004/HU-005 ya existían desde Sprint 1; en Sprint 2 su UI se integra a
-- la vista de gestión de usuarios que aquí se soporta)
-- Tablas nuevas: SECUENCIA_CODIGO, MESA, TIPO_PRODUCTO, PRODUCTO,
--                PRODUCTO_PRECIO_HISTORIAL
-- Tabla modificada: SEDE (se agrega codigo_sede)
-- Sin BEGIN/COMMIT propios — ver nota en 001_sprint1_fundaciones.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECUENCIA_CODIGO
-- Contador atómico genérico para generar consecutivos sin colisiones bajo
-- concurrencia (HU-007 CA-06: "el sistema garantiza que el nuevo consecutivo
-- sea único"). Una fila por "ámbito" de numeración:
--   'SEDE'          -> consecutivo para codigo_sede (SE01, SE02, ...)
--   'GEN-ADM'       -> consecutivo global para usuarios Administrador
--   '{codigo_sede}-{ROL}' -> consecutivo por sede y rol (ej. 'SE01-CAJ')
-- El incremento se hace con INSERT ... ON CONFLICT DO UPDATE ... RETURNING
-- en una sola sentencia atómica (ver backend/src/utils/secuencia.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE secuencia_codigo (
    clave           VARCHAR(30) PRIMARY KEY,
    ultimo_valor    INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- SEDE: se agrega codigo_sede (HU-007 CA-01 necesita el token [SEDE], ej.
-- "SE01", para construir el código de usuario). Se añade nullable, se hace
-- backfill determinista de las sedes ya existentes (por id_sede ascendente,
-- sin asumir que solo existe la sede sembrada en Sprint 1 — pudieron haberse
-- creado más vía HU-010 antes de este Sprint 2), y luego se deja NOT NULL +
-- UNIQUE.
-- ----------------------------------------------------------------------------
ALTER TABLE sede ADD COLUMN codigo_sede VARCHAR(10);

WITH numeradas AS (
    SELECT id_sede, ROW_NUMBER() OVER (ORDER BY id_sede) AS n
    FROM sede
    WHERE codigo_sede IS NULL
)
UPDATE sede
SET codigo_sede = 'SE' || LPAD(numeradas.n::text, 2, '0')
FROM numeradas
WHERE sede.id_sede = numeradas.id_sede;

ALTER TABLE sede ALTER COLUMN codigo_sede SET NOT NULL;
ALTER TABLE sede ADD CONSTRAINT uq_sede_codigo UNIQUE (codigo_sede);

-- Deja la secuencia de sedes lista para continuar desde donde van las
-- existentes (en vez de reiniciar en 0 y volver a chocar con "SE01").
INSERT INTO secuencia_codigo (clave, ultimo_valor)
SELECT 'SEDE', COUNT(*) FROM sede
ON CONFLICT (clave) DO NOTHING;

-- Lo mismo para GEN-ADM: Sprint 1 ya sembró 2 administradores
-- (GEN-ADM-001, GEN-ADM-002) directamente por SQL, sin pasar por este
-- contador; se deja la secuencia en el valor correcto para que el próximo
-- usuario Administrador creado desde HU-007 continúe en GEN-ADM-003.
INSERT INTO secuencia_codigo (clave, ultimo_valor)
SELECT 'GEN-ADM', COUNT(*) FROM usuario WHERE perfil = 'ADMINISTRADOR'
ON CONFLICT (clave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- MESA (HU-011, HU-012)
-- estado: LIBRE al crearse (CA-01 HU-011). OCUPADA se usará desde Sprint 3
-- cuando exista PEDIDO (HU-025 abre un pedido sobre una mesa libre).
-- INACTIVA representa la inactivación de HU-012 (no se elimina el registro,
-- se retira de operación conservando el histórico, igual que USUARIO).
-- No existe "fusión" de mesas (CA-04 HU-011) ni reservas (CA-05 HU-011): no
-- hay columnas ni tablas para eso, intencionalmente.
-- ----------------------------------------------------------------------------
CREATE TABLE mesa (
    id_mesa         SERIAL PRIMARY KEY,
    id_sede         INTEGER NOT NULL REFERENCES sede(id_sede),
    identificador   VARCHAR(30) NOT NULL,
    estado          VARCHAR(10) NOT NULL DEFAULT 'LIBRE'
                        CHECK (estado IN ('LIBRE', 'OCUPADA', 'INACTIVA')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- El mismo identificador ("Mesa 1") puede repetirse en sedes distintas,
    -- pero no duplicarse dentro de una misma sede.
    CONSTRAINT uq_mesa_sede_identificador UNIQUE (id_sede, identificador)
);

CREATE INDEX idx_mesa_sede ON mesa(id_sede);
CREATE INDEX idx_mesa_estado ON mesa(estado);

-- ----------------------------------------------------------------------------
-- TIPO_PRODUCTO (HU-013)
-- ----------------------------------------------------------------------------
CREATE TABLE tipo_producto (
    id_tipo_producto    SERIAL PRIMARY KEY,
    nombre              VARCHAR(80) NOT NULL UNIQUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- PRODUCTO (HU-014, HU-015, HU-016, HU-017)
-- codigo: a diferencia del código de USUARIO (HU-007, autogenerado y de solo
-- lectura), el mockup de HU-014 lista "código" como campo del formulario sin
-- indicar que sea generado — se modela como dato que ingresa el
-- Administrador, único globalmente (CA-01).
-- valor_compra/valor_venta reflejan siempre el precio VIGENTE (CA-01 HU-015);
-- el histórico completo, incluido el valor inicial (CA-06 HU-014), vive en
-- PRODUCTO_PRECIO_HISTORIAL.
-- ----------------------------------------------------------------------------
CREATE TABLE producto (
    id_producto         SERIAL PRIMARY KEY,
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL,
    id_tipo_producto    INTEGER NOT NULL REFERENCES tipo_producto(id_tipo_producto),
    valor_compra        NUMERIC(12,2) NOT NULL CHECK (valor_compra >= 0),
    valor_venta         NUMERIC(12,2) NOT NULL CHECK (valor_venta >= 0),
    estado              VARCHAR(10) NOT NULL DEFAULT 'ACTIVO'
                            CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_producto_tipo ON producto(id_tipo_producto);
CREATE INDEX idx_producto_estado ON producto(estado);

-- ----------------------------------------------------------------------------
-- PRODUCTO_PRECIO_HISTORIAL (HU-015)
-- Cada fila es un precio que estuvo vigente desde `vigente_desde`. CA-02 de
-- HU-015 ("un reporte sobre una operación anterior a un cambio de precio usa
-- el valor vigente en la fecha de esa operación") se resuelve en Sprint 3
-- consultando aquí la fila con mayor vigente_desde <= fecha de la operación.
-- ----------------------------------------------------------------------------
CREATE TABLE producto_precio_historial (
    id_historial        BIGSERIAL PRIMARY KEY,
    id_producto         INTEGER NOT NULL REFERENCES producto(id_producto),
    valor_compra        NUMERIC(12,2) NOT NULL,
    valor_venta         NUMERIC(12,2) NOT NULL,
    vigente_desde        TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_usuario_registro INTEGER REFERENCES usuario(id_usuario),
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_producto_fecha ON producto_precio_historial(id_producto, vigente_desde);
