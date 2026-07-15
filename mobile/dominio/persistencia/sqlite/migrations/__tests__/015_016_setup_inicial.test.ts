/**
 * Tests de las migrations 015 (CREATE operarios) + 016 (ALTER + UNIQUE compuesta).
 *
 * Change: setup-inicial-multi-tenant-auth — Fase 1, tareas 1.1 + 1.2.
 *
 * Patrón: cada test aplica migrations en etapas via `ejecutarMigrations(db, subset)`
 * y luego verifica el schema resultante con PRAGMAs.
 *
 * Para T3.1 (compatibilidad con DB legacy) aplicamos migrations 1-14 sobre una DB
 * pre-poblada con el prestador legacy (id=0) — emulando una instalación existente
 * que recibe 015 + 016.
 */

import { crearConexion } from '../../db';
import { ejecutarMigrations } from '../../migration-runner';
import { migrations as ALL_MIGRATIONS } from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Devuelve las migrations con version <= `hastaVersion`. Para tests que
 * quieren emular el schema hasta un punto del historial (ej: "como si 015
 * ya estuviera aplicada pero 016 no").
 */
function migrationsHasta(hastaVersion: number) {
  return ALL_MIGRATIONS.filter((m) => m.version <= hastaVersion);
}

function columnas(db: ReturnType<typeof crearConexion>, tabla: string): string[] {
  const cols = db.prepare(`PRAGMA table_info('${tabla}')`).all() as Array<{ name: string }>;
  return cols.map((c) => c.name);
}

// ---------------------------------------------------------------------------
// Bloque 1 — Migration 015: CREATE operario + UNIQUE temporal sobre dispositivo_id
// ---------------------------------------------------------------------------

describe('migration 015_operario — crea tabla operarios (deuda técnica "Iter 7" saldada)', () => {
  it('T1.1: crea la tabla operarios con todas las columnas del dominio', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(15));

      const nombres = columnas(db, 'operarios');

      // Las 9 columnas que el schema de dominio necesita (types.ts Operario).
      expect(nombres).toEqual(
        expect.arrayContaining([
          'id_operario',
          'numero_cedula',
          'nombre',
          'email',
          'password_hash',
          'rol',
          'estado',
          'dispositivo_id',
          'created_at',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('T1.2: numero_cedula tiene UNIQUE global (rechaza dos operarios con misma cedula)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(15));

      const insertar = db.prepare(
        `INSERT INTO operarios
           (numero_cedula, nombre, email, password_hash, rol, estado)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      // Primer operario OK
      insertar.run('12345678', 'Ana Lopez', 'ana@example.com', 'hash-ana', 'operario', 'activo');

      // Segundo operario con la misma cedula → debe fallar por UNIQUE.
      expect(() =>
        insertar.run('12345678', 'Otro Nombre', 'otro@example.com', 'hash-otro', 'operario', 'activo'),
      ).toThrow(/UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('T1.3: respeta los CHECK constraints de rol y estado + inserta operario válido', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(15));

      // Defaults de la tabla: rol='operario', estado='activo'.
      // El insert básico respeta ambos defaults.
      db.prepare(
        `INSERT INTO operarios (numero_cedula, nombre, email, password_hash)
         VALUES (?, ?, ?, ?)`,
      ).run('87654321', 'Carlos Ruiz', 'carlos@example.com', 'hash-carlos');

      const row = db
        .prepare(
          `SELECT numero_cedula, nombre, email, password_hash, rol, estado
           FROM operarios WHERE numero_cedula = ?`,
        )
        .get('87654321') as {
          numero_cedula: string;
          nombre: string;
          email: string;
          password_hash: string;
          rol: string;
          estado: string;
        };

      expect(row).toEqual({
        numero_cedula: '87654321',
        nombre: 'Carlos Ruiz',
        email: 'carlos@example.com',
        password_hash: 'hash-carlos',
        rol: 'operario',
        estado: 'activo',
      });

      // CHECK de rol: valor fuera del enum debe fallar.
      expect(() =>
        db
          .prepare(
            `INSERT INTO operarios (numero_cedula, nombre, email, password_hash, rol)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run('11111111', 'X', 'x@example.com', 'hx', 'gerente'),
      ).toThrow(/CHECK/i);

      // CHECK de estado: valor fuera del enum debe fallar.
      expect(() =>
        db
          .prepare(
            `INSERT INTO operarios (numero_cedula, nombre, email, password_hash, estado)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run('22222222', 'Y', 'y@example.com', 'hy', 'suspendido'),
      ).toThrow(/CHECK/i);
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Bloque 2 — Migration 016: ALTER prestador + ALTER operario (FK + UNIQUE compuesta)
// ---------------------------------------------------------------------------

describe('migration 016_setup_inicial_multi_tenant — altera prestador + operarios para multi-tenant', () => {
  it('T2.1: agrega las columnas representante_legal y representante_legal_cedula al prestador', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(16));

      const cols = columnas(db, 'prestador');

      expect(cols).toContain('representante_legal');
      expect(cols).toContain('representante_legal_cedula');

      // Defaults vacíos: las nuevas columnas son NOT NULL DEFAULT '' → un prestador
      // recién insertado sin esos campos los trae vacíos.
      db.prepare(
        `INSERT INTO prestador
           (codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('PRUEBA-1', 'Prestador Prueba', '111111111-1', 'Bogotá', 'Cundinamarca', 2);

      const row = db
        .prepare(
          `SELECT representante_legal, representante_legal_cedula
           FROM prestador WHERE codigo = ?`,
        )
        .get('PRUEBA-1') as { representante_legal: string; representante_legal_cedula: string };

      expect(row.representante_legal).toBe('');
      expect(row.representante_legal_cedula).toBe('');
    } finally {
      db.close();
    }
  });

  it('T2.2: agrega id_prestador al operario con DEFAULT 0 (FK al prestador)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(16));

      const cols = columnas(db, 'operarios');
      expect(cols).toContain('id_prestador');

      // Insertar un operario sin setear id_prestador → debe tomar default 0
      // (que satisface la FK porque el prestador legacy se sembró en 009_prestador.sql).
      db.prepare(
        `INSERT INTO operarios (numero_cedula, nombre, email, password_hash)
         VALUES (?, ?, ?, ?)`,
      ).run('33333333', 'Default Tester', 'default@example.com', 'h-default');

      const row = db
        .prepare(`SELECT id_prestador FROM operarios WHERE numero_cedula = ?`)
        .get('33333333') as { id_prestador: number };

      expect(row.id_prestador).toBe(0);
    } finally {
      db.close();
    }
  });

  it('T2.3: permite 2 operarios con mismo dispositivo en DISTINTOS prestadores (UNIQUE compuesta)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(16));

      // Dos prestadores reales (distintos a id=0).
      db.prepare(
        `INSERT INTO prestador
           (id_prestador, codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'PRES-1', 'Prestador Uno', '111', 'Bogotá', 'Cundinamarca', 1);
      db.prepare(
        `INSERT INTO prestador
           (id_prestador, codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(2, 'PRES-2', 'Prestador Dos', '222', 'Medellín', 'Antioquia', 1);

      // Mismo dispositivo, distintos prestadores → ambos deben persistir.
      db.prepare(
        `INSERT INTO operarios
           (numero_cedula, nombre, email, password_hash, dispositivo_id, id_prestador)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('44444444', 'Ana Pres 1', 'ana1@example.com', 'h1', 'DEVICE-ABC', 1);

      expect(() =>
        db
          .prepare(
            `INSERT INTO operarios
               (numero_cedula, nombre, email, password_hash, dispositivo_id, id_prestador)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run('55555555', 'Luis Pres 2', 'luis2@example.com', 'h2', 'DEVICE-ABC', 2),
      ).not.toThrow();

      const count = db
        .prepare(`SELECT COUNT(*) AS c FROM operarios WHERE dispositivo_id = ?`)
        .get('DEVICE-ABC') as { c: number };
      expect(count.c).toBe(2);
    } finally {
      db.close();
    }
  });

  it('T2.4: rechaza 2 operarios con mismo dispositivo en MISMO prestador (UNIQUE compuesta)', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(16));

      db.prepare(
        `INSERT INTO prestador
           (id_prestador, codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(10, 'PRES-X', 'Prestador X', '999', 'Cali', 'Valle', 1);

      // Primer operario OK.
      db.prepare(
        `INSERT INTO operarios
           (numero_cedula, nombre, email, password_hash, dispositivo_id, id_prestador)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('66666666', 'Ana X', 'anax@example.com', 'h1', 'DEVICE-XYZ', 10);

      // Segundo operario, mismo dispositivo, mismo prestador → UNIQUE compuesta falla.
      expect(() =>
        db
          .prepare(
            `INSERT INTO operarios
               (numero_cedula, nombre, email, password_hash, dispositivo_id, id_prestador)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run('77777777', 'Luis X', 'luisx@example.com', 'h2', 'DEVICE-XYZ', 10),
      ).toThrow(/UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('T2.5: aplica FK con ON DELETE RESTRICT: no se puede borrar prestador con operarios', () => {
    const db = crearConexion();
    try {
      ejecutarMigrations(db, migrationsHasta(16));

      db.prepare(
        `INSERT INTO prestador
           (id_prestador, codigo, nombre, nit, municipio, departamento, segmento)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(20, 'PRES-Y', 'Prestador Y', '888', 'Bogotá', 'Cundinamarca', 1);

      db.prepare(
        `INSERT INTO operarios
           (numero_cedula, nombre, email, password_hash, dispositivo_id, id_prestador)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('88888888', 'Tester Y', 'testerY@example.com', 'h-y', 'DEVICE-Y', 20);

      // DELETE del prestador con operarios activos → debe fallar por FK RESTRICT.
      expect(() =>
        db.prepare(`DELETE FROM prestador WHERE id_prestador = ?`).run(20),
      ).toThrow(/FOREIGN KEY/i);
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Bloque 3 — Compatibilidad con DB legacy (pre-015)
// ---------------------------------------------------------------------------

describe('compatibilidad con DB legacy: aplicar 015 + 016 sobre prestador id=0 pre-existente', () => {
  it('T3.1: la migration 015 NO rompe una DB que ya tiene prestador id=0 sembrado', () => {
    const db = crearConexion();
    try {
      // Aplicamos migrations 1-14 (todo lo previo al cambio multitenant-auth).
      ejecutarMigrations(db, migrationsHasta(14));

      // Verificamos que el prestador legacy (id=0) ya existe por la migration 009.
      const legacy = db
        .prepare(`SELECT id_prestador, codigo FROM prestador WHERE id_prestador = 0`)
        .get() as { id_prestador: number; codigo: string } | undefined;
      expect(legacy).toBeDefined();
      expect(legacy?.codigo).toBe('EPC-LEGACY');

      // Aplicar 015: crea operario con DEFAULT 0 sobre id_prestador → FK satisfecha.
      expect(() => ejecutarMigrations(db, migrationsHasta(15))).not.toThrow();

      // Aplicar 016: agrega id_prestador NOT NULL DEFAULT 0 a operario, no rompe legacy.
      expect(() => ejecutarMigrations(db, migrationsHasta(16))).not.toThrow();

      // El prestador legacy sigue ahí y la tabla operarios está vacía pero usable.
      const legacyPost = db
        .prepare(`SELECT codigo FROM prestador WHERE id_prestador = 0`)
        .get() as { codigo: string };
      expect(legacyPost.codigo).toBe('EPC-LEGACY');

      db.prepare(
        `INSERT INTO operarios (numero_cedula, nombre, email, password_hash)
         VALUES (?, ?, ?, ?)`,
      ).run('99999999', 'Legacy Tester', 'legacy@example.com', 'h-legacy');

      const opRow = db
        .prepare(`SELECT id_prestador FROM operarios WHERE numero_cedula = ?`)
        .get('99999999') as { id_prestador: number };
      expect(opRow.id_prestador).toBe(0);

      // Las nuevas columnas representante_legal del prestador existen y están vacías.
      const repLegal = db
        .prepare(
          `SELECT representante_legal, representante_legal_cedula
           FROM prestador WHERE id_prestador = 0`,
        )
        .get() as { representante_legal: string; representante_legal_cedula: string };
      expect(repLegal.representante_legal).toBe('');
      expect(repLegal.representante_legal_cedula).toBe('');
    } finally {
      db.close();
    }
  });
});