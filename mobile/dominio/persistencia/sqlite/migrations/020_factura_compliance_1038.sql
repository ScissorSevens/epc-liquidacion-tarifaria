-- Migration 020_factura_compliance_1038
-- Res CRA 1038/2026 compliance: agrega columnas para busqueda operativa
-- de codigo de verificacion, referencia de pago, QR y version de tarifa
-- aplicada. Estas columnas ya viven en el snapshot JSON desde v2, pero
-- persisitrlas como columnas dedicadas permite:
--   1. Busqueda operativa por codigo_verificacion / referencia_pago.
--   2. Reportes regulatorios sin parsear JSON.
--   3. Indice sobre referencia_pago para reconciliacion con backend.
--
-- Decisiones:
--  - Nullable TEXT: facturas historicas (pre-2027) NO tendran estos
--    campos hasta que se reemitan. Las nuevas los traen del factory.
--  - DEFAULT NULL: no fuerza default para preservar shape actual.
--  - Idempotencia: la migration 020 NO es idempotente en SQLite
--    (3.35 no soporta 'ADD COLUMN IF NOT EXISTS'). El bootstrap
--    runner detecta la tabla __migraciones_aplicadas y NO la
--    re-ejecuta. Para correr en DBs muy viejas con la tabla ya
--    modificada, se necesita un skip explicito.
--  - Indice UNIQUE sobre referencia_pago: garantiza unicidad operativa
--    para conciliacion con sistemas externos de pago.
--  - NO crear indices en codigo_verificacion / qr_pago: son derivados
--    del hash canonico (codigo_verificacion) y referencia_pago (qr),
--    respectivamente. buscarPorId es O(log n) via PK.

ALTER TABLE factura ADD COLUMN codigo_verificacion TEXT;
ALTER TABLE factura ADD COLUMN referencia_pago TEXT;
ALTER TABLE factura ADD COLUMN qr_pago TEXT;
ALTER TABLE factura ADD COLUMN version_tarifa_aplicada TEXT;

CREATE UNIQUE INDEX idx_factura_referencia_pago_unique
  ON factura (referencia_pago)
  WHERE referencia_pago IS NOT NULL;
