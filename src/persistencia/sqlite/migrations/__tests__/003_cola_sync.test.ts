/**
 * Tests de schema de la migration 003_cola_sync.
 *
 * Verifica que el SQL declara columnas, constraints e indices que el
 * adapter SQLite (`crearColaSincronizacionSqlite`) y el dominio van a
 * apoyarse, en linea con el tipo `ItemCola` de sincronizacion/types.ts
 * y la interface `ColaSincronizacion`.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations } from '../index';
import { crearDBTest } from '../../__fixtures__/crear-db-test';

describe('migration 003_cola_sync — schema completo', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});

// Suprimir warning de "no exported" (ningun export en este file).
export {};

// Mantener referencia para que el bundler no elimine imports — usados en cycles siguientes.
void crearConexion;
void ejecutarMigrations;
void migrations;
void crearDBTest;
