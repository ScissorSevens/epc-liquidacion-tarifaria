/**
 * Migraciones SQLite para la app movil (expo-sqlite).
 *
 * Espejo intencional de `src/persistencia/sqlite/migrations/*.sql` del
 * dominio Node. NO podemos importar los `.sql` desde RN (no hay `fs`),
 * asi que el SQL vive hardcodeado aca. Si las migraciones del root
 * cambian, hay que reflejar el cambio aca a mano.
 *
 * Idempotencia: llevamos una tabla `__migraciones_aplicadas` con la
 * version. `aplicarMigracionesAsync` solo corre las que faltan, asi que
 * llamarla en cada arranque de la app es seguro.
 *
 * Las queries de cada migracion van en una `execAsync` por bloque, en
 * orden ascendente por `version`. Los bloques son los mismos archivos
 * que el adapter Node, copiados verbatim.
 */

import type * as SQLite from 'expo-sqlite';

interface Migracion {
  readonly version: number;
  readonly nombre: string;
  readonly sql: string;
}

const MIGRACION_001_FACTURA = `
CREATE TABLE IF NOT EXISTS factura (
  id               TEXT    PRIMARY KEY,
  numero_factura   TEXT    NOT NULL,
  estado           TEXT    NOT NULL CHECK (estado IN ('BORRADOR','EMITIDA','PAGADA','ANULADA')),
  fecha_emision    TEXT    NOT NULL,
  snapshot         TEXT    NOT NULL,
  hash             TEXT    NOT NULL,
  liquidacion_id   TEXT    NOT NULL,
  id_periodo       TEXT    NOT NULL,
  id_suscriptor    INTEGER NOT NULL,
  created_at       TEXT    NOT NULL,
  motivo_anulacion TEXT,
  fecha_anulacion  TEXT,
  reemplaza_a      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_liquidacion_no_anulada
  ON factura (liquidacion_id)
  WHERE estado != 'ANULADA';
`;

const MIGRACION_002_LECTURA = `
CREATE TABLE IF NOT EXISTS lectura (
  id_lectura          INTEGER PRIMARY KEY AUTOINCREMENT,
  id_medidor          INTEGER NOT NULL,
  id_periodo          TEXT    NOT NULL,
  id_operario         INTEGER NOT NULL,
  lectura_actual      REAL    NOT NULL,
  lectura_anterior    REAL    NOT NULL,
  evidencia_foto_path TEXT,
  evidencia_foto_hash TEXT,
  estado_validacion   TEXT    NOT NULL CHECK (estado_validacion IN ('pendiente','validado','error')),
  observaciones       TEXT,
  timestamp_captura   TEXT    NOT NULL,
  timestamp_sync      TEXT,
  estado_sync         TEXT    NOT NULL CHECK (estado_sync IN ('pendiente','sincronizado','error'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lectura_medidor_periodo
  ON lectura (id_medidor, id_periodo);
CREATE INDEX IF NOT EXISTS idx_lectura_periodo
  ON lectura (id_periodo);
CREATE INDEX IF NOT EXISTS idx_lectura_medidor
  ON lectura (id_medidor);
CREATE INDEX IF NOT EXISTS idx_lectura_estado_sync
  ON lectura (estado_sync);
`;

const MIGRACION_003_COLA_SYNC = `
CREATE TABLE IF NOT EXISTS cola_sincronizacion (
  id                   TEXT    PRIMARY KEY NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_sincronizacion (estado);
CREATE INDEX IF NOT EXISTS idx_cola_creado_en ON cola_sincronizacion (creado_en);
`;

const MIGRACIONES: readonly Migracion[] = [
  { version: 1, nombre: '001_factura', sql: MIGRACION_001_FACTURA },
  { version: 2, nombre: '002_lectura', sql: MIGRACION_002_LECTURA },
  { version: 3, nombre: '003_cola_sync', sql: MIGRACION_003_COLA_SYNC },
];

const SQL_TABLA_CONTROL = `
CREATE TABLE IF NOT EXISTS __migraciones_aplicadas (
  version    INTEGER PRIMARY KEY,
  nombre     TEXT    NOT NULL,
  aplicada_en TEXT   NOT NULL
);
`;

/**
 * Aplica las migraciones pendientes a la base de datos.
 *
 * Idempotente: registra cada version en `__migraciones_aplicadas`. Si una
 * version ya esta registrada, se saltea. Las migraciones se corren en
 * orden ascendente por `version` para mantener el orden historico.
 */
export async function aplicarMigracionesAsync(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  await db.execAsync(SQL_TABLA_CONTROL);

  const aplicadas = (await db.getAllAsync<{ version: number }>(
    'SELECT version FROM __migraciones_aplicadas',
  )).map((r) => r.version);
  const aplicadasSet = new Set(aplicadas);

  const pendientes = MIGRACIONES.filter((m) => !aplicadasSet.has(m.version));
  if (pendientes.length === 0) return;

  for (const migracion of pendientes) {
    await db.execAsync(migracion.sql);
    await db.runAsync(
      'INSERT INTO __migraciones_aplicadas (version, nombre, aplicada_en) VALUES (?, ?, ?)',
      migracion.version,
      migracion.nombre,
      new Date().toISOString(),
    );
  }
}
