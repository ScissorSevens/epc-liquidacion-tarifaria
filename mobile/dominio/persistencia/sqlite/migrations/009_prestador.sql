-- Migration 009_prestador
-- Crea la tabla prestador (multi-tenant) e inserta el prestador "EPC-LEGACY"
-- con id=0 como default para mantener compatibilidad con suscriptores
-- preexistentes (NO rompe FKs en migrations posteriores).
--
-- Decisiones:
--  - PK: INTEGER (id_prestador) autoincremental.
--  - id_prestador=0 reservado para prestador legacy (semilla).
--  - codigo UNIQUE para evitar duplicados logicos.
--  - segmento CHECK (1, 2) literal Res CRA 825/2017 art. 6.
--  - estado CHECK enum ('activo', 'suspendido') para soft-delete.
--  - Indices por municipio (admin UI) y por estado (filtros default).

CREATE TABLE prestador (
  id_prestador              INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo                    TEXT    NOT NULL UNIQUE,
  nombre                    TEXT    NOT NULL,
  nit                       TEXT    NOT NULL,
  municipio                 TEXT    NOT NULL,
  departamento              TEXT    NOT NULL,
  segmento                  INTEGER NOT NULL CHECK (segmento IN (1, 2)),
  num_suscriptores_urbanos  INTEGER NOT NULL DEFAULT 0 CHECK (num_suscriptores_urbanos >= 0),
  num_suscriptores_rurales  INTEGER NOT NULL DEFAULT 0 CHECK (num_suscriptores_rurales >= 0),
  contacto                  TEXT    NULL,
  estado                    TEXT    NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  created_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
  updated_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
);

-- Admin UI: filtros por municipio y estado.
CREATE INDEX idx_prestador_municipio ON prestador (municipio);
CREATE INDEX idx_prestador_estado ON prestador (estado);

-- Semilla del prestador legacy. id=0 se reserva explicitamente.
-- Las migrations 012/013/014 usan DEFAULT 0 para id_prestador y este
-- registro satisface la FK en cada ALTER TABLE.
INSERT INTO prestador (
  id_prestador, codigo, nombre, nit, municipio, departamento, segmento,
  num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado,
  created_at, updated_at
) VALUES (
  0, 'EPC-LEGACY', 'EPC Legacy (prestador por defecto)',
  '000000000-0', 'No asignado', 'No asignado', 2,
  0, 0, NULL, 'activo',
  strftime('%Y-%m-%dT%H:%M:%S', 'now'), strftime('%Y-%m-%dT%H:%M:%S', 'now')
);
