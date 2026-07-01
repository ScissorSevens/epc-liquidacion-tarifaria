-- Migration 013_lectura_add_id_prestador
-- Denormaliza id_prestador en lectura. La lectura hereda el prestador
-- del suscriptor al momento de captura; no se rederiva al sincronizar.
--
-- Decisiones:
--  - DEFAULT 0: lecturas legacy quedan asociadas a prestador legacy.
--  - FK NO enforzada (REFERENCES omitido): denormalizacion intencional;
--    el prestador se resuelve via suscriptor.id_suscriptor -> suscriptor.id_prestador.
--    Se mantiene en el dominio la validacion cruzada.
--  - Indice por id_prestador para queries de sync/reporte.

ALTER TABLE lectura ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_lectura_prestador ON lectura (id_prestador);
