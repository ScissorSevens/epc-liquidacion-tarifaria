-- Migration 001_factura
-- Phase 5 Batch 3 (persistencia-sqlite): schema de la tabla factura.
-- Triangulación incremental por cycles TDD; columnas/constraints van apareciendo
-- en cycles 5.1–5.7. Ver design.md D7 (UNIQUE parcial sobre liquidacion_id).

CREATE TABLE factura (
  id              TEXT,
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
