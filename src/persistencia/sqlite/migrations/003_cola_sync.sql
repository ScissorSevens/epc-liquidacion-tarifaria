-- Migration 003_cola_sync
-- Adapter SQLite del modulo sincronizacion (ColaSincronizacion).
-- Resuelve la BOMBA #1 del proyecto: con InMemoryColaSincronizacion la
-- cola offline se perdia al cerrar la app. Sin persistencia el requisito
-- offline-first del anteproyecto no se cumple.
--
-- Schema construido a partir del tipo `ItemCola` real en
-- src/sincronizacion/types.ts y de la interface `ColaSincronizacion`
-- en src/sincronizacion/cola-repository.ts.
--
-- Decisiones:
--  - PK: TEXT porque `ItemCola.id` es UUID generado por `crypto.randomUUID()`
--    (ver `cola.ts`). NO es autoincremental — el id viaja con el item.
--  - payload: TEXT con JSON serializado. El campo es `unknown` en TS;
--    JSON.stringify/parse en el adapter preserva la opacidad.
--  - depende_de: TEXT con JSON array (o NULL si no hay dependencias). Se
--    aplana porque SQLite no soporta arrays nativos.
--  - hash_local NOT NULL, hash_server nullable (solo se llena en CONFLICTO).
--  - estado: CHECK con los 6 estados de `EstadoItem`.
--  - tipo: CHECK con los 5 valores de `TipoItem`.
--  - intentos >= 0 via CHECK.
--  - ultimo_error TEXT nullable.
--  - ultimo_intento_en TEXT (ISO 8601) nullable; creado_en TEXT NOT NULL.
--  - forzar_sobrescribir INTEGER 0/1 nullable (boolean opcional).
--  - Indices: estado (listarPendientes), creado_en (orden FIFO eventual).
--
-- Semantica de upsert: la operacion `guardar(item)` del puerto se comporta
-- como upsert (el test in-memory verifica que guardar dos veces el mismo
-- id NO crea duplicado, sobrescribe). El adapter SQLite usa
-- `INSERT ... ON CONFLICT(id) DO UPDATE` para mantener esa semantica.

CREATE TABLE cola_sincronizacion (
  id                   TEXT PRIMARY KEY,
  tipo                 TEXT    NOT NULL CHECK (tipo IN ('LIQUIDACION','LECTURA','EVIDENCIA','EVENTO_AUDITORIA','FACTURA')),
  payload              TEXT    NOT NULL,
  hash_local           TEXT    NOT NULL,
  hash_server          TEXT,
  estado               TEXT    NOT NULL CHECK (estado IN ('PENDIENTE','ENVIANDO','EXITOSO','CONFLICTO','FALLIDO','DESCARTADO')),
  intentos             INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error         TEXT,
  ultimo_intento_en    TEXT,
  creado_en            TEXT    NOT NULL,
  depende_de           TEXT,
  forzar_sobrescribir  INTEGER
);

-- listarPendientes (filtro frecuente desde el procesador).
CREATE INDEX idx_cola_estado ON cola_sincronizacion (estado);

-- Orden FIFO al recorrer pendientes por tipo.
CREATE INDEX idx_cola_creado_en ON cola_sincronizacion (creado_en);
