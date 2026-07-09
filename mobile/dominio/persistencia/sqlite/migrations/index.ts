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
  {
    version: 2,
    nombre: '002_lectura',
    sql: leerSQL('002_lectura.sql'),
  },
  {
    version: 3,
    nombre: '003_cola_sync',
    sql: leerSQL('003_cola_sync.sql'),
  },
  {
    version: 4,
    nombre: '004_suscriptor',
    sql: leerSQL('004_suscriptor.sql'),
  },
  {
    version: 5,
    nombre: '005_medidor',
    sql: leerSQL('005_medidor.sql'),
  },
  {
    version: 7,
    nombre: '007_suscriptor_add_aplica_subsidio',
    sql: leerSQL('007_suscriptor_add_aplica_subsidio.sql'),
  },
  {
    version: 8,
    nombre: '008_suscriptor_add_cedula_municipio',
    sql: leerSQL('008_suscriptor_add_cedula_municipio.sql'),
  },
  {
    version: 9,
    nombre: '009_prestador',
    sql: leerSQL('009_prestador.sql'),
  },
  {
    version: 10,
    nombre: '010_acuerdo_municipal',
    sql: leerSQL('010_acuerdo_municipal.sql'),
  },
  {
    version: 11,
    nombre: '011_parametros_tarifa',
    sql: leerSQL('011_parametros_tarifa.sql'),
  },
  {
    version: 12,
    nombre: '012_suscriptor_add_id_prestador',
    sql: leerSQL('012_suscriptor_add_id_prestador.sql'),
  },
  {
    version: 13,
    nombre: '013_lectura_add_id_prestador',
    sql: leerSQL('013_lectura_add_id_prestador.sql'),
  },
  {
    version: 14,
    nombre: '014_factura_add_id_prestador',
    sql: leerSQL('014_factura_add_id_prestador.sql'),
  },
  {
    version: 15,
    nombre: '015_operario',
    sql: leerSQL('015_operario.sql'),
  },
]);
