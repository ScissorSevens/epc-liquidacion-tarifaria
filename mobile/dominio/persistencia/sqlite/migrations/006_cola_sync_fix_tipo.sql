-- Migration 006 — recrea la tabla cola_sincronizacion con el CHECK
-- constraint correcto sobre el campo 'tipo'.
--
-- Por que esta migration existe:
--   El constraint original (v3) no incluía 'MEDIDOR' ni 'SUSCRIPTOR', lo
--   que impedía encolar entidades importadas desde CSV o agregadas
--   manualmente. SQLite no soporta ALTER TABLE para modificar CHECK
--   constraints, asi que la unica opcion valida es recrear la tabla
--   preservando los datos.
--
-- Espejo verbatim de la constante MIGRACION_006_COLA_SYNC_FIX_TIPO en
-- mobile/src/persistencia/expo-sqlite/migraciones.ts (mismo proyecto).
-- Si modificas esta, reflejá el cambio ahi a mano.

ALTER TABLE cola_sincronizacion RENAME TO cola_sincronizacion_v3;
CREATE TABLE cola_sincronizacion (
  id                   TEXT    PRIMARY KEY NOT NULL,
  tipo                 TEXT    NOT NULL CHECK (tipo IN ('LIQUIDACION','LECTURA','EVIDENCIA','EVENTO_AUDITORIA','FACTURA','SUSCRIPTOR','MEDIDOR')),
  payload              TEXT    NOT NULL,
  hash_local           TEXT    NOT NULL,
  hash_server          TEXT,
  estado               TEXT    NOT NULL CHECK (estado IN ('PENDIENTE','ENVIANDO','EXITOSO','CONFLICTO','FALLIDO','DESCARTADO')),
  intentos             INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error         TEXT,
  ultimo_intento_en    TEXT,
  creado_en            TEXT    NOT NULL,
  depende_de           TEXT,
  forzar_sobrescribir  INTEGER
);
INSERT INTO cola_sincronizacion SELECT * FROM cola_sincronizacion_v3;
DROP TABLE cola_sincronizacion_v3;
CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_sincronizacion (estado);
CREATE INDEX IF NOT EXISTS idx_cola_creado_en ON cola_sincronizacion (creado_en);
