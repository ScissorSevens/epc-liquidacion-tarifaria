-- Migration 007_suscriptor_add_aplica_subsidio
-- Agrega columna aplica_subsidio a la tabla suscriptor.
--
-- Decisiones:
--  - INTEGER NOT NULL DEFAULT 1: el 1 representa true (aplica subsidio por defecto)
--    para no romper suscriptores existentes que asumían subsidio por estrato.
--  - DEFAULT 1 es conservador: si el dato no existía, se interpreta como "sí aplica".
--  - La columna se mapea a boolean en el dominio: 0 = false, 1 = true.

ALTER TABLE suscriptor ADD COLUMN aplica_subsidio INTEGER NOT NULL DEFAULT 1;
