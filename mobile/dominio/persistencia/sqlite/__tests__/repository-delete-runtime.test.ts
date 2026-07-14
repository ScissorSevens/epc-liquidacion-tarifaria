import type { Database as DatabaseType } from 'better-sqlite3';
import { crearDBTest } from '../__fixtures__/crear-db-test';
import { crearAcuerdoMunicipalRepositorySqlite } from '../acuerdo-municipal-repository-sqlite';
import { crearParametrosTarifaRepositorySqlite } from '../parametros-tarifa-repository-sqlite';
import { crearPrestadorRepositorySqlite } from '../prestador-repository-sqlite';

function insertarPrestador(db: DatabaseType, idPrestador: number): void {
  db.prepare(
    `INSERT INTO prestador (
       id_prestador, codigo, nombre, nit, representante_legal,
       representante_legal_cedula, municipio, departamento, segmento
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idPrestador,
    `P-${idPrestador}`,
    `Prestador ${idPrestador}`,
    `900${idPrestador}`,
    'Representante Legal',
    '12345678',
    'Cáqueza',
    'Cundinamarca',
    2,
  );
}

function insertarAcuerdo(db: DatabaseType, idAcuerdo: number, idPrestador: number): void {
  db.prepare(
    `INSERT INTO acuerdo_municipal (
       id_acuerdo, id_prestador, factor_subsidio_e1, factor_subsidio_e2,
       factor_subsidio_e3, factor_contribucion_e5, factor_contribucion_e6,
       factor_contribucion_comercial, factor_contribucion_industrial,
       fecha_vigencia_desde, fecha_vigencia_hasta
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idAcuerdo,
    idPrestador,
    -0.5,
    -0.4,
    -0.15,
    0.5,
    0.6,
    0.5,
    0.3,
    '2026-01-01',
    '2030-12-31',
  );
}

describe('eliminar() en adapters SQLite de dominio', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = crearDBTest();
  });

  afterEach(() => {
    db.close();
  });

  it('elimina un prestador por id y es idempotente si ya no existe', async () => {
    insertarPrestador(db, 41);
    const repo = crearPrestadorRepositorySqlite(db);

    await repo.eliminar(41);
    await expect(repo.eliminar(41)).resolves.toBeUndefined();

    const fila = db
      .prepare('SELECT id_prestador FROM prestador WHERE id_prestador = ?')
      .get(41);
    expect(fila).toBeUndefined();
  });

  it('elimina un acuerdo municipal por id y es idempotente si ya no existe', async () => {
    insertarPrestador(db, 42);
    insertarAcuerdo(db, 142, 42);
    const repo = crearAcuerdoMunicipalRepositorySqlite(db);

    await repo.eliminar(142);
    await expect(repo.eliminar(142)).resolves.toBeUndefined();

    const fila = db
      .prepare('SELECT id_acuerdo FROM acuerdo_municipal WHERE id_acuerdo = ?')
      .get(142);
    expect(fila).toBeUndefined();
  });

  it('elimina parámetros de tarifa por id y es idempotente si ya no existen', async () => {
    insertarPrestador(db, 43);
    insertarAcuerdo(db, 143, 43);
    db.prepare(
      `INSERT INTO parametros_tarifa (
         id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt,
         agua_suministrada_m3_anio, suscriptores_promedio,
         vigente_desde, vigente_hasta
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(243, 43, 143, 2026, 5_000_000, 800, 200, 100, 12_000, 150, '2026-01-01', '2030-12-31');
    const repo = crearParametrosTarifaRepositorySqlite(db);

    await repo.eliminar(243);
    await expect(repo.eliminar(243)).resolves.toBeUndefined();

    const fila = db
      .prepare('SELECT id_parametros FROM parametros_tarifa WHERE id_parametros = ?')
      .get(243);
    expect(fila).toBeUndefined();
  });
});
