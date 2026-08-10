/**
 * Helpers idempotentes para migrations SQLite de la app.
 *
 * Justificacion: SQLite < 3.35 NO soporta `ALTER TABLE ... ADD COLUMN IF NOT
 * EXISTS`. Esto rompia re-ejecuciones de las migrations del change
 * `factura-compliance-fase1` cuando un device se restauraba de backup o se
 * re-aplicaban migrations sin un `__migraciones_aplicadas` consistente.
 *
 * Estrategia: el runner consulta `PRAGMA table_info(tabla)` ANTES de cada
 * `ALTER TABLE ... ADD COLUMN` y filtra solo las columnas ausentes. Esto es
 * explicito (no depende de strings de error), testeable (PRAGMA es publico)
 * y deterministico (mismo schema antes y despues de N ejecuciones).
 *
 * Patron ya usado por el runner expo-sqlite para migration 017
 * (`password_hash`): ver `aplicarMigracionesAsync` en
 * `mobile/src/persistencia/expo-sqlite/migraciones.ts:474-503`. Este modulo
 * generaliza ese mismo patron como export reutilizable y testeable de forma
 * aislada.
 *
 * TDD: este archivo implementa los tests en
 * `mobile/__tests__/persistencia/migration-020-factura-compliance.test.ts`.
 * Si cambias el comportamiento, actualiza los tests primero.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type * as SQLite from 'expo-sqlite';

type ColumnaInfo = { readonly name: string };

/**
 * Parsea un script SQL de migration 020 y devuelve las columnas `ALTER TABLE
 * factura ADD COLUMN X [TYPE]` listadas, en orden. Solo nos importan las
 * columnas a agregar; los `CREATE INDEX` se manejan aparte.
 */
function extraerAlterColumnasFactura(sql: string): readonly string[] {
  const columnas: string[] = [];
  // Capturamos cada `ALTER TABLE factura ADD COLUMN <nombre>` (case-insensitive)
  // tolerando espacios arbitrarios alrededor del nombre del tipo.
  const re = /ALTER\s+TABLE\s+factura\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    columnas.push(m[1]);
  }
  return columnas;
}

/**
 * Lee el conjunto de columnas actuales de la tabla `factura`.
 *
 * Usa PRAGMA table_info que es la API SQLite canonica y portable
 * entre better-sqlite3 y expo-sqlite.
 */
function leerColumnasFacturaNode(db: DatabaseType): ReadonlySet<string> {
  const rows = db.prepare("PRAGMA table_info(factura)").all() as ColumnaInfo[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Aplica la migration 020 a una conexion better-sqlite3 de forma idempotente.
 *
 * Comportamiento:
 *  1. Parsea el script SQL para extraer nombres de columnas a agregar.
 *  2. Lee las columnas actuales via `PRAGMA table_info(factura)`.
 *  3. Para cada columna ausente, ejecuta `ALTER TABLE factura ADD COLUMN X TEXT`
 *     (TEXT para mantener paridad con el SQL original que no especifica tipo;
 *     SQLite es dinamico, esto es coherente).
 *  4. Ejecuta el resto del script (CREATE UNIQUE INDEX `IF NOT EXISTS`) tal
 *     cual via `db.exec()`.
 *
 * Por que TEXT sin DEFAULT: la version original del SQL tampoco especifica
 * DEFAULT, asi que las filas legacy quedan con NULL. Mantener mismo shape
 * evita migracion implicita de filas existentes.
 *
 * Si el script no contiene ALTERs de `factura`, simplemente ejecuta el script
 * completo via `db.exec()` (fallback seguro para migrations NO-factura).
 */
export function aplicarMigration020IdempotenteNode(db: DatabaseType, sql: string): void {
  const columnasA_Agregar = extraerAlterColumnasFactura(sql);
  if (columnasA_Agregar.length === 0) {
    // No es migration 020 (o ya no contiene los ALTERs esperados);
    // ejecutar tal cual para preservar cualquier logica de CREATE INDEX.
    db.exec(sql);
    return;
  }

  const actuales = leerColumnasFacturaNode(db);
  const faltantes = columnasA_Agregar.filter((c) => !actuales.has(c));

  for (const columna of faltantes) {
    db.exec(`ALTER TABLE factura ADD COLUMN ${columna} TEXT`);
  }

  // El resto del script puede incluir `CREATE UNIQUE INDEX` o
  // `CREATE INDEX` (SIN `IF NOT EXISTS`) — el SQL original de la 020 los
  // emite sin guard. Para hacerlo idempotente, los envolvemos
  // transparentemente en `CREATE ... IF NOT EXISTS` solo cuando el
  // original NO lo incluye ya.
  const restoSql = idempotizarResto020(
    sql
      .split('\n')
      .filter((linea) => !/ALTER\s+TABLE\s+factura\s+ADD\s+COLUMN/i.test(linea))
      .join('\n')
      .trim(),
  );
  if (restoSql.length > 0) {
    db.exec(restoSql);
  }
}

/**
 * Variante async para el adapter expo-sqlite (mobile). Misma logica que la
 * version Node pero usando `getAllAsync` (expo-sqlite expone PRAGMA via
 * queries SELECT) y `execAsync` para los ALTERs.
 *
 * Nota: PRAGMA table_info(tabla) en expo-sqlite se consulta via SELECT
 * (`db.getAllAsync("PRAGMA table_info(factura)")`) y retorna filas con shape
 * `{ cid, name, type, notnull, dflt_value, pk }`. Usamos el helper generico
 * con esta semantica.
 */
export async function aplicarMigration020IdempotenteExpo(
  db: SQLite.SQLiteDatabase,
  sql: string,
): Promise<void> {
  const columnasA_Agregar = extraerAlterColumnasFactura(sql);
  if (columnasA_Agregar.length === 0) {
    await db.execAsync(sql);
    return;
  }

  const rowsActuales = await db.getAllAsync<ColumnaInfo>(
    'PRAGMA table_info(factura)',
  );
  const actuales = new Set(rowsActuales.map((r) => r.name));
  const faltantes = columnasA_Agregar.filter((c) => !actuales.has(c));

  for (const columna of faltantes) {
    await db.execAsync(`ALTER TABLE factura ADD COLUMN ${columna} TEXT`);
  }

  const restoSql = idempotizarResto020(
    sql
      .split('\n')
      .filter((linea) => !/ALTER\s+TABLE\s+factura\s+ADD\s+COLUMN/i.test(linea))
      .join('\n')
      .trim(),
  );
  if (restoSql.length > 0) {
    await db.execAsync(restoSql);
  }
}

/**
 * Envoltura idempotente para el resto del SQL: agrega `IF NOT EXISTS` a
 * cualquier `CREATE [UNIQUE] INDEX` que aun no lo tenga. Mantener el
 * principio DRY: ambas variantes (Node + Expo) pasan por aca.
 *
 * No convierte a `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (no soportado
 * por SQLite < 3.35) — esa parte ya la manejamos arriba consultando
 * PRAGMA table_info manualmente.
 *
 * BUGFIX (sdd/first-launch-post-reinstall-bug/e2e-reproduction):
 * La regex anterior `/CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z_]...)/gi`
 * capturaba MAL cuando el SQL ya tenia `IF NOT EXISTS`: tomaba "IF" como
 * nombre del indice, generando SQL duplicado:
 *
 *   Input:    CREATE UNIQUE INDEX IF NOT EXISTS idx_foo
 *   Match:    CREATE UNIQUE INDEX IF
 *   Output:   CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_foo
 *
 * SQLite parsea eso como `CREATE UNIQUE INDEX [IF NOT EXISTS] [IF] [NOT EXISTS idx_foo]`
 * y emite `near "NOT": syntax error`.
 *
 * Fix: la regex captura opcionalmente `\s+IF\s+NOT\s+EXISTS` entre INDEX y el
 * nombre. Si lo incluye, retorna el match intacto (ya es idempotente). Si no,
 * lo agrega.
 */
function idempotizarResto020(restoSql: string): string {
  if (restoSql.length === 0) return restoSql;
  return restoSql.replace(
    /CREATE\s+(UNIQUE\s+)?INDEX(\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)/gi,
    (match, unique, ifNotExists, nombre) => {
      // Si ya incluye IF NOT EXISTS, no tocar (match intacto).
      if (ifNotExists !== undefined) {
        return match;
      }
      return `CREATE ${unique ?? ''}INDEX IF NOT EXISTS ${nombre}`.trim();
    },
  );
}

/**
 * API publica para tests que necesitan instanciar el modulo sin
 * dependencias circulares. Re-exporta ambos helpers.
 */
export const __testing = {
  extraerAlterColumnasFactura,
  leerColumnasFacturaNode,
};

/**
 * Helper generico idempotente para migrations ADITIVAS (SOLO
 * `ALTER TABLE ... ADD COLUMN`). Aplica a migrations como 025/026/027
 * del change `param-tarifa-res-825-compliance-phase2` donde el script es
 * un conjunto plano de `ALTER TABLE <tabla> ADD COLUMN <col> <tipo> [DEFAULT ...]`
 * sin CREATE INDEX ni logica mixta.
 *
 * Estrategia:
 *  1. Parsea el SQL para extraer todos los pares (tabla, columna, sentencia).
 *  2. Para cada tabla mencionada, lee las columnas actuales via
 *     `PRAGMA table_info(<tabla>)`.
 *  3. Ejecuta SOLO los ALTERs cuya columna NO exista ya en la tabla.
 *
 * A diferencia de `aplicarMigration020Idempotente{Node,Expo}` (que esta
 * hardcoded para `factura` y hardcodea `TEXT` como tipo), este helper
 * **preserva la sentencia literal** del script — incluyendo tipo
 * (REAL, INTEGER, TEXT) y DEFAULT. Esto importa porque 025/026/027 tienen:
 *
 *   - 025: `cmaa REAL NULL` (cmaa es REAL, no TEXT)
 *   - 026: `estado_verificacion TEXT NOT NULL DEFAULT 'PENDIENTE'`
 *   - 027: `estado TEXT NOT NULL DEFAULT 'ACTIVO'`
 *
 * Si el script NO contiene ALTERs (caso raro, e.g. una migration futura
 * que sea solo CREATE INDEX o CREATE TABLE), se ejecuta el script tal
 * cual via `db.exec()` — fallback seguro.
 *
 * Tests: `mobile/__tests__/persistencia/migration-aditiva-025-026-027.test.ts`.
 */
interface AlterExtraido {
  readonly tabla: string;
  readonly columna: string;
  readonly sentencia: string;
}

/**
 * Parsea un script SQL y devuelve todos los pares (tabla, columna,
 * sentencia literal) de `ALTER TABLE ... ADD COLUMN ...`. Case-insensitive,
 * tolerante a espacios arbitrarios. NO captura DEFAULTs adentro de la
 * sentencia — los preserva tal cual vienen en el script original.
 */
function extraerAlterColumnasAditivas(sql: string): readonly AlterExtraido[] {
  const alters: AlterExtraido[] = [];
  const re = /ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)\b[^;]*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    alters.push({
      tabla: m[1],
      columna: m[2],
      // Trim para normalizar whitespace leading/trailing.
      sentencia: m[0].trim(),
    });
  }
  return alters;
}

/**
 * Variante sync para el adapter better-sqlite3 (Node). Misma logica que
 * la version Expo pero usando `prepare`/`exec` sincronicos.
 */
export function aplicarMigrationAditivaIdempotenteNode(
  db: DatabaseType,
  sql: string,
): void {
  const alters = extraerAlterColumnasAditivas(sql);
  if (alters.length === 0) {
    // No hay ALTERs aditivos: ejecutar el script tal cual.
    db.exec(sql);
    return;
  }

  // Cachear `PRAGMA table_info(<tabla>)` por tabla — un mismo script
  // puede tocar varias columnas de la misma tabla y queremos evitar
  // N queries redundantes.
  const columnasActuales = new Map<string, ReadonlySet<string>>();
  for (const { tabla } of alters) {
    if (columnasActuales.has(tabla)) continue;
    const rows = db.prepare(`PRAGMA table_info(${tabla})`).all() as ColumnaInfo[];
    columnasActuales.set(tabla, new Set(rows.map((r) => r.name)));
  }

  for (const { tabla, columna, sentencia } of alters) {
    const set = columnasActuales.get(tabla);
    if (!set || set.has(columna)) continue; // columna ya existe: skip
    db.exec(sentencia + ';');
  }
}

/**
 * Variante async para el adapter expo-sqlite (mobile). Misma logica que
 * la version Node pero usando `getAllAsync` (expo-sqlite expone PRAGMA
 * via queries SELECT) y `execAsync` para los ALTERs.
 *
 * Uso desde `mobile/src/persistencia/expo-sqlite/migraciones.ts` para
 * migrations 025/026/027 (y futuras migrations puramente aditivas).
 */
export async function aplicarMigrationAditivaIdempotenteExpo(
  db: SQLite.SQLiteDatabase,
  sql: string,
): Promise<void> {
  const alters = extraerAlterColumnasAditivas(sql);
  if (alters.length === 0) {
    // No hay ALTERs aditivos: ejecutar el script tal cual.
    await db.execAsync(sql);
    return;
  }

  const columnasActuales = new Map<string, ReadonlySet<string>>();
  for (const { tabla } of alters) {
    if (columnasActuales.has(tabla)) continue;
    const rows = await db.getAllAsync<ColumnaInfo>(
      `PRAGMA table_info(${tabla})`,
    );
    columnasActuales.set(tabla, new Set(rows.map((r) => r.name)));
  }

  for (const { tabla, columna, sentencia } of alters) {
    const set = columnasActuales.get(tabla);
    if (!set || set.has(columna)) continue; // columna ya existe: skip
    await db.execAsync(sentencia + ';');
  }
}
