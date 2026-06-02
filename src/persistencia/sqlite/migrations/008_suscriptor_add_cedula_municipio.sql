-- Migration 008_suscriptor_add_cedula_municipio
-- Agrega columnas cedula, municipio, sector y calle a la tabla suscriptor.
--
-- Decisiones:
--  - cedula TEXT NOT NULL DEFAULT '': compatibilidad con suscriptores
--    existentes; se completara manualmente post-migracion.
--  - municipio TEXT NOT NULL DEFAULT '': idem.
--  - sector TEXT NULL: campo geografico opcional.
--  - calle TEXT NULL: campo geografico opcional.

ALTER TABLE suscriptor ADD COLUMN cedula    TEXT NOT NULL DEFAULT '';
ALTER TABLE suscriptor ADD COLUMN municipio TEXT NOT NULL DEFAULT '';
ALTER TABLE suscriptor ADD COLUMN sector    TEXT NULL;
ALTER TABLE suscriptor ADD COLUMN calle     TEXT NULL;
