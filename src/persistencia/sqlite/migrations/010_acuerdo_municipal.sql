-- Migration 010_acuerdo_municipal
-- Crea la tabla acuerdo_municipal que modela el Acuerdo Municipal tipado
-- de cada prestador (ver Q6 spec). Un prestador puede tener multiples
-- Acuerdos (historial) pero solo uno vigente en cualquier momento.
--
-- Decisiones:
--  - PK: INTEGER (id_acuerdo) autoincremental.
--  - FK id_prestador al prestador.
--  - Factores de subsidio negativos: tope legal L142/1994 art. 99.6:
--      E1 <= -0.60, E2 <= -0.50, E3 <= -0.40. No acotamos aqui para
--      que el motor CAPE (motor-tarifario.ts: caparFactorEstrato) al
--      momento del calculo y registre violacion.
--  - Factores de contribucion positivos: E5 <= +0.50, E6 <= +0.60.
--  - factor_contribucion_comercial default +0.50 (L142/1994 art. 99.6).
--  - factor_contribucion_industrial default +0.30 (L142/1994 art. 99.6).
--  - fecha_vigencia_desde / fecha_vigencia_hasta: ISO 8601.
--  - Indice compuesto (id_prestador, fecha_vigencia_desde, fecha_hasta)
--    para busquedas "vigente en fecha X" eficientes.

CREATE TABLE acuerdo_municipal (
  id_acuerdo                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador                  INTEGER NOT NULL REFERENCES prestador(id_prestador),
  factor_subsidio_e1            REAL    NOT NULL,
  factor_subsidio_e2            REAL    NOT NULL,
  factor_subsidio_e3            REAL    NOT NULL,
  factor_contribucion_e5        REAL    NOT NULL,
  factor_contribucion_e6        REAL    NOT NULL,
  factor_contribucion_comercial REAL    NOT NULL DEFAULT 0.50 CHECK (factor_contribucion_comercial >= 0),
  factor_contribucion_industrial REAL   NOT NULL DEFAULT 0.30 CHECK (factor_contribucion_industrial >= 0),
  fecha_vigencia_desde          TEXT    NOT NULL,
  fecha_vigencia_hasta          TEXT    NOT NULL,
  acto_administrativo_url       TEXT    NULL,
  observaciones                 TEXT    NULL,
  created_at                    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
);

CREATE INDEX idx_acuerdo_prestador_vigencia
  ON acuerdo_municipal (id_prestador, fecha_vigencia_desde, fecha_vigencia_hasta);
