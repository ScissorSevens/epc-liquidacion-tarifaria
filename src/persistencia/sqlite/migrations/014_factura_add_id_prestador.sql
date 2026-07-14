-- Migration 014_factura_add_id_prestador
-- Denormaliza id_prestador en factura. Idem logica que lectura
-- (ver migration 013).
--
-- Decisiones:
--  - DEFAULT 0: facturas legacy quedan asociadas a prestador legacy.
--  - FK NO enforzada por denormalizacion intencional (idem 013).
--  - Indice por id_prestador para reportes y filtros admin.

ALTER TABLE factura ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_factura_prestador ON factura (id_prestador);
