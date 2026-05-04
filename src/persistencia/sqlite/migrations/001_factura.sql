-- Migration 001_factura
-- Phase 5 Batch 3 (persistencia-sqlite): schema completo de la tabla factura.
-- Construida por triangulación TDD en cycles 5.1–5.7.
-- Refleja design D5 (PK), D7 (UNIQUE parcial), W2 (CHECK estado).

CREATE TABLE factura (
  id               TEXT    PRIMARY KEY,
  numero_factura   TEXT    NOT NULL,
  estado           TEXT    NOT NULL CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA')),
  fecha_emision    TEXT    NOT NULL,
  snapshot         TEXT    NOT NULL,
  hash             TEXT    NOT NULL,
  liquidacion_id   TEXT    NOT NULL,
  id_periodo       TEXT    NOT NULL,
  id_suscriptor    INTEGER NOT NULL,
  created_at       TEXT    NOT NULL,
  motivo_anulacion TEXT,
  fecha_anulacion  TEXT,
  reemplaza_a      TEXT
);

-- D7: UNIQUE parcial. Garantiza 1:1 entre Factura no-anulada y Liquidacion.
-- Una Liquidacion puede aparecer en N filas ANULADA (historial) pero solo en
-- UNA fila con estado en {BORRADOR, EMITIDA, PAGADA}.
CREATE UNIQUE INDEX idx_factura_liquidacion_no_anulada
  ON factura (liquidacion_id)
  WHERE estado != 'ANULADA';
