-- ============================================================================
-- Seed inicial — datos mínimos para arrancar y poder iniciar sesión.
--
-- No es una Historia de Usuario: es el "bootstrap" operativo. HU-007 (crear
-- usuarios desde la UI) es de Sprint 2, pero sin al menos un Administrador
-- creado de antemano nadie podría entrar a usar esa pantalla. HU-004 CA-03
-- exige, además, que existan al menos dos Administradores (para que uno
-- pueda desbloquear al otro), así que el seed crea dos.
--
-- Contraseña inicial de ambos: ElPunto#2026  (CÁMBIALA apenas inicies sesión,
-- con HU-002 "Cambiar contraseña propia").
--
-- El hash se generó con el mismo algoritmo que usa el backend
-- (Node crypto.scrypt, ver backend/src/utils/password.ts) — formato
-- "salt_hex:hash_hex".
-- ============================================================================

INSERT INTO sede (nombre, direccion) VALUES
    ('Sede Centro', 'Calle 10 # 5-20, Bogotá');

INSERT INTO usuario (codigo_usuario, nombre, id_sede, perfil, password_hash, estado) VALUES
    ('GEN-ADM-001', 'Administrador Principal', NULL, 'ADMINISTRADOR',
     '84152f9a6b102c9aee5e87983bafb824:67c20737ada24b8892585f06d1d573b32d9807e957762a6a608e8a62cc2eda86f9030e736c7c41b3d1a951ba971db3fbaeaf81e41274b92a5fb328eafcdb85e3',
     'ACTIVO'),
    ('GEN-ADM-002', 'Administrador Suplente', NULL, 'ADMINISTRADOR',
     '85201c0976b8761448634b130776e385:1a24c25b3f6d5f18de85bf2ee923dc2e4a3a0afd54f51f9a3598da458df6aedad850c1841717b47a1d61518a5e6fa8ba7ebfd350e2eec076eb0447f161a38d87',
     'ACTIVO');
