-- Migration 004_suscriptor
-- Aggregate raiz del modelo de clientes (modulo `src/suscriptores/`).
--
-- Decisiones:
--  - PK: INTEGER AUTOINCREMENT, mismo patron que `lectura`.
--  - codigo es la clave de negocio (ej. EPC "0005"). UNIQUE como
--    constraint nombrada para que el adapter pueda traducir el
--    SQLITE_CONSTRAINT_UNIQUE al mensaje de dominio.
--  - estrato CHECK [1,6] espeja la validacion en `crearSuscriptor`.
--  - estado CHECK enum espeja `EstadoSuscriptor` y deja DEFAULT
--    'activo' como fallback si el INSERT no lo provee (defensa, el
--    dominio siempre lo provee).
--  - matricula_inmobiliaria y numero_catastral son NULL por contrato:
--    son opcionales en el catastro real.
--  - created_at se setea via DEFAULT con ISO 8601 (formato simplificado
--    sin milisegundos: el dominio compara con `slice(0,10)` para fechas
--    de medidor pero aca no es relevante porque created_at es metadato
--    de auditoria, no campo de negocio).
--  - Indice por estrato: sirve para reportes de subsidio cruzado por
--    estrato (consulta tipica del modelo EPC).

CREATE TABLE IF NOT EXISTS suscriptor (
    id_suscriptor          INTEGER   PRIMARY KEY AUTOINCREMENT,
    codigo                 TEXT      NOT NULL,
    nombre_apellidos       TEXT      NOT NULL,
    direccion              TEXT      NOT NULL,
    estrato                INTEGER   NOT NULL CHECK (estrato BETWEEN 1 AND 6),
    matricula_inmobiliaria TEXT      NULL,
    numero_catastral       TEXT      NULL,
    estado                 TEXT      NOT NULL DEFAULT 'activo'
                                     CHECK (estado IN ('activo','inactivo','suspendido')),
    created_at             TEXT      NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')),
    CONSTRAINT uk_suscriptor_codigo UNIQUE (codigo)
);
CREATE INDEX IF NOT EXISTS ix_suscriptor_estrato ON suscriptor (estrato);
