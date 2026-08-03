-- Migration 022_prestador_aps
-- Res CRA 825/2017 Art. 5: el prestador debe declarar el Área de
-- Prestación del Servicio (APS) declarada ante la CRA.
--
-- Cambia `param-tarifa-res-825-compliance-phase1` (fase 1).
--
-- Decisiones:
--  - `aps` TEXT NULL DEFAULT NULL:
--    Opcional. Un prestador sin valor persiste con `aps = null`,
--    legacy compatible (filas preexistentes quedan con null).
--  - Sin CHECK constraint: la APS es texto libre definido por
--    regulación (no es enum).
--  - Idempotencia: simple ALTER ADD COLUMN. El runner controla
--    por `user_version` (Node) o `__migraciones_aplicadas` (Expo).
--    Si la DB fue restaurada con un user_version atrasado, el
--    ALTER tira "duplicate column" — guardamos desde TypeScript
--    via PRAGMA table_info (mismo patron que 020).

ALTER TABLE prestador ADD COLUMN aps TEXT NULL DEFAULT NULL;
