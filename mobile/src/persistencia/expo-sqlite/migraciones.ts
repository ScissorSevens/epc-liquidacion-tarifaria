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
import {
  aplicarMigration020IdempotenteExpo,
  aplicarMigrationAditivaIdempotenteExpo,
} from '../../../dominio/persistencia/sqlite/migraciones-idempotente';

interface Migracion {
  readonly version: number;
  readonly nombre: string;
  readonly sql: string;
  /**
   * Modo de ejecucion que determina como `aplicarMigracionesAsync` la
   * procesa. Cleanup A-1 (verify-report `param-tarifa-residuales-cra-825`):
   * evita la lista hardcoded de versiones (que crecia con cada migration
   * aditiva nueva) y centraliza el dispatch por tipo.
   *
   *   - `'normal'` (default): se ejecuta `db.execAsync(sql)` directo.
   *     Cubre CREATE TABLE / CREATE INDEX / ALTER no-aditivo.
   *   - `'aditiva'`: PRAGMA table_info + ALTER por columna (helper
   *     `aplicarMigrationAditivaIdempotenteExpo`). Necesario porque
   *     expo-sqlite < 3.35 no soporta `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
   *   - `'compliance-1038'`: migration 020 con patron especifico
   *     (CREATE INDEX despues de ALTER, envoltura `IF NOT EXISTS`).
   */
  readonly kind?: 'normal' | 'aditiva' | 'compliance-1038';
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
    created_at             TEXT      DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')) NOT NULL,
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
    created_at        TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now')) NOT NULL,
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
  created_at                TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL,
  updated_at                TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL
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
  created_at                    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL
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
  created_at                 TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL,
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
  created_at     TEXT    DEFAULT CURRENT_TIMESTAMP NOT NULL
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
 * Migration 020: Res CRA 1038/2026 compliance — agrega columnas para
 * busqueda operativa de codigo de verificacion, referencia de pago, QR
 * y version de tarifa aplicada. Espejo verbatim de
 * mobile/dominio/persistencia/sqlite/migrations/020_factura_compliance_1038.sql.
 *
 * Idempotencia: la migration 020 NO es idempotente en SQLite 3.35
 * (no soporta 'ADD COLUMN IF NOT EXISTS'). El helper
 * `aplicarMigration020IdempotenteExpo` (en `dominio/persistencia/sqlite/`)
 * consulta PRAGMA table_info y filtra columnas ya existentes antes de
 * cada ALTER.
 */
const MIGRACION_020_FACTURA_COMPLIANCE_1038 = `
ALTER TABLE factura ADD COLUMN codigo_verificacion TEXT;
ALTER TABLE factura ADD COLUMN referencia_pago TEXT;
ALTER TABLE factura ADD COLUMN qr_pago TEXT;
ALTER TABLE factura ADD COLUMN version_tarifa_aplicada TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_referencia_pago_unique
  ON factura (referencia_pago)
  WHERE referencia_pago IS NOT NULL;
`;

/**
 * Migration 021: catálogo regulatorio `concepto_otro_valor` (Res CRA
 * 1038/2026 §4 §10). Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/021_concepto_otro_valor.sql`.
 *
 * Idempotente via `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`,
 * asi que la corren tal cual via `db.execAsync` es seguro.
 */
const MIGRACION_021_CONCEPTO_OTRO_VALOR = `
CREATE TABLE IF NOT EXISTS concepto_otro_valor (
  id_concepto    INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT    NOT NULL UNIQUE,
  descripcion    TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  requiere_glosa INTEGER NOT NULL DEFAULT 0 CHECK (requiere_glosa IN (0, 1)),
  created_at     TEXT    DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_concepto_otro_valor_activo
  ON concepto_otro_valor (activo);
CREATE INDEX IF NOT EXISTS idx_concepto_otro_valor_version
  ON concepto_otro_valor (version);

INSERT OR IGNORE INTO concepto_otro_valor
  (codigo, descripcion, version, activo, requiere_glosa)
VALUES
  ('SALDO_ANTERIOR',
   'Saldo pendiente de periodos anteriores',
   '1038-2026-v1', 1, 0),
  ('INTERESES_AUTORIZADOS',
   'Intereses de mora autorizados por la regulación',
   '1038-2026-v1', 1, 1),
  ('RECONEXION',
   'Cargo por reconexión del servicio',
   '1038-2026-v1', 1, 0),
  ('FINANCIACION',
   'Cuota de financiación de deuda previa',
   '1038-2026-v1', 1, 1),
  ('MATERIALES_ACOMETIDA',
   'Materiales de acometida',
   '1038-2026-v1', 1, 0),
  ('AJUSTES_DEVOLUCIONES',
   'Ajustes o devoluciones de periodos anteriores',
   '1038-2026-v1', 1, 1),
  ('OTROS_AUTORIZADOS',
   'Otros conceptos autorizados por la regulación',
   '1038-2026-v1', 1, 1);
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
 * operario con password_hash real via bootstrapCompleto → operarioRepo.crear.
 */
const MIGRACION_017_OPERARIO_PASSWORD_HASH = `
-- Agrega password_hash a operario para DBs pre-PUNTO-A del SDD
-- setup-inicial-multi-tenant-auth. La columna YA EXISTE en CREATE TABLE
-- de la migration 015 (operarios fue retrofiteado para incluirla), pero
-- esta migration queda como safety net para DBs muy viejas (pre-2026-07).
-- La idempotencia se garantiza desde TypeScript via PRAGMA table_info
-- (la version vieja de SQLite que trae expo-sqlite SDK 54 NO soporta
-- 'ADD COLUMN IF NOT EXISTS' — tira 'near EXISTS: syntax error').
ALTER TABLE operarios ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
`;

const MIGRACION_018_SUSCRIPTOR_EMAIL_TELEFONO = `
ALTER TABLE suscriptor ADD COLUMN email TEXT;
ALTER TABLE suscriptor ADD COLUMN telefono TEXT;
CREATE INDEX idx_suscriptor_email ON suscriptor (email);
CREATE INDEX idx_suscriptor_telefono ON suscriptor (telefono);
`;

// Migration 019: ParametrosTarifa completo (Res CRA 825/2017).
//
// Extendiende en 4 dimensiones:
//   1. ipuf_indice: Índice de Precios al Usuario Final (decimal).
//   2. cargo_fijo_resultante + cargo_consumo_resultante: pre-calculados
//      al guardar y PERSISTIDOS. NO se recalculan en cada factura.
//   3. componentes_aplicables: JSON array de IDs de componentes activos.
//   4. minimo_vital: tabla RELACIONADA 1:1 con prestador, con su PROPIA
//      vigencia. Decoupling clave: el minimo vital puede cambiar dentro
//      de un periodo tarifario.
const MIGRACION_019_PARAMETROS_TARIFA_COMPLETO = `
ALTER TABLE parametros_tarifa ADD COLUMN ipuf_indice REAL NOT NULL DEFAULT 1.0
  CHECK (ipuf_indice >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN cargo_fijo_resultante REAL NOT NULL DEFAULT 0
  CHECK (cargo_fijo_resultante >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN cargo_consumo_resultante REAL NOT NULL DEFAULT 0
  CHECK (cargo_consumo_resultante >= 0);
ALTER TABLE parametros_tarifa ADD COLUMN componentes_aplicables TEXT NOT NULL DEFAULT '[]';

CREATE TABLE minimo_vital (
  id_minimo_vital INTEGER PRIMARY KEY AUTOINCREMENT,
  id_prestador    INTEGER NOT NULL REFERENCES prestador(id_prestador) ON DELETE CASCADE,
  metros_cubicos  INTEGER NULL CHECK (metros_cubicos IS NULL OR metros_cubicos >= 0),
  estratos_aplica TEXT    NOT NULL DEFAULT '[]',
  vigente_desde   TEXT    NOT NULL,
  vigente_hasta   TEXT    NOT NULL,
  created_at      TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')) NOT NULL,
  UNIQUE (id_prestador, vigente_desde)
);

CREATE INDEX idx_minimo_vital_prestador_vigencia
  ON minimo_vital (id_prestador, vigente_desde, vigente_hasta);
`;

/**
 * Migration 023_parametros_tarifa_anio_base. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/023_parametros_tarifa_anio_base.sql`.
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Res CRA
 * 825/2017 Art. 7 (año base) + Art. 11 (factor IPC persistido).
 *
 * Idempotente: simples ALTER ADD COLUMN. El runner controla via
 * `__migraciones_aplicadas` (no se re-ejecuta si la version coincide).
 */
const MIGRACION_023_PARAMETROS_TARIFA_ANIO_BASE = `
ALTER TABLE parametros_tarifa ADD COLUMN anio_base INTEGER NOT NULL DEFAULT 2016
  CHECK (anio_base >= 1900);

ALTER TABLE parametros_tarifa ADD COLUMN factor_indexacion_ipc REAL NOT NULL DEFAULT 1.0
  CHECK (factor_indexacion_ipc >= 0);
`;

/**
 * Migration 022_prestador_aps. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/022_prestador_aps.sql`.
 *
 * Cambia `param-tarifa-res-825-compliance-phase1` (fase 1). Res CRA
 * 825/2017 Art. 5: el prestador debe declarar el Área de Prestación
 * del Servicio (APS).
 *
 * Idempotente: simple ALTER ADD COLUMN. El runner controla via
 * `__migraciones_aplicadas` (no se re-ejecuta si la version coincide).
 */
const MIGRACION_022_PRESTADOR_APS = `
  ALTER TABLE prestador ADD COLUMN aps TEXT NULL DEFAULT NULL;
`;

/**
 * Migration 024_no_op_calle_drop. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/024_no_op_calle_drop.sql`.
 *
 * Cambia `refactor-suscriptor-eliminar-calle` (commit 1/3). El campo
 * `calle` se quitó del modelo `Suscriptor` por redundancia con
 * `direccion`.
 *
 * NO-OP intencional: la columna `calle` PERMANECE en la DB para
 * preservar datos históricos y compatibilidad con devices ya
 * desplegados. El adapter SQLite deja de leerla/escribirla en code-level.
 * No es necesario DROP COLUMN: ver SQL original para la justificacion
 * completa (expo-sqlite SDK 54 trae SQLite < 3.35 sin soporte DROP COLUMN).
 */
const MIGRACION_024_NO_OP_CALLE_DROP = `
-- Migration 024: campo calle eliminado del modelo.
-- Cambio logico al modelo de Suscriptor (sin alterar schema SQLite).
-- La columna \`calle\` ya existe en la tabla \`suscriptor\` desde la
-- migration 008; queda como evidencia historica para auditoria.
-- El adapter expo-sqlite correspondiente dejara de mapearla.
`;

/**
 * Migration 025_parametros_tarifa_cmaa_docs. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/025_parametros_tarifa_cmaa_docs.sql`.
 *
 * Cambia `param-tarifa-res-825-compliance-phase2`. Res CRA 825/2017
 * + Res CRA 907/2019 art. 31.B (CMAA): agrega 4 columnas aditivas
 * a `parametros_tarifa` para soportar el CMAA y la trazabilidad
 * documental del estudio de costos y el acto administrativo.
 *
 *   - cmaa: CMAA — Costo Medio de Administración por Inversiones
 *           Ambientales Adicionales (Res CRA 907/2019 art. 31.B).
 *           REAL NULL — Default 0 si el prestador no opta por
 *           inversiones ambientales.
 *   - acto_adopcion: URL o referencia del acto administrativo que
 *           adoptó la metodología tarifaria. TEXT NULL — Requerido
 *           para que `AcuerdoMunicipal.estado` pase a 'ACTIVO'.
 *           Default NULL para legacy (se asume acto previo cargado).
 *   - estudio_costos_id: ID del estudio de costos del prestador
 *           (referencia externa, ej: SUI). TEXT NULL — Default NULL.
 *   - documento_soporte_url: URL del documento soporte del estudio
 *           de costos (PDF, etc.). TEXT NULL — Default NULL.
 *
 * Idempotente: SQLite < 3.35 NO soporta `ALTER TABLE ... ADD COLUMN
 * IF NOT EXISTS`. Usamos el patron de `aplicarMigracionesAsync`
 * (PRAGMA table_info + ALTER manual) para mantener paridad con las
 * migrations 017 (operarios.password_hash) y 020 (factura compliance).
 * La aplicacion corre el ALTER solo si la columna NO existe.
 *
 * Backward-compat: todas las 4 columnas son NULLables, asi que data
 * legacy queda con NULL por default. No hay riesgo de violar
 * constraints NOT NULL.
 */
const MIGRACION_025_PARAMETROS_TARIFA_CMAA_DOCS = `
-- Migration 025: ParametrosTarifa compliance fase 2 (cmaa + docs).
-- Res CRA 907/2019 art. 31.B (CMAA) + trazabilidad documental.
ALTER TABLE parametros_tarifa ADD COLUMN cmaa REAL NULL;
ALTER TABLE parametros_tarifa ADD COLUMN acto_adopcion TEXT NULL;
ALTER TABLE parametros_tarifa ADD COLUMN estudio_costos_id TEXT NULL;
ALTER TABLE parametros_tarifa ADD COLUMN documento_soporte_url TEXT NULL;
`;

/**
 * Migration 026_suscriptor_verificacion. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/026_suscriptor_verificacion.sql`.
 *
 * Cambia `param-tarifa-res-825-compliance-phase2`. Res CRA 825/2017
 * + L142/1994: agrega 4 columnas aditivas a `suscriptor` para
 * registrar la verificación oficial del estrato (precondición de
 * subsidios residenciales E1-E3).
 *
 *   - estado_verificacion: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO'.
 *           TEXT NOT NULL DEFAULT 'PENDIENTE' — Default conservador
 *           para legacy data: NO subsidia hasta que el admin cargue
 *           fuente + soporte. Crítico para la regulatory gate del
 *           motor tarifario (Phase 2.11-2.14).
 *   - fuente_estrato: TEXT NULL — Fuente del estrato (DANE, acto
 *           administrativo, etc.). Requerido para VERIFICADO.
 *   - fecha_verificacion_estrato: TEXT NULL — ISO 8601 fecha de
 *           verificación. NULL hasta que se verifique.
 *   - soporte_estrato_url: TEXT NULL — URL del documento soporte
 *           (PDF del acto, screenshot DANE, etc.).
 *
 * Idempotente: idem migration 025 (PRAGMA table_info + ALTER manual).
 *   - estado_verificacion: ALTER conditional; si la columna ya
 *     existe, no ejecuta (la fila legacy ya tiene 'PENDIENTE' via
 *     default).
 *   - Los otros 3 son NULLables — no hay riesgo de constraint.
 *
 * Backward-compat: data legacy queda con `estado_verificacion =
 * 'PENDIENTE'` (NOT NULL con default). Filas nuevas deben especificar
 * el estado explícitamente o aceptar el default.
 */
const MIGRACION_026_SUSCRIPTOR_VERIFICACION = `
-- Migration 026: Suscriptor verification oficial del estrato.
-- Res CRA 825/2017 + L142/1994 — regulatory gate subsidios E1-E3.
ALTER TABLE suscriptor ADD COLUMN estado_verificacion TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE suscriptor ADD COLUMN fuente_estrato TEXT NULL;
ALTER TABLE suscriptor ADD COLUMN fecha_verificacion_estrato TEXT NULL;
ALTER TABLE suscriptor ADD COLUMN soporte_estrato_url TEXT NULL;
`;

/**
 * Migration 027_acuerdo_municipal_estado. Espejo verbatim de
 * `mobile/dominio/persistencia/sqlite/migrations/027_acuerdo_municipal_estado.sql`.
 *
 * Cambia `param-tarifa-res-825-compliance-phase2`. Res CRA 825/2017:
 * agrega 1 columna aditiva a `acuerdo_municipal` para registrar el
 * estado del ciclo de vida del Acuerdo (BORRADOR | ACTIVO | VENCIDO
 * | DEROGADO).
 *
 *   - estado: TEXT NOT NULL DEFAULT 'ACTIVO' — Default conservador
 *           para legacy data: asume acto previo cargado. Cambiar a
 *           'BORRADOR' requiere acción admin explícita.
 *
 * 9na columna del change (vs 8 planificadas en el design). Inclusion
 * necesaria: la design document decia "se hace en código", pero el
 * adapter repo hace INSERT de la columna, lo que rompe bootstrap
 * (crear Acuerdo) si la columna no existe en la DB. Default
 * 'ACTIVO' cumple el racional conservador: acuerdos legacy asumen
 * acto previo cargado y siguen siendo válidos.
 *
 * Idempotente: idem migration 025 (PRAGMA table_info + ALTER manual).
 * Backward-compat: data legacy queda con `estado = 'ACTIVO'`.
 */
const MIGRACION_027_ACUERDO_MUNICIPAL_ESTADO = `
-- Migration 027: Acuerdo municipal estado del ciclo de vida.
-- Res CRA 825/2017 — default 'ACTIVO' para legacy data.
ALTER TABLE acuerdo_municipal ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO';
`;

/**
 * Migration 028_parametros_tarifa_altitud. Espejo verbatim (en
 * construccion) de la migration aditiva planificada en
 * `param-tarifa-residuales-cra-825` Phase 1 task 1.4 (GREEN).
 *
 * Res CRA 750/2016 art. 3: la altitud del prestador (msnm)
 * determina el límite de consumo básico (11/13/16 m³/mes). El campo
 * `altitud_msnm` vive en el domain type desde
 * `compliance-cra-825-subsidios-bloques` pero NO se persistía en
 * SQLite (migration 025 no la incluye). Esta migration lo agrega.
 *
 *   - altitud_msnm: INTEGER NULL — Default NULL para legacy data
 *           (el motor usa el límite default de 16 m³/mes como
 *           fallback conservador cuando altitud es desconocida).
 *
 * Idempotente: idem migration 025 (PRAGMA table_info + ALTER manual
 * via helper `aplicarMigrationAditivaIdempotenteExpo`). Backward-
 * compat: data legacy queda con `altitud_msnm = NULL`.
 */
const MIGRACION_028_PARAMETROS_ALTITUD = `
-- Migration 028: ParametrosTarifa.altitud_msnm persiste (Res CRA 750/2016).
-- Cambio param-tarifa-residuales-cra-825 Phase 1 task 1.4 GREEN.
ALTER TABLE parametros_tarifa ADD COLUMN altitud_msnm INTEGER NULL;
`;

/**
 * Migration 028b_parametros_tarifa_anio_destino. Espejo de la
 * segunda migration aditiva del change `param-tarifa-residuales-cra-825`
 * Phase 1 task 1.6 (GREEN).
 *
 * Res CRA 825/2017 Art. 11: factor de indexacion IPC =
 *   factor = IPC[anio_destino_indexacion] / IPC[anio_base].
 *
 * El campo `anio_base` ya existe desde la migration 023. Faltaba el
 * `anio_destino_indexacion` (el año al que se quiere indexar la
 * metodologia). Sin este campo, el factor IPC no es calculable y el
 * admin no puede ajustar la indexacion.
 *
 *   - anio_destino_indexacion: INTEGER NULL — Default NULL para
 *           legacy data (el admin debe setearlo via pantalla).
 *
 * Idempotente: idem migration 028 (helper aditivo).
 * Backward-compat: data legacy queda con `anio_destino_indexacion = NULL`.
 */
const MIGRACION_028B_PARAMETROS_ANIO_DESTINO = `
-- Migration 028b: ParametrosTarifa.anio_destino_indexacion persiste
-- (Res CRA 825/2017 Art. 11, formula IPC[destino] / IPC[base]).
-- Cambio param-tarifa-residuales-cra-825 Phase 1 task 1.6 GREEN.
ALTER TABLE parametros_tarifa ADD COLUMN anio_destino_indexacion INTEGER NULL;
`;

/**
 * Migration 030_parametros_tarifa_aplica_cmaa. Espejo de la
 * migration aditiva del change `param-tarifa-residuales-cra-825`
 * Phase 2 task 2.2 (GREEN).
 *
 * Res CRA 907/2019 art. 13 (modifica Res CRA 825/2017 art. 9): el
 * CMAA (Costo Medio de Administración por Inversiones Ambientales
 * Adicionales) requiere un FLAG EXPLICITO que determine si el prestador
 * opta por estas inversiones. Antes de esta migration, el campo `cmaa`
 * se inferia de `cmaa > 0`, lo que permitia que un admin que setea
 * `cmaa = 0` por error apague el CMAA sin warning.
 *
 * Fix: columna SQL `aplica_cmaa` con flag binario explicito:
 *
 *   - aplica_cmaa: INTEGER NOT NULL DEFAULT 0 CHECK (aplica_cmaa IN (0, 1))
 *           — Default 0 (conservador): data legacy NO aplica CMAA hasta
 *           que el admin active el toggle explicitamente.
 *           El CHECK garantiza que solo se persistan 0 o 1, nunca otro
 *           valor.
 *
 * Decision B/B/B: el flag manda sobre el valor numerico. Si flag=false,
 * el buildBorradorLocal sobrescribe `cmaa` con 0. Si flag=true y
 * `cmaa=null` (legacy), se guarda OK (cmaa permanece null) y el admin
 * puede editar el valor en la pantalla.
 *
 * Idempotente: idem migration 028/028b (helper aditivo). El DEFAULT 0 +
 * NOT NULL cubren data legacy automaticamente.
 *
 * Backward-compat: data legacy queda con `aplica_cmaa = 0` y el CMAA
 * NO se computa (mismo comportamiento que antes — el flag explicito
 * solo agrega precision al opt-in).
 */
const MIGRACION_030_PARAMETROS_APLICA_CMAA = `
-- Migration 030: ParametrosTarifa.aplica_cmaa flag explicito (Res 907/2019 art. 13).
-- Cambio param-tarifa-residuales-cra-825 Phase 2 task 2.2 GREEN.
ALTER TABLE parametros_tarifa ADD COLUMN aplica_cmaa INTEGER NOT NULL DEFAULT 0
  CHECK (aplica_cmaa IN (0, 1));
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
  { version: 18, nombre: '018_suscriptor_email_telefono', sql: MIGRACION_018_SUSCRIPTOR_EMAIL_TELEFONO },
  { version: 19, nombre: '019_parametros_tarifa_completo', sql: MIGRACION_019_PARAMETROS_TARIFA_COMPLETO },
  { version: 20, nombre: '020_factura_compliance_1038', sql: MIGRACION_020_FACTURA_COMPLIANCE_1038, kind: 'compliance-1038' },
  { version: 21, nombre: '021_concepto_otro_valor', sql: MIGRACION_021_CONCEPTO_OTRO_VALOR },
  { version: 22, nombre: '022_prestador_aps', sql: MIGRACION_022_PRESTADOR_APS },
  { version: 23, nombre: '023_parametros_tarifa_anio_base', sql: MIGRACION_023_PARAMETROS_TARIFA_ANIO_BASE },
  { version: 24, nombre: '024_no_op_calle_drop', sql: MIGRACION_024_NO_OP_CALLE_DROP },
  { version: 25, nombre: '025_parametros_tarifa_cmaa_docs', sql: MIGRACION_025_PARAMETROS_TARIFA_CMAA_DOCS, kind: 'aditiva' },
  { version: 26, nombre: '026_suscriptor_verificacion', sql: MIGRACION_026_SUSCRIPTOR_VERIFICACION, kind: 'aditiva' },
  { version: 27, nombre: '027_acuerdo_municipal_estado', sql: MIGRACION_027_ACUERDO_MUNICIPAL_ESTADO, kind: 'aditiva' },
  { version: 28, nombre: '028_parametros_tarifa_altitud', sql: MIGRACION_028_PARAMETROS_ALTITUD, kind: 'aditiva' },
  { version: 29, nombre: '028b_parametros_tarifa_anio_destino', sql: MIGRACION_028B_PARAMETROS_ANIO_DESTINO, kind: 'aditiva' },
  { version: 30, nombre: '030_parametros_tarifa_aplica_cmaa', sql: MIGRACION_030_PARAMETROS_APLICA_CMAA, kind: 'aditiva' },
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
    // Idempotencia especial para migration 017: la columna password_hash
    // YA EXISTE dentro del CREATE TABLE de la 015 moderna. Como el SQLite
    // viejo (anterior a 3.35) NO soporta 'ADD COLUMN IF NOT EXISTS',
    // chequeamos via PRAGMA table_info antes de ejecutar la migration.
    if (migracion.version === 17) {
      const columnas = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(operarios)",
      );
      if (columnas.some((c) => c.name === 'password_hash')) {
        // La columna ya existe: solo registramos la migration como aplicada
        // y seguimos con la siguiente.
        await db.runAsync(
          'INSERT INTO __migraciones_aplicadas (version, nombre, aplicada_en) VALUES (?, ?, ?)',
          migracion.version,
          migracion.nombre,
          new Date().toISOString(),
        );
        continue;
      }
    }

    // Migration 020 (factura-compliance 1038): SQLite < 3.35 NO soporta
    // `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, por lo que si la DB fue
    // restaurada parcialmente (user_version atras del schema) el ALTER
    // tira "duplicate column". Usamos el helper idempotente basado en
    // PRAGMA table_info. Misma logica que el runner Node.
    //
    // Cleanup A-1 (verify-report `param-tarifa-residuales-cra-825`):
    // dispatch via `kind` field en lugar de version === 20 hardcoded.
    // Futuras migrations con `kind: 'compliance-1038'` caen aca sin
    // editar este if.
    if (migracion.kind === 'compliance-1038') {
      await aplicarMigration020IdempotenteExpo(db, migracion.sql);
      await db.runAsync(
        'INSERT INTO __migraciones_aplicadas (version, nombre, aplicada_en) VALUES (?, ?, ?)',
        migracion.version,
        migracion.nombre,
        new Date().toISOString(),
      );
      continue;
    }

    // Migration 025 + 026 + 027 (param-tarifa-res-825-compliance-phase2):
    // columnas aditivas puras (solo `ALTER TABLE ... ADD COLUMN ...`).
    // El helper `aplicarMigrationAditivaIdempotenteExpo` consulta
    // `PRAGMA table_info` por tabla y ejecuta solo los ALTERs cuya
    // columna NO exista, preservando tipo + DEFAULT del script original.
    // Las migrations 025/026/027 NO son destructivas (todas NULLables
    // excepto estado_verificacion/estado que tienen DEFAULT), asi que
    // data legacy queda naturalmente backward-compat.
    //
    // Migrations aditivas (025-030): columnas aditivas puras en
    // `parametros_tarifa`, `suscriptor`, `acuerdo_municipal`. El helper
    // `aplicarMigrationAditivaIdempotenteExpo` consulta PRAGMA
    // table_info y solo agrega las columnas ausentes (SQLite < 3.35 no
    // soporta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
    //
    // Cleanup A-1 (verify-report `param-tarifa-residuales-cra-825`):
    // dispatch via `kind` field en lugar de lista hardcoded de versiones.
    // Cualquier migration futura aditiva solo necesita `kind: 'aditiva'`
    // sin editar este if. La lista crece sin tocar el dispatch.
    if (migracion.kind === 'aditiva') {
      await aplicarMigrationAditivaIdempotenteExpo(db, migracion.sql);
      await db.runAsync(
        'INSERT INTO __migraciones_aplicadas (version, nombre, aplicada_en) VALUES (?, ?, ?)',
        migracion.version,
        migracion.nombre,
        new Date().toISOString(),
      );
      continue;
    }

    await db.execAsync(migracion.sql);
    await db.runAsync(
      'INSERT INTO __migraciones_aplicadas (version, nombre, aplicada_en) VALUES (?, ?, ?)',
      migracion.version,
      migracion.nombre,
      new Date().toISOString(),
    );
  }
}
