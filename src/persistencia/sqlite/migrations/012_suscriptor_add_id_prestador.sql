-- Migration 012_suscriptor_add_id_prestador
-- Agrega id_prestador y categoria_uso a la tabla suscriptor.
--
-- Decisiones criticas:
--  - prestador id=0 YA EXISTE (semilla en 009_prestador.sql) -> FK valida.
--  - DEFAULT 0 para id_prestador: compatibilidad con suscriptores legacy.
--  - DEFAULT 'residencial' para categoria_uso: alineado con Q10 spec.
--  - Indice idx_suscriptor_prestador para queries multi-tenant eficientes.
--
-- ORDEN DE EJECUCION: esta migration DEBE correr DESPUES de 009_prestador.

ALTER TABLE suscriptor ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0 REFERENCES prestador(id_prestador);

ALTER TABLE suscriptor ADD COLUMN categoria_uso TEXT NOT NULL DEFAULT 'residencial'
  CHECK (categoria_uso IN ('residencial', 'comercial', 'industrial', 'oficial', 'especial'));

CREATE INDEX idx_suscriptor_prestador ON suscriptor (id_prestador);
CREATE INDEX idx_suscriptor_categoria_uso ON suscriptor (categoria_uso);
