/**
 * Tests del bootstrap `crearBootstrapFacturaSqlite`.
 *
 * Cablea adapter SQLite real contra archivos temporales en `os.tmpdir()`
 * para verificar el lifecycle completo (open → migrate → use → close).
 */

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { crearBootstrapFacturaSqlite } from '../bootstrap';
import { emitirFactura } from '../factura';
import { calcularHash } from '../../calculo/calculo';
import type { Liquidacion } from '../../calculo/types';
import type { EmitirFacturaInput } from '../types';
import type { Hasher } from '../../shared/ports';

const hasher: Hasher = { sha256: (input: string) => `hash-fake-${input.length}` };

function crearDirTmp(): string {
  return mkdtempSync(join(tmpdir(), 'epc-bootstrap-'));
}

describe('crearBootstrapFacturaSqlite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = crearDirTmp();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('crea archivo SQLite en dbPath nuevo y aplica migraciones (smoke)', () => {
    const dbPath = join(tmpDir, 'factura.db');
    expect(existsSync(dbPath)).toBe(false);

    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      // 1. archivo creado
      expect(existsSync(dbPath)).toBe(true);
      // 2. migraciones aplicadas → user_version > 0
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const version = inspector.pragma('user_version', { simple: true }) as number;
        expect(version).toBeGreaterThanOrEqual(1);
        // 3. tabla factura existe
        const tabla = inspector
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='factura'")
          .get();
        expect(tabla).toEqual({ name: 'factura' });
      } finally {
        inspector.close();
      }
      // 4. repository expuesto
      expect(typeof bootstrap.repository.crear).toBe('function');
      expect(typeof bootstrap.cerrar).toBe('function');
    } finally {
      bootstrap.cerrar();
    }
  });

  it('re-abrir el mismo dbPath NO re-ejecuta migraciones (idempotencia)', () => {
    const dbPath = join(tmpDir, 'factura.db');

    // Primer bootstrap: aplica migraciones desde cero
    const primero = crearBootstrapFacturaSqlite({ dbPath });
    let versionPrimero: number;
    try {
      const inspector = new Database(dbPath, { readonly: true });
      try {
        versionPrimero = inspector.pragma('user_version', { simple: true }) as number;
      } finally {
        inspector.close();
      }
      expect(versionPrimero).toBeGreaterThanOrEqual(1);
    } finally {
      primero.cerrar();
    }

    // Segundo bootstrap sobre el MISMO archivo: si re-ejecutara las
    // migraciones, `CREATE TABLE factura` lanzaría "table factura already
    // exists". El runner debe filtrar por `user_version` y no lanzar.
    const segundo = crearBootstrapFacturaSqlite({ dbPath });
    try {
      const inspector = new Database(dbPath, { readonly: true });
      try {
        const versionSegundo = inspector.pragma('user_version', { simple: true }) as number;
        // user_version se mantiene → no se aplicaron migraciones nuevas
        expect(versionSegundo).toBe(versionPrimero);
      } finally {
        inspector.close();
      }
      expect(typeof segundo.repository.crear).toBe('function');
    } finally {
      segundo.cerrar();
    }
  });

  it('cerrar() libera la conexion: operaciones posteriores fallan', async () => {
    const dbPath = join(tmpDir, 'factura.db');
    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });

    // Listar funciona ANTES de cerrar (conexion abierta)
    await expect(bootstrap.repository.listar()).resolves.toEqual([]);

    bootstrap.cerrar();

    // Listar DESPUES de cerrar debe fallar: better-sqlite3 lanza
    // "The database connection is not open" al usar statements preparados
    // sobre una db cerrada.
    await expect(bootstrap.repository.listar()).rejects.toThrow(
      /database connection is not open/i,
    );
  });

  it('lanza error de dominio claro en espanol cuando dbPath es invalido', () => {
    // Path con directorio padre inexistente → SQLite no puede abrir el archivo
    const dbPathInvalido = join(tmpDir, 'subdir-inexistente', 'no', 'factura.db');

    expect(() => crearBootstrapFacturaSqlite({ dbPath: dbPathInvalido })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/no se pudo abrir la base de datos/i),
        cause: expect.objectContaining({
          codigo: 'ERROR_PERSISTENCIA',
          dbPath: dbPathInvalido,
        }),
      }),
    );
  });

  it('end-to-end: repository del bootstrap guarda y recupera facturas sobre archivo real', async () => {
    const dbPath = join(tmpDir, 'factura-e2e.db');
    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      const factura = emitirFactura(inputE2E(), hasher);

      // crear → la factura se persiste y el round-trip preserva campos
      const creada = await bootstrap.repository.crear(factura);
      expect(creada).toEqual(factura);

      // buscarPorId → la recuperamos por id
      const recuperada = await bootstrap.repository.buscarPorId(factura.id);
      expect(recuperada).toEqual(factura);

      // listar → aparece en el resultado
      const todas = await bootstrap.repository.listar();
      expect(todas).toHaveLength(1);
      expect(todas[0]).toEqual(factura);
    } finally {
      bootstrap.cerrar();
    }
  });
});

// ---------- Builders mínimos para el e2e ----------
// Reutilizan el mismo input shape que el contract harness.
// No importamos del contract.ts porque ahí los builders son `function` privadas.

function inputE2E(): EmitirFacturaInput {
  const liquidacionBase = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: {
      id_prestador: 0,
      estrato: 1 as const,
      categoria_uso: 'residencial' as const,
      consumo_m3: 12,
      consumo_efectivo_m3: 12,
      bloques: [],
      cargo_fijo: 5000,
      cc_unitario: 1500,
      cc_total: 18000,
      subsidio: 4600,
      contribucion: 0,
      total: 18400,
      factor_aplicado: -0.20,
      metadata: { norma_aplicada: 'X', acuerdo_id: null, parametros_id: 0, cmviaa_aplicado: false, minimo_vital_aplicado: false, factor_capeado: false, version_motor: 'X', calculo_timestamp: 'X' },
    },
    estado: 'ACTIVA' as const,
  };
  const liquidacion: Liquidacion = {
    ...liquidacionBase,
    hash: calcularHash(liquidacionBase, hasher),
  };
  return {
    suscriptor: {
      id_suscriptor: 1,
      codigo: '00001',
      nombre_apellidos: 'María López',
      cedula: '123456789',
      municipio: 'Bogotá',
      direccion: 'Calle 5 #2-10',
      estrato: 2,
      aplica_subsidio: false,
    id_prestador: 0,
    categoria_uso: 'residencial',
      estado: 'activo',
          created_at: '2026-01-01T00:00:00.000Z',
    },
    medidor: {
      id_medidor: 10,
      numero_medidor: 'MED-0001',
      id_suscriptor: 1,
      fecha_instalacion: '2024-01-15',
      estado: 'activo',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    periodo: {
      id_periodo: '202601',
      nombre: 'Enero 2026',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-01-31',
      fecha_pago_sin_recargo: '2026-02-15',
      fecha_pago_con_recargo: '2026-02-28',
      dias_consumo: 31,
      estado: 'cerrado',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    operario: {
      id_operario: 7,
      id_prestador: 1,
      numero_cedula: '1234567890',
      nombre: 'Ana Gómez',
      email: 'ana@epc.co',
      password_hash: 'argon2id$v=19$m=...',
      rol: 'operario',
      estado: 'activo',
      dispositivo_id: 'MZ-001',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    prestador: {
      id_prestador: 1,
      codigo: '0001',
      nombre: 'Aguas del Valle S.A. E.S.P.',
      nit: '900123456-7',
      representante_legal: 'Carlos Ramírez',
      representante_legal_cedula: '79123456',
      municipio: 'Cali',
      departamento: 'Valle del Cauca',
      segmento: 2,
      num_suscriptores_urbanos: 1200,
      num_suscriptores_rurales: 800,
      contacto: 'contacto@aguasdelvalle.co',
      estado: 'activo',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    lectura: {
      id_medidor: 10,
      id_periodo: '202601',
      id_operario: 7,
      lectura_actual: 1234,
      lectura_anterior: 1200,
      estado_validacion: 'validado',
      timestamp_captura: '2026-02-01T08:30:00.000Z',
      estado_sync: 'pendiente',
      id_prestador: 1,
    },
    liquidacion,
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
  };
}
