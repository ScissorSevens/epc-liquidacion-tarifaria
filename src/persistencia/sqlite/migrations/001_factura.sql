-- Migration 001_factura
-- Phase 5 Batch 3 (persistencia-sqlite): schema mínimo de la tabla factura.
-- Triangulación incremental — esta versión inicial solo declara la tabla con id.
-- Cycles posteriores agregan columnas, CHECK estado, NOT NULL, UNIQUE parcial D7.

CREATE TABLE factura (
  id TEXT PRIMARY KEY
);
