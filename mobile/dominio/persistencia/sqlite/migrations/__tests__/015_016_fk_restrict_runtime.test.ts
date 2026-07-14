import type { Database as DatabaseType } from 'better-sqlite3';
import { crearDBTest } from '../../__fixtures__/crear-db-test';

function insertarPrestador(db: DatabaseType, idPrestador: number): void {
  db.prepare(
    `INSERT INTO prestador (
       id_prestador, codigo, nombre, nit, representante_legal,
       representante_legal_cedula, municipio, departamento, segmento
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idPrestador,
    `FK-${idPrestador}`,
    `Prestador FK ${idPrestador}`,
    `900-FK-${idPrestador}`,
    'Representante FK',
    '12345678',
    'Cáqueza',
    'Cundinamarca',
    2,
  );
}

function insertarOperario(db: DatabaseType, idOperario: number, idPrestador: number): void {
  db.prepare(
    `INSERT INTO operario (
       id_operario, numero_cedula, nombre, email, password_hash,
       rol, estado, id_prestador
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idOperario,
    String(10_000_000 + idOperario),
    `Operario FK ${idOperario}`,
    `operario-${idOperario}@example.com`,
    `hash-${idOperario}`,
    'operario',
    'activo',
    idPrestador,
  );
}

function insertarAcuerdoYParametros(
  db: DatabaseType,
  idPrestador: number,
  idAcuerdo: number,
  idParametros: number,
): void {
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

  db.prepare(
    `INSERT INTO parametros_tarifa (
       id_parametros, id_prestador, id_acuerdo, periodo, cma, cmo, cmi, cmt,
       agua_suministrada_m3_anio, suscriptores_promedio,
       vigente_desde, vigente_hasta
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    idParametros,
    idPrestador,
    idAcuerdo,
    2026,
    5_000_000,
    800,
    200,
    100,
    12_000,
    150,
    '2026-01-01',
    '2030-12-31',
  );
}

describe('migrations 015/016 — FK ON DELETE RESTRICT en SQLite real', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = crearDBTest();
  });

  afterEach(() => {
    db.close();
  });

  it('T1: rechaza borrar un prestador que todavía tiene un operario', () => {
    insertarPrestador(db, 51);
    insertarOperario(db, 151, 51);

    expect(() =>
      db.prepare('DELETE FROM prestador WHERE id_prestador = ?').run(51),
    ).toThrow(/FOREIGN KEY/i);

    const prestador = db
      .prepare('SELECT id_prestador FROM prestador WHERE id_prestador = ?')
      .get(51);
    const operario = db
      .prepare('SELECT id_operario FROM operario WHERE id_operario = ?')
      .get(151);
    expect(prestador).toEqual({ id_prestador: 51 });
    expect(operario).toEqual({ id_operario: 151 });
  });

  it('T2: el DELETE rechazado no altera acuerdos ni parámetros del prestador', () => {
    insertarPrestador(db, 52);
    insertarAcuerdoYParametros(db, 52, 152, 252);
    insertarOperario(db, 252, 52);

    expect(() =>
      db.prepare('DELETE FROM prestador WHERE id_prestador = ?').run(52),
    ).toThrow(/FOREIGN KEY/i);

    const acuerdo = db
      .prepare(
        `SELECT id_acuerdo, id_prestador
         FROM acuerdo_municipal WHERE id_acuerdo = ?`,
      )
      .get(152);
    const parametros = db
      .prepare(
        `SELECT id_parametros, id_prestador, id_acuerdo
         FROM parametros_tarifa WHERE id_parametros = ?`,
      )
      .get(252);
    expect(acuerdo).toEqual({ id_acuerdo: 152, id_prestador: 52 });
    expect(parametros).toEqual({
      id_parametros: 252,
      id_prestador: 52,
      id_acuerdo: 152,
    });
  });

  it('T3: permite borrar el prestador después de borrar físicamente su operario', () => {
    insertarPrestador(db, 53);
    insertarOperario(db, 153, 53);

    const operarioEliminado = db
      .prepare('DELETE FROM operario WHERE id_operario = ?')
      .run(153);
    const prestadorEliminado = db
      .prepare('DELETE FROM prestador WHERE id_prestador = ?')
      .run(53);

    expect(operarioEliminado.changes).toBe(1);
    expect(prestadorEliminado.changes).toBe(1);
    expect(
      db.prepare('SELECT id_operario FROM operario WHERE id_operario = ?').get(153),
    ).toBeUndefined();
    expect(
      db.prepare('SELECT id_prestador FROM prestador WHERE id_prestador = ?').get(53),
    ).toBeUndefined();
  });
});
