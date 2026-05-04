/**
 * Registro central de migrations SQLite ordenadas por `version` ascendente.
 *
 * Cada migration se carga desde un `.sql` adyacente vía `fs.readFileSync`
 * resolviendo a `__dirname` (D11): el SQL queda como source-of-truth en
 * archivos planos auditables, no embebido en strings TS.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { Migration } from '../migration-runner';

function leerSQL(nombre: string): string {
  return readFileSync(join(__dirname, nombre), 'utf-8');
}

export const migrations: readonly Migration[] = Object.freeze([
  {
    version: 1,
    nombre: '001_factura',
    sql: leerSQL('001_factura.sql'),
  },
]);
