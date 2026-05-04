-- Migration 002_lectura
-- Adapter SQLite del modulo persistencia (LecturaRepository).
-- Schema construido a partir del tipo `Lectura` real en captura-lecturas/types.ts
-- y de la interface `LecturaRepository` en persistencia/lectura-repository.ts.
--
-- Decisiones:
--  - PK: INTEGER AUTOINCREMENT porque `Lectura.id_lectura?: number` y el
--    adapter in-memory ya usaba ids autoincrementales (nextId++). El adapter
--    SQLite delega la asignacion del id a SQLite via lastInsertRowid.
--  - lectura_actual / lectura_anterior: REAL porque m^3 puede ser decimal.
--  - evidencia: aplanada a evidencia_foto_path + evidencia_foto_hash (nullable).
--    En captura es opcional; al validar pasa a obligatoria, pero esa regla es
--    de DOMINIO, no de schema.
--  - estado_validacion / estado_sync: CHECK con literales del tipo TS.
--  - UNIQUE (id_medidor, id_periodo): defensa de unicidad del invariante
--    de dominio "una lectura por medidor por periodo". El adapter mapea
--    el SQLITE_CONSTRAINT_UNIQUE al mensaje de dominio en espaniol.
--  - Indices: por id_periodo (listarPorPeriodo), por id_medidor (historial /
--    listar con filtro), por estado_sync (listarPendientesSync).

CREATE TABLE lectura (
  id_lectura          INTEGER PRIMARY KEY AUTOINCREMENT,
  id_medidor          INTEGER NOT NULL,
  id_periodo          TEXT    NOT NULL,
  id_operario         INTEGER NOT NULL,
  lectura_actual      REAL    NOT NULL,
  lectura_anterior    REAL    NOT NULL,
  evidencia_foto_path TEXT,
  evidencia_foto_hash TEXT,
  estado_validacion   TEXT    NOT NULL CHECK (estado_validacion IN ('pendiente','validado','error')),
  observaciones       TEXT,
  timestamp_captura   TEXT    NOT NULL,
  timestamp_sync      TEXT,
  estado_sync         TEXT    NOT NULL CHECK (estado_sync IN ('pendiente','sincronizado','error'))
);

-- Defensa de unicidad: una lectura por medidor por periodo.
CREATE UNIQUE INDEX idx_lectura_medidor_periodo
  ON lectura (id_medidor, id_periodo);

-- listarPorPeriodo (consultas de listado por periodo).
CREATE INDEX idx_lectura_periodo
  ON lectura (id_periodo);

-- listar({ id_medidor }) e historial de un medidor.
CREATE INDEX idx_lectura_medidor
  ON lectura (id_medidor);

-- listarPendientesSync (filtro frecuente desde el cliente movil).
CREATE INDEX idx_lectura_estado_sync
  ON lectura (estado_sync);
