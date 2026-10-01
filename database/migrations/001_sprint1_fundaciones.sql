-- ============================================================================
-- Migración 001 · Sprint 1 — Fundaciones de acceso y estructura
-- Historias cubiertas: HU-001 a HU-006, HU-010, HU-041
-- Tablas: SEDE, USUARIO, TRAZABILIDAD
-- Nota: sin BEGIN/COMMIT propios a propósito — quien ejecuta este archivo
-- (el runner de backend/src/db/migrate.ts, o psql con --single-transaction)
-- controla la transacción, para no anidar bloques.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SEDE (HU-010)
-- No existe inactivación de sedes (CA-04 de HU-010): no hay columna "estado".
-- ----------------------------------------------------------------------------
CREATE TABLE sede (
    id_sede         SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    direccion       VARCHAR(255) NOT NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- USUARIO (soporta HU-001 a HU-009; la UI de creación es HU-007 en Sprint 2,
-- pero la tabla debe existir desde Sprint 1 porque el login depende de ella)
--
-- perfil: 'ADMINISTRADOR' | 'CAJERO' | 'MESERO' — exactamente los 3 roles
-- definidos en la Propuesta Comercial, sin roles adicionales.
--
-- id_sede es NULL únicamente para ADMINISTRADOR (no está asociado a una
-- sede, HU-007 CA-02). Para CAJERO/MESERO es obligatorio (HU-007 CA-04).
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario          SERIAL PRIMARY KEY,
    codigo_usuario      VARCHAR(30) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL,
    id_sede             INTEGER REFERENCES sede(id_sede),
    perfil              VARCHAR(20) NOT NULL
                            CHECK (perfil IN ('ADMINISTRADOR', 'CAJERO', 'MESERO')),
    estado              VARCHAR(10) NOT NULL DEFAULT 'ACTIVO'
                            CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    password_hash       VARCHAR(255) NOT NULL,
    intentos_fallidos   SMALLINT NOT NULL DEFAULT 0,
    bloqueado           BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- HU-007 CA-04: Cajero/Mesero exigen una única sede.
    -- HU-007 CA-02: Administrador no usa sede (prefijo corporativo global).
    CONSTRAINT chk_usuario_sede_segun_perfil CHECK (
        (perfil = 'ADMINISTRADOR' AND id_sede IS NULL)
        OR (perfil IN ('CAJERO', 'MESERO') AND id_sede IS NOT NULL)
    )
);

CREATE INDEX idx_usuario_sede ON usuario(id_sede);
CREATE INDEX idx_usuario_perfil ON usuario(perfil);

-- ----------------------------------------------------------------------------
-- TRAZABILIDAD (HU-041)
-- Registro transversal de eventos relevantes de todo el sistema.
-- entidad_afectada / id_afectado son referencia lógica (no FK), tal como
-- quedó definido en el Documento de Arquitectura (MER, tabla TRAZABILIDAD),
-- porque un mismo registro debe poder sobrevivir aunque la fila referida
-- cambie o se reclasifique, y porque abarca entidades muy distintas entre sí.
-- ----------------------------------------------------------------------------
CREATE TABLE trazabilidad (
    id_evento           BIGSERIAL PRIMARY KEY,
    id_usuario          INTEGER REFERENCES usuario(id_usuario),
    tipo_evento         VARCHAR(60) NOT NULL,
    entidad_afectada    VARCHAR(60) NOT NULL,
    id_afectado         VARCHAR(60),
    id_sede             INTEGER REFERENCES sede(id_sede),
    fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT now(),
    detalle             JSONB
);

CREATE INDEX idx_trazabilidad_usuario ON trazabilidad(id_usuario);
CREATE INDEX idx_trazabilidad_tipo_evento ON trazabilidad(tipo_evento);
CREATE INDEX idx_trazabilidad_sede ON trazabilidad(id_sede);
CREATE INDEX idx_trazabilidad_fecha ON trazabilidad(fecha_hora);
