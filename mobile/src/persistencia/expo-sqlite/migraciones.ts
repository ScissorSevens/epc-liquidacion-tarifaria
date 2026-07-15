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

// Espejo verbatim de src/persistencia/sqlite/migrations/004_suscriptor.sql
const MIGRACION_004_SUSCRIPTOR = `
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
`;

// Espejo verbatim de src/persistencia/sqlite/migrations/005_medidor.sql
// FK a suscriptor con ON DELETE RESTRICT. expo-sqlite respeta
// foreign_keys solo si esta habilitado por sesion; lo activamos en
// `aplicarMigracionesAsync` antes de aplicar migraciones.
const MIGRACION_005_MEDIDOR = `
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
`;

/**
 * Recrea `cola_sincronizacion` con el CHECK constraint correcto.
 *
 * El constraint original (v3) no incluía 'MEDIDOR' ni 'SUSCRIPTOR', lo que
 * impedía encolar entidades importadas desde CSV o agregadas manualmente.
 * SQLite no soporta ALTER TABLE para modificar CHECK constraints, así que
 * la única opción válida es recrear la tabla preservando los datos.
 */
const MIGRACION_006_COLA_SYNC_FIX_TIPO = `
ALTER TABLE cola_sincronizacion RENAME TO cola_sincronizacion_v3;
CREATE TABLE cola_sincronizacion (
  id                   TEXT    PRIMARY KEY NOT NULL,
  tipo                 TEXT    NOT NULL CHECK (tipo IN ('LIQUIDACION','LECTURA','EVIDENCIA','EVENTO_AUDITORIA','FACTURA','SUSCRIPTOR','MEDIDOR')),
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
INSERT INTO cola_sincronizacion SELECT * FROM cola_sincronizacion_v3;
DROP TABLE cola_sincronizacion_v3;
CREATE INDEX IF NOT EXISTS idx_cola_estado ON cola_sincronizacion (estado);
CREATE INDEX IF NOT EXISTS idx_cola_creado_en ON cola_sincronizacion (creado_en);
`;

const MIGRACION_007_SUSCRIPTOR_SUBSIDIO = `
ALTER TABLE suscriptor ADD COLUMN aplica_subsidio INTEGER NOT NULL DEFAULT 1;
`;

const MIGRACION_008_SUSCRIPTOR_CAMPOS_UBICACION = `
ALTER TABLE suscriptor ADD COLUMN cedula TEXT NOT NULL DEFAULT '';
ALTER TABLE suscriptor ADD COLUMN municipio TEXT NOT NULL DEFAULT '';
ALTER TABLE suscriptor ADD COLUMN sector TEXT;
ALTER TABLE suscriptor ADD COLUMN calle TEXT;
`;

// Migrations 009-014 del change motor-tarifario-cra-825-2017-multitenant.
// Copiadas verbatim de mobile/dominio/persistencia/sqlite/migrations/*.sql.
// Si modificás las originales, hay que reflejar acá a mano.

const MIGRACION_009_PRESTADOR = `
CREATE TABLE prestador (
  id_prestador              INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo                    TEXT    NOT NULL UNIQUE,
  nombre                    TEXT    NOT NULL,
  nit                       TEXT    NOT NULL,
  municipio                 TEXT    NOT NULL,
  departamento                TEXT    NOT NULL,
  segmento                  INTEGER NOT NULL CHECK (segmento IN (1, 2)),
  num_suscriptores_urbanos  INTEGER NOT NULL DEFAULT 0 CHECK (num_suscriptores_urbanos >= 0),
  num_suscriptores_rurales  INTEGER NOT NULL DEFAULT 0 CHECK (num_suscriptores_rurales >= 0),
  contacto                  TEXT    NULL,
  estado                    TEXT    NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  created_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
  updated_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
);
CREATE INDEX idx_prestador_municipio ON prestador (municipio);
CREATE INDEX idx_prestador_estado ON prestador (estado);
INSERT INTO prestador (
  id_prestador, codigo, nombre, nit, municipio, departamento, segmento,
  num_suscriptores_urbanos, num_suscriptores_rurales, contacto, estado,
  created_at, updated_at
) VALUES (
  0, 'EPC-LEGACY', 'EPC Legacy (prestador por defecto)',
  '000000000-0', 'No asignado', 'No asignado', 2,
  0, 0, NULL, 'activo',
  strftime('%Y-%m-%dT%H:%M:%S', 'now'), strftime('%Y-%m-%dT%H:%M:%S', 'now')
);
`;

const MIGRACION_010_ACUERDO_MUNICIPAL = `
CREATE TABLE acuerdo_municipal (
  id_acuerdo                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador                  INTEGER NOT NULL REFERENCES prestador(id_prestador),
  factor_subsidio_e1            REAL    NOT NULL,
  factor_subsidio_e2            REAL    NOT NULL,
  factor_subsidio_e3            REAL    NOT NULL,
  factor_contribucion_e5        REAL    NOT NULL,
  factor_contribucion_e6        REAL    NOT NULL,
  factor_contribucion_comercial REAL    NOT NULL DEFAULT 0.50 CHECK (factor_contribucion_comercial >= 0),
  factor_contribucion_industrial REAL    NOT NULL DEFAULT 0.30 CHECK (factor_contribucion_industrial >= 0),
  fecha_vigencia_desde          TEXT    NOT NULL,
  fecha_vigencia_hasta          TEXT    NOT NULL,
  acto_administrativo_url       TEXT    NULL,
  observaciones                 TEXT    NULL,
  created_at                    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
);
CREATE INDEX idx_acuerdo_prestador_vigencia
  ON acuerdo_municipal (id_prestador, fecha_vigencia_desde, fecha_vigencia_hasta);
`;

const MIGRACION_011_PARAMETROS_TARIFA = `
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
`;

const MIGRACION_012_SUSCRIPTOR_ADD_ID_PRESTADOR = `
ALTER TABLE suscriptor ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0 REFERENCES prestador(id_prestador);
ALTER TABLE suscriptor ADD COLUMN categoria_uso TEXT NOT NULL DEFAULT 'residencial'
  CHECK (categoria_uso IN ('residencial', 'comercial', 'industrial', 'oficial', 'especial'));
CREATE INDEX idx_suscriptor_prestador ON suscriptor (id_prestador);
CREATE INDEX idx_suscriptor_categoria_uso ON suscriptor (categoria_uso);
`;

const MIGRACION_013_LECTURA_ADD_ID_PRESTADOR = `
ALTER TABLE lectura ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_lectura_prestador ON lectura (id_prestador);
`;

const MIGRACION_014_FACTURA_ADD_ID_PRESTADOR = `
ALTER TABLE factura ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_factura_prestador ON factura (id_prestador);
`;

// Espejo verbatim de mobile/dominio/persistencia/sqlite/migrations/015_operario.sql.
// Crea la tabla operarios (deuda técnica "Iter 7"). Migration 016 le agrega
// id_prestador y reemplaza el UNIQUE por uno compuesto.
const MIGRACION_015_OPERARIO = `
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
CREATE UNIQUE INDEX idx_operario_dispositivo_unique
  ON operarios(dispositivo_id)
  WHERE dispositivo_id IS NOT NULL;
`;

// Espejo verbatim de mobile/dominio/persistencia/sqlite/migrations/016_setup_inicial_multi_tenant.sql.
// Agrega representante_legal al prestador + id_prestador FK a operarios +
// reemplaza UNIQUE de operarios por uno compuesto (dispositivo_id, id_prestador).
const MIGRACION_016_SETUP_INICIAL_MULTI_TENANT = `
ALTER TABLE prestador ADD COLUMN representante_legal TEXT NOT NULL DEFAULT '';
ALTER TABLE prestador ADD COLUMN representante_legal_cedula TEXT NOT NULL DEFAULT '';

ALTER TABLE operarios ADD COLUMN id_prestador INTEGER NOT NULL DEFAULT 0
  REFERENCES prestador(id_prestador) ON DELETE RESTRICT;

DROP INDEX IF EXISTS idx_operario_dispositivo_unique;
CREATE UNIQUE INDEX idx_operario_dispositivo_prestador_unique
  ON operarios(dispositivo_id, id_prestador)
  WHERE dispositivo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operario_id_prestador
  ON operarios(id_prestador);
`;

/**
 * TICKET-EPIC-LOGIN-001 — PUNTO A: Login real local contra SQLite.
 *
 * El repo de operarios (`operario-repository-expo-sqlite.ts`) y las
 * migrations 015+016 de este espejo usan AMBOS la tabla `operarios`
 * (plural). Coherencia asegurada: el bug original donde el repo usaba
 * `operarios` y las migrations creaban `operario` (singular) está
 * saldado — un cold-install crea la tabla con el nombre correcto y
 * todos los queries del repo matchean sin "no such table".
 *
 * Algunas DBs existentes en devices de dev (pre-unificación) tienen la
 * tabla `operarios` SIN la columna `password_hash`, lo que impide el
 * login offline del PUNTO A.
 *
 * Esta migration agrega `password_hash` a `operarios` para DBs pre-PUNTO-A.
 *
 * Para DBs nuevas (cold install en devices nuevos): el repo
 * `crearOperarioRepositoryExpoSqlite` ya crea `operarios` CON la columna
 * en su `SQL_CREATE_TABLE` (PUNTO A commit). Esta migration es no-op
 * para esas DBs porque la columna ya existe (migrations controlan el
 * version con `__migraciones_aplicadas` — se aplica 1 vez por device).
 *
 * DEFAULT '': las filas pre-existentes quedan con hash vacío; un operario
 * legacy sin hash válido NO puede hacer login (PASSWORD_INCORRECTA). Esto
 * es aceptable porque el setup inicial (Fase 5.1) siempre crea el primer
 * operario con password_hash real via bootstrapCompleto → operarioRepo.guardar.
 */
const MIGRACION_017_OPERARIO_PASSWORD_HASH = `
ALTER TABLE operarios ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
`;

const MIGRACIONES: readonly Migracion[] = [
  { version: 1, nombre: '001_factura', sql: MIGRACION_001_FACTURA },
  { version: 2, nombre: '002_lectura', sql: MIGRACION_002_LECTURA },
  { version: 3, nombre: '003_cola_sync', sql: MIGRACION_003_COLA_SYNC },
  { version: 4, nombre: '004_suscriptor', sql: MIGRACION_004_SUSCRIPTOR },
  { version: 5, nombre: '005_medidor', sql: MIGRACION_005_MEDIDOR },
  { version: 6, nombre: '006_cola_sync_fix_tipo', sql: MIGRACION_006_COLA_SYNC_FIX_TIPO },
  { version: 7, nombre: '007_suscriptor_add_aplica_subsidio', sql: MIGRACION_007_SUSCRIPTOR_SUBSIDIO },
  { version: 8, nombre: '008_suscriptor_campos_ubicacion', sql: MIGRACION_008_SUSCRIPTOR_CAMPOS_UBICACION },
  { version: 9, nombre: '009_prestador', sql: MIGRACION_009_PRESTADOR },
  { version: 10, nombre: '010_acuerdo_municipal', sql: MIGRACION_010_ACUERDO_MUNICIPAL },
  { version: 11, nombre: '011_parametros_tarifa', sql: MIGRACION_011_PARAMETROS_TARIFA },
  { version: 12, nombre: '012_suscriptor_add_id_prestador', sql: MIGRACION_012_SUSCRIPTOR_ADD_ID_PRESTADOR },
  { version: 13, nombre: '013_lectura_add_id_prestador', sql: MIGRACION_013_LECTURA_ADD_ID_PRESTADOR },
  { version: 14, nombre: '014_factura_add_id_prestador', sql: MIGRACION_014_FACTURA_ADD_ID_PRESTADOR },
  { version: 15, nombre: '015_operario', sql: MIGRACION_015_OPERARIO },
  { version: 16, nombre: '016_setup_inicial_multi_tenant', sql: MIGRACION_016_SETUP_INICIAL_MULTI_TENANT },
  { version: 17, nombre: '017_operario_password_hash', sql: MIGRACION_017_OPERARIO_PASSWORD_HASH },
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
  // CRITICO: expo-sqlite (igual que SQLite estandar) no respeta las
  // FOREIGN KEY si no se habilita por sesion. Sin este PRAGMA, la FK
  // `medidor.id_suscriptor -> suscriptor.id_suscriptor` se ignora y
  // se podrian insertar medidores apuntando a suscriptores inexistentes.
  // Hay que correrlo ANTES de aplicar migraciones por si alguna depende
  // del check de FK durante el CREATE.
  await db.execAsync('PRAGMA foreign_keys = ON;');

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
