-- Migration 019: ParametrosTarifa completo (Res CRA 825/2017 compliance).
--
-- Los 4 puntos acordados con el user:
--   1. ipuf_indice: Índice de Precios al Usuario Final (multiplicador
--      periódico para actualizar precios sin re-emitir metodología).
--   2. cargo_fijo_resultante + cargo_consumo_resultante: pre-calculados
--      al guardar (= CMA/N / = CMO+CMI+CMT+CMVIAA). PERSISTIDOS. No se
--      recalculan en cada factura → decoupling metodologico crítico.
--   3. componentes_aplicables: array JSON con IDs de componentes
--      activos. Permite que segmento 2 rural desactive CMVIAA, etc.
--   4. minimo_vital: tabla separada 1:1 con prestador, con su PROPIA
--      vigencia (independiente del periodo tarifario). Opcional.
--
-- Decisiones críticas:
--  - ipuf_indice REAL default 1.0: no-op cuando no hay ajuste.
--  - cargo_fijo_resultante REAL NOT NULL default 0: siempre presente.
--  - cargo_consumo_resultante REAL NOT NULL default 0: idem.
--  - componentes_aplicables TEXT: JSON serializado. Mas rápido que
--    tabla relacionada para un set chico y cerrado (5 elementos).
--  - minimo_vital: tabla con FK a prestador + UNIQUE(id_prestador,
--    vigente_desde) garantiza 1 vigente a la vez por prestador.
--  - FK minimo_vital.id_prestador → prestador con ON DELETE CASCADE:
--    un prestador borrado arrastra sus minimos vitales (no tiene
--    sentido quedárselos).
--  - CHECK ipuf_indice >= 0: índice no puede ser negativo.
--  - CHECK metros_cubicos >= 0 o NULL: defense contra valores raros.
--  - JSON.stringify de los componentes_aplicables lo hace la capa
--    repositorio (no podemos asumir que SQLite tenga json_each en
--    todas las versiones del runtime).

-- 1) ParametrosTarifa: 4 columnas nuevas.
ALTER TABLE parametros_tarifa ADD COLUMN ipuf_indice REAL NOT NULL DEFAULT 1.0
  CHECK (ipuf_indice >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN cargo_fijo_resultante REAL NOT NULL DEFAULT 0
  CHECK (cargo_fijo_resultante >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN cargo_consumo_resultante REAL NOT NULL DEFAULT 0
  CHECK (cargo_consumo_resultante >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN componentes_aplicables TEXT NOT NULL DEFAULT '[]';

-- 2) Tabla minimo_vital: 1:1 con prestador (un minimo vital por
--    prestador/inicio-vigencia). Vigencia independiente del periodo
--    tarifario.
CREATE TABLE minimo_vital (
  id_minimo_vital INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador    INTEGER NOT NULL REFERENCES prestador(id_prestador) ON DELETE CASCADE,
  metros_cubicos  INTEGER NULL CHECK (metros_cubicos IS NULL OR metros_cubicos >= 0),
  estratos_aplica TEXT    NOT NULL DEFAULT '[]',  -- JSON array de enteros 1-6
  vigente_desde   TEXT    NOT NULL,
  vigente_hasta   TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
  UNIQUE (id_prestador, vigente_desde)
);

CREATE INDEX idx_minimo_vital_prestador_vigencia
  ON minimo_vital (id_prestador, vigente_desde, vigente_hasta);
