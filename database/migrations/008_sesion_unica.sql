-- Sesión única por usuario: cada inicio de sesión genera un identificador de
-- sesión nuevo y reemplaza al anterior. Un token cuyo identificador ya no
-- coincide (porque el usuario ingresó desde otro dispositivo, o cerró sesión)
-- deja de ser válido en la siguiente petición.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS sesion_id UUID;
