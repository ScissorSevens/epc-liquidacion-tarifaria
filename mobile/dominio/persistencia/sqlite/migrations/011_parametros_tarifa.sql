-- Migration 011_parametros_tarifa
-- Crea la tabla parametros_tarifa: parametros del prestador para un
-- periodo tarifario concreto (Res 825/2017: periodo = 5 anos).
--
-- Decisiones:
--  - PK: INTEGER (id_parametros) autoincremental.
--  - FKs: id_prestador, id_acuerdo. Parametros siempre referencian
--    al Acuerdo vigente que los origina.
--  - Costos medios (cma, cmo, cmi, cmt, cmviaa) son insumos del motor
--    segun Res 825/2017 art. 9-10 mod. Res 907/2019 art. 14.
--  - agua_suministrada_m3_anio e ipuf_m3_suscriptor_mes son insumos
--    para calcular el denominador ASP (Art. 17/19 Res 825/2017).
--  - suscriptores_promedio = N (insumo para CF = CMA/N y para ASP).
--  - aplica_minimo_vital + m3_gratis_minimo_vital: flag opcional (default false).
--  - UNIQUE(id_prestador, periodo, vigente_desde): garantiza unicidad de
--    Parametros por prestador/periodo/inicio vigencia.
--  - Indice compuesto (id_prestador, periodo) para busquedas "vigente".

CREATE TABLE parametros_tarifa (
  id_parametros              INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador               INTEGER NOT NULL REFERENCES prestador(id_prestador),
  id_acuerdo                 INTEGER NOT NULL REFERENCES acuerdo_municipal(id_acuerdo),
  periodo                    INTEGER NOT NULL CHECK (periodo >= 2000),
  cma                        REAL    NOT NULL CHECK (cma >= 0),
  cmo                        REAL    NOT NULL CHECK (cmo >= 0),
  cmi                        REAL    NOT NULL CHECK (cmi >= 0),
  cmt                        REAL    NOT NULL CHECK (cmt >= 0),
  cmviaa                     REAL    NOT NULL DEFAULT 0 CHECK (cmviaa >= 0),
  aplica_cmviaa              INTEGER NOT NULL DEFAULT 0 CHECK (aplica_cmviaa IN (0, 1)),
  agua_suministrada_m3_anio  REAL    NOT NULL CHECK (agua_suministrada_m3_anio >= 0),
  ipuf_m3_suscriptor_mes     REAL    NOT NULL DEFAULT 6 CHECK (ipuf_m3_suscriptor_mes >= 0),
  suscriptores_promedio      INTEGER NOT NULL CHECK (suscriptores_promedio > 0),
  aplica_minimo_vital        INTEGER NOT NULL DEFAULT 0 CHECK (aplica_minimo_vital IN (0, 1)),
  m3_gratis_minimo_vital     INTEGER NOT NULL DEFAULT 0 CHECK (m3_gratis_minimo_vital >= 0),
  vigente_desde              TEXT    NOT NULL,
  vigente_hasta              TEXT    NOT NULL,
  created_at                 TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
  UNIQUE (id_prestador, periodo, vigente_desde)
);

CREATE INDEX idx_parametros_prestador_periodo
  ON parametros_tarifa (id_prestador, periodo);
