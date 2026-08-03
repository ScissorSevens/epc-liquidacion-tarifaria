-- Migration 023_parametros_tarifa_anio_base
-- Res CRA 825/2017 Art. 7 y Art. 11: el ParametrosTarifa debe
-- declarar el año base de la metodología tarifaria y el factor
-- IPC persistido.
--
-- Cambia `param-tarifa-res-825-compliance-phase1` (fase 1).
--
-- Decisiones:
--  - `anio_base` INTEGER NOT NULL DEFAULT 2016:
--    Filas preexistentes (sin valor explícito) quedan con 2016,
--    que es el default normativo (Res CRA 825/2017 toma como
--    punto de partida la serie IPC DANE 2016).
--  - `factor_indexacion_ipc` REAL NOT NULL DEFAULT 1.0:
--    Default 1.0 (sin indexación). Cuando el admin setea el
--    override manual, se persiste el valor exacto. Cuando no,
--    se calcula como `IPC_VALORES[anio_destino] / IPC_VALORES[anio_base]`.
--  - CHECK (anio_base >= 1900): un año válido de 4 dígitos.
--  - CHECK (factor_indexacion_ipc >= 0): el factor no puede ser negativo.
--  - Idempotencia: simples ALTER ... ADD COLUMN. SQLite < 3.35 no
--    soporta `IF NOT EXISTS` para ALTER, pero el runner controla
--    por `user_version` (no-op si version coincide). Las migraciones
--    020 ya usan este mismo patrón con su helper idempotente.

ALTER TABLE parametros_tarifa ADD COLUMN anio_base INTEGER NOT NULL DEFAULT 2016
  CHECK (anio_base >= 1900);

ALTER TABLE parametros_tarifa ADD COLUMN factor_indexacion_ipc REAL NOT NULL DEFAULT 1.0
  CHECK (factor_indexacion_ipc >= 0);
