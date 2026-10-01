-- ============================================================================
-- Migración 004 · Sprint 2 — Ajustes acordados con el cliente tras probar
-- el Sprint 2 en ambiente real (no estaban en el Product Backlog original,
-- se documentan también en el README bajo "Decisiones técnicas relevantes"):
--
-- 1. HU-012 (mesas): el documento solo define "inactivar", sin camino de
--    vuelta (a diferencia de HU-008 y HU-016, que sí reactivan). Se agrega
--    la acción "activar" por consistencia operativa, con el mismo control
--    de acceso que exige CA-03 (solo Administrador).
-- 2. HU-014 (productos): el código deja de ser un campo que digita el
--    Administrador y pasa a generarse igual que el de usuarios (HU-007):
--    PDT-{abreviación del tipo de producto}-{consecutivo}, ej. PDT-AGU-001.
--    (1) no requiere cambios de esquema — MESA ya soporta estado LIBRE.
--    (2) sí requiere una columna nueva: la abreviación de 3 letras de cada
--    tipo de producto, de donde sale el segmento [AGU] del código.
-- Sin BEGIN/COMMIT propios — ver nota en 001_sprint1_fundaciones.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TIPO_PRODUCTO.abreviacion
-- 3 letras, derivadas automáticamente del nombre al crear el tipo (sin
-- tildes/ñ normalizados, solo letras) — ver generarAbreviacion() en
-- tipos-producto.service.ts. Es inmutable una vez asignada: si se renombra
-- el tipo después, la abreviación no cambia, para no alterar el significado
-- de códigos de producto ya generados.
-- ----------------------------------------------------------------------------
ALTER TABLE tipo_producto ADD COLUMN abreviacion VARCHAR(3);

-- Backfill para tipos ya existentes (creados antes de este ajuste). Mismo
-- criterio de normalización que el backend (sin tildes/ñ, solo letras,
-- primeras 3). Si dos tipos ya existentes colisionan en sus 3 primeras
-- letras, se desempata con un dígito (caso borde de datos de prueba
-- previos a esta migración; los tipos creados DESDE AHORA usan el
-- algoritmo de ventana deslizante del backend, que evita colisiones sin
-- recurrir a dígitos).
WITH base AS (
    SELECT id_tipo_producto,
           UPPER(LEFT(REGEXP_REPLACE(
               TRANSLATE(nombre, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'),
               '[^A-Za-z]', '', 'g'
           ), 3)) AS abrev_base
    FROM tipo_producto
    WHERE abreviacion IS NULL
),
rankeadas AS (
    SELECT id_tipo_producto, abrev_base,
           ROW_NUMBER() OVER (PARTITION BY abrev_base ORDER BY id_tipo_producto) AS rn
    FROM base
)
UPDATE tipo_producto t
SET abreviacion = CASE
    WHEN r.rn = 1 THEN r.abrev_base
    ELSE LEFT(r.abrev_base, 2) || SUBSTRING(r.rn::text FROM 1 FOR 1)
END
FROM rankeadas r
WHERE t.id_tipo_producto = r.id_tipo_producto;

ALTER TABLE tipo_producto ALTER COLUMN abreviacion SET NOT NULL;
ALTER TABLE tipo_producto ADD CONSTRAINT uq_tipo_producto_abreviacion UNIQUE (abreviacion);

-- Nota sobre PRODUCTO.codigo: no se modifica su esquema (sigue siendo
-- VARCHAR(30) UNIQUE). Los productos creados ANTES de este ajuste conservan
-- el código que el Administrador escribió a mano; los creados DESDE AHORA
-- reciben uno generado con el prefijo fijo "PDT". No hay backfill de
-- productos existentes: cambiarles el código retroactivamente invalidaría
-- cualquier referencia externa ya impresa/comunicada con el código anterior.
