-- Migration 005_medidor
-- Aggregate del dispositivo fisico de medicion (modulo `src/medidores/`).
--
-- Decisiones:
--  - PK: INTEGER AUTOINCREMENT, mismo patron que `suscriptor`.
--  - numero_medidor es la clave de negocio (serial fisico). UNIQUE como
--    constraint nombrada para que el adapter pueda traducir el
--    SQLITE_CONSTRAINT_UNIQUE al mensaje de dominio claro.
--  - id_suscriptor es FK a suscriptor.id_suscriptor. ON DELETE RESTRICT
--    porque borrar un suscriptor con medidores asignados deberia ser
--    operacion explicita (primero reemplazar/dar de baja medidor). El
--    PRAGMA foreign_keys=ON ya esta activo en `crearConexion`.
--  - estado CHECK enum espeja `EstadoMedidor` y deja DEFAULT 'activo'
--    como fallback (defensa, el dominio siempre lo provee).
--  - observaciones es NULL por contrato (campo opcional de catastro).
--  - fecha_instalacion: TEXT en ISO 8601 (YYYY-MM-DD), validacion
--    primaria en dominio. NO ponemos CHECK de formato porque el dominio
--    ya lo valida y el CHECK SQL haria triggers oscuros.
--  - created_at: ISO 8601 simplificado (igual que suscriptor/lectura).
--  - Indice por id_suscriptor: sirve para listarPorSuscriptor (consulta
--    tipica del flujo "ver medidores del cliente X").

CREATE TABLE IF NOT EXISTS medidor (
    id_medidor        INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_medidor    TEXT    NOT NULL,
    id_suscriptor     INTEGER NOT NULL,
    fecha_instalacion TEXT    NOT NULL,
    estado            TEXT    NOT NULL DEFAULT 'activo'
                              CHECK (estado IN ('activo','inactivo','reemplazado')),
    observaciones     TEXT    NULL,
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')),
    CONSTRAINT uk_medidor_numero UNIQUE (numero_medidor),
    CONSTRAINT fk_medidor_suscriptor FOREIGN KEY (id_suscriptor)
        REFERENCES suscriptor (id_suscriptor) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_medidor_suscriptor ON medidor (id_suscriptor);
