-- Migration 015: crea la tabla operarios (deuda técnica "Iter 7" saldada).
--
-- Tabla: operarios (plural — alineado con `operario-repository-expo-sqlite.ts`
-- y la migration 017 del espejo runtime, que referencian esta misma tabla en plural).
-- Columnas basadas en `dominio/operarios/types.ts` (interface Operario).
--
-- Decisiones:
--  - PK: INTEGER (id_operario) autoincremental.
--  - numero_cedula UNIQUE NOT NULL: la cédula identifica al operario globalmente.
--  - email / password_hash con DEFAULT '': las pantallas de setup escriben
--    después; la columna es NOT NULL pero tolera registros placeholder.
--  - rol con CHECK ('operario' | 'supervisor' | 'admin'): enum del dominio.
--  - estado con CHECK ('activo' | 'inactivo'): enum del dominio.
--  - dispositivo_id NULL: un operario puede existir sin dispositivo asignado
--    (caso típico: aún no hizo login desde la app).
--  - created_at ISO 8601 con milisegundos (%f) para desambiguar inserciones
--    muy cercanas (login + sync casi simultáneos).
--
-- UNIQUE sobre dispositivo_id:
--  - 015 la pone GLOBAL (un dispositivo = un operario, en TODO el sistema).
--  - 016 la reemplaza por COMPUESTA (dispositivo_id, id_prestador) cuando
--    cada prestador tenga su propio pool de dispositivos.
--  - WHERE dispositivo_id IS NOT NULL: dispositivos NULL no ocupan la
--    constraint (varios operarios sin dispositivo conviven).
--
-- Esta migration NO toca prestador ni operarios (no existe aún antes de 015);
-- es autocontenida.

CREATE TABLE operarios (
  id_operario    INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_cedula  TEXT    NOT NULL UNIQUE,
  nombre         TEXT    NOT NULL,
  email          TEXT    NOT NULL DEFAULT '',
  password_hash  TEXT    NOT NULL DEFAULT '',
  rol            TEXT    NOT NULL DEFAULT 'operario'
                          CHECK (rol IN ('operario', 'supervisor', 'admin')),
  estado         TEXT    NOT NULL DEFAULT 'activo'
                          CHECK (estado IN ('activo', 'inactivo')),
  dispositivo_id TEXT    NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- UNIQUE global temporal sobre dispositivo_id (migration 016 la cambia
-- a compuesta (dispositivo_id, id_prestador)). Filtro NULL para que
-- múltiples operarios sin dispositivo coexistan.
CREATE UNIQUE INDEX idx_operario_dispositivo_unique
  ON operarios(dispositivo_id)
  WHERE dispositivo_id IS NOT NULL;