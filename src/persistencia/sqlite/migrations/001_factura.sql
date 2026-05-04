-- Migration 001_factura
-- Phase 5 Batch 3 (persistencia-sqlite): schema de la tabla factura.
-- Triangulación incremental por cycles TDD; columnas/constraints van apareciendo
-- en cycles 5.1–5.7. Ver design.md D7 (UNIQUE parcial sobre liquidacion_id).

CREATE TABLE factura (
  id              TEXT PRIMARY KEY,
  numero_factura  TEXT,
  estado          TEXT CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA')),
  fecha_emision   TEXT,
  snapshot        TEXT,
  hash            TEXT,
  liquidacion_id  TEXT,
  id_periodo      TEXT,
  id_suscriptor   INTEGER,
  created_at      TEXT,
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
