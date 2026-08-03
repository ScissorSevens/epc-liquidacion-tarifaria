-- Migration 021_concepto_otro_valor
-- Res CRA 1038/2026 §4 (otros conceptos a cobrar/deducir) y §10: el
-- catálogo de `otros_valores` deja de ser constante hardcoded y pasa a
-- tabla SQLite versionada. Cada fila lleva `version` para auditoría
-- regulatoria (vigencia del catálogo).
--
-- Idempotente: `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`. La
-- catalogacion es read-only desde codigo: altas/bajas son regulatorias y
-- requieren nueva migration. Bug fix o re-seed debe pasar por
-- `INSERT OR IGNORE` para no romper en re-ejecucion.
--
-- Decisiones de shape:
--  - `id_concepto` INTEGER PRIMARY KEY AUTOINCREMENT (id interno).
--  - `codigo` TEXT UNIQUE NOT NULL (clave operativa, case-insensitive
--    en busqueda).
--  - `descripcion` TEXT NOT NULL (texto regulatorio).
--  - `version` TEXT NOT NULL (auditoria: '1038-2026-v1' inicial).
--  - `activo` INTEGER NOT NULL DEFAULT 1 (boolean 0/1, SQLite idiom).
--  - `requiere_glosa` INTEGER NOT NULL DEFAULT 0.
--  - `created_at` ISO 8601.
--
-- NO se incluye `deleted_at`: la baja regulatoria es reemplazando el
-- version por uno nuevo ('1038-2026-v2') y re-sembrando con `activo=0`.

CREATE TABLE IF NOT EXISTS concepto_otro_valor (
  id_concepto    INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT    NOT NULL UNIQUE,
  descripcion    TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  requiere_glosa INTEGER NOT NULL DEFAULT 0 CHECK (requiere_glosa IN (0, 1)),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_concepto_otro_valor_activo
  ON concepto_otro_valor (activo);

CREATE INDEX IF NOT EXISTS idx_concepto_otro_valor_version
  ON concepto_otro_valor (version);

-- Seed: 7 conceptos canónicos de Res CRA 1038/2026 §4 §10.
-- INSERT OR IGNORE: idempotente en re-ejecuciones sin violar UNIQUE.
INSERT OR IGNORE INTO concepto_otro_valor
  (codigo, descripcion, version, activo, requiere_glosa)
VALUES
  ('SALDO_ANTERIOR',
   'Saldo pendiente de periodos anteriores',
   '1038-2026-v1', 1, 0),
  ('INTERESES_AUTORIZADOS',
   'Intereses de mora autorizados por la regulación',
   '1038-2026-v1', 1, 1),
  ('RECONEXION',
   'Cargo por reconexión del servicio',
   '1038-2026-v1', 1, 0),
  ('FINANCIACION',
   'Cuota de financiación de deuda previa',
   '1038-2026-v1', 1, 1),
  ('MATERIALES_ACOMETIDA',
   'Materiales de acometida',
   '1038-2026-v1', 1, 0),
  ('AJUSTES_DEVOLUCIONES',
   'Ajustes o devoluciones de periodos anteriores',
   '1038-2026-v1', 1, 1),
  ('OTROS_AUTORIZADOS',
   'Otros conceptos autorizados por la regulación',
   '1038-2026-v1', 1, 1);
