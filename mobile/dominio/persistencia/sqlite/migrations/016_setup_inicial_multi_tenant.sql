-- Migration 016: setup inicial multi-tenant.
--
-- Cambia el schema para que operarios sea propiedad de un prestador (multi-tenant).
-- Esta migration es la deuda central del change setup-inicial-multi-tenant-auth.
--
-- Cambios:
--  1) prestador: 2 columnas nuevas (representante_legal, representante_legal_cedula)
--     para la pantalla de SetupInicial paso 1.
--  2) operarios: 1 columna nueva (id_prestador FK con ON DELETE RESTRICT) +
--     cambio del UNIQUE constraint de (dispositivo_id) a (dispositivo_id, id_prestador).
--  3) Índice sobre id_prestador para queries multi-tenant eficientes.
--
-- Decisiones críticas:
--  - DEFAULT 0 para id_prestador: el prestador legacy (id=0) está sembrado
--    en migration 009_prestador.sql, así que la FK se satisface automáticamente
--    para todos los operarios preexistentes. Compatible con DB legacy (T3.1).
--  - ON DELETE RESTRICT: NO se puede borrar un prestador que tenga operarios.
--    Decisión de seguridad: borrar un prestador debe ser operación manual
--    explícita del admin (no cascade).
--  - UNIQUE compuesta (dispositivo_id, id_prestador): dos operarios pueden
--    compartir dispositivo si pertenecen a DISTINTOS prestadores (caso
--    real: tablets corporativas con varios prestadores). Mismo prestador +
--    mismo dispositivo sigue prohibido (T2.4).
--  - WHERE dispositivo_id IS NOT NULL en la UNIQUE: operarios sin dispositivo
--    asignado no ocupan la constraint (varios conviven).
--  - DEFAULT '' para los strings del representante legal: la columna es NOT NULL
--    (defensa contra NULLs no intencionales) pero tolera registros legacy.
--  - SQLite ALTER TABLE admite REFERENCES + ON DELETE desde 3.6.19. better-sqlite3
--    usa SQLite ≥3.40 en mobile/Node, así que el FK se materializa correctamente.
--
-- ORDEN DE EJECUCION: esta migration DEBE correr DESPUES de:
--  - 009_prestador (sembrado del prestador legacy id=0)
--  - 015_operario (creación de la tabla operarios)

-- 1) Tabla prestador: 2 columnas nuevas.
ALTER TABLE prestador ADD COLUMN representante_legal TEXT NOT NULL DEFAULT '';
ALTER TABLE prestador ADD COLUMN representante_legal_cedula TEXT NOT NULL DEFAULT '';

-- 2) Tabla operarios: columna FK + reemplazo del UNIQUE.
ALTER TABLE operarios ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0
  REFERENCES prestador(id_prestador) ON DELETE RESTRICT;

DROP INDEX IF EXISTS idx_operario_dispositivo_unique;
CREATE UNIQUE INDEX idx_operario_dispositivo_prestador_unique
  ON operarios(dispositivo_id, id_prestador)
  WHERE dispositivo_id IS NOT NULL;

-- 3) Índice sobre id_prestador para queries multi-tenant (filtros por
--    prestador activo del workspace).
CREATE INDEX IF NOT EXISTS idx_operario_id_prestador
  ON operarios(id_prestador);