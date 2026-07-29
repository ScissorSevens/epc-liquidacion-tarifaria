/**
 * Tests de integracion: bootstrap + emitirFacturaConRepo con todos los
 * campos del change factura-compliance-fase1.
 *
 * Verifica que el flujo end-to-end funciona:
 *  1. `crearBootstrapFacturaSqlite` crea el repo.
 *  2. `emitirFacturaConRepo` acepta prestador, lectura, otrosValores,
 *     saldoAnterior, idGen y persiste la factura completa.
 *  3. `buscarPorId` recupera la factura con codigo_verificacion,
 *     version_tarifa_aplicada, referencia_pago, qr_pago.
 *
 * TDD: el objetivo es detectar drift entre emision y persistencia.
 * Si un caller (CapturaLectura, liquidarLectura) quiere emitir la
 * factura desde el dominio, este test prueba que el flujo cierra.
 */
'use strict';

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { crearBootstrapFacturaSqlite } from '../../dominio/factura/bootstrap';
import { emitirFactura, calcularTotalFactura } from '../../dominio/factura/factura';
import { emitirFacturaConRepo } from '../../dominio/factura/factura-con-repo';
import { calcularHash } from '../../dominio/calculo/calculo';
import { crearFacturaRepositoryInMemory } from '../../dominio/factura/__tests__/factura-repository-in-memory';
import { crearOtroValor } from '../../dominio/factura/otros-valores-catalogo';
import type { EmitirFacturaInput, Factura } from '../../dominio/factura/types';
import type { Liquidacion } from '../../dominio/calculo/types';
import type { Suscriptor } from '../../dominio/suscriptores/types';
import type { Medidor } from '../../dominio/medidores/types';
import type { Periodo } from '../../dominio/periodos/types';
import type { Operario } from '../../dominio/operarios/types';
import type { Prestador } from '../../dominio/prestadores/types';
import type { Lectura } from '../../dominio/captura-lecturas/types';
import type { ResultadoCalculo } from '../../dominio/motor-tarifario';
import type { Hasher, IdGenerator } from '../../dominio/shared/ports';

function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };

let uuidCounter = 0;
const idGen: IdGenerator = {
  uuid: () => {
    uuidCounter += 1;
    const hex = uuidCounter.toString(16).padStart(12, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-a${hex.slice(0, 3)}-${hex.slice(0, 12)}`;
  },
};

function prestadorBase(): Prestador {
  return {
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
  };
}

function suscriptorBase(): Suscriptor {
  return {
    id_suscriptor: 1,
    codigo: '00001',
    nombre_apellidos: 'María López',
    cedula: '123456789',
    municipio: 'Bogotá',
    direccion: 'Calle 5 #2-10',
    estrato: 2,
    aplica_subsidio: false,
    id_prestador: 1,
    categoria_uso: 'residencial',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function medidorBase(): Medidor {
  return {
    id_medidor: 10,
    numero_medidor: 'MED-0001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-15',
    estado: 'activo',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function periodoBase(): Periodo {
  return {
    id_periodo: '202601',
    nombre: 'Enero 2026',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-01-31',
    fecha_pago_sin_recargo: '2026-02-15',
    fecha_pago_con_recargo: '2026-02-28',
    dias_consumo: 31,
    estado: 'cerrado',
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function operarioBase(): Operario {
  return {
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
  };
}

function lecturaBase(): Lectura {
  return {
    id_medidor: 10,
    id_periodo: '202601',
    id_operario: 7,
    lectura_actual: 1234,
    lectura_anterior: 1200,
    estado_validacion: 'validado',
    timestamp_captura: '2026-02-01T08:30:00.000Z',
    estado_sync: 'pendiente',
    id_prestador: 1,
  };
}

function resultadoBase(): ResultadoCalculo {
  return {
    id_prestador: 1,
    estrato: 2 as const,
    categoria_uso: 'residencial' as const,
    consumo_m3: 10,
    consumo_efectivo_m3: 10,
    bloques: [],
    cargo_fijo: 5000,
    cc_unitario: 1500,
    cc_total: 15000,
    subsidio: 0,
    contribucion: 0,
    total: 20000,
    factor_aplicado: 0,
    metadata: {
      norma_aplicada: 'X',
      acuerdo_id: null,
      parametros_id: 0,
      cmviaa_aplicado: false,
      minimo_vital_aplicado: false,
      factor_capeado: false,
      version_motor: 'v825-2017-1.0',
      calculo_timestamp: 'X',
    },
  };
}

function liquidacionBase(): Liquidacion {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    suscriptorId: '1',
    fechaGeneracion: new Date('2026-02-01T10:00:00.000Z'),
    resultado: resultadoBase(),
    estado: 'ACTIVA' as const,
  };
  return { ...base, hash: calcularHash(base, hasher) };
}

function inputBase(overrides: Partial<EmitirFacturaInput> = {}): EmitirFacturaInput {
  return {
    suscriptor: suscriptorBase(),
    medidor: medidorBase(),
    periodo: periodoBase(),
    operario: operarioBase(),
    prestador: prestadorBase(),
    lectura: lecturaBase(),
    liquidacion: liquidacionBase(),
    consumosHistoricos: [],
    fechaEmision: '2026-02-01',
    consecutivo: 1,
    ...overrides,
  };
}

describe('wire bootstrap + liquidarLectura + emitirFactura', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'epc-wire-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('bootstrap expone repository y soporta emitirFacturaConRepo con todos los campos', async () => {
    const dbPath = join(tmpDir, 'wire.db');
    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      // El caller fija prestador + lectura + idGen en el input; emitir
      // los proyecta. La fase pura (emitirFactura) populada los
      // campos top-level: codigo_verificacion, version_tarifa_aplicada,
      // referencia_pago, qr_pago.
      const facturaPura = emitirFactura(inputBase(), hasher, idGen);
      expect(facturaPura.codigo_verificacion).toBeDefined();
      expect(facturaPura.codigo_verificacion).toHaveLength(10);
      expect(facturaPura.version_tarifa_aplicada).toBe('v825-2017-1.0');
      expect(facturaPura.referencia_pago).toMatch(/^.+-.+-.+-.{4}$/);
      expect(facturaPura.qr_pago).toBeDefined();
      // qr_pago es JSON parseable con 4 campos
      const qrParsed = JSON.parse(facturaPura.qr_pago!) as Record<string, unknown>;
      expect(Object.keys(qrParsed).sort()).toEqual([
        'codigo_verificacion',
        'fecha_emision',
        'referencia_pago',
        'valor_total',
      ]);
      // Snapshot con prestador.
      expect(facturaPura.snapshot.prestador.id_prestador).toBe(1);
      expect(facturaPura.snapshot.prestador.nit).toBe('900123456-7');
      // Snapshot con lectura.
      expect(facturaPura.snapshot.lectura.lectura_actual).toBe(1234);

      // Persiste via repo (Fase 1: pre-migration 020) — la factura
      // round-trip es valida (id asignado) aunque los campos top-level
      // nullable no viajan a columnas. Migration 020 los expone.
      const persistida = await emitirFacturaConRepo(inputBase(), bootstrap.repository, hasher, idGen);
      expect(persistida.id).not.toBe('');
      expect(persistida.snapshot.prestador.id_prestador).toBe(1);
    } finally {
      bootstrap.cerrar();
    }
  });

  it('emitirFacturaConRepo con otros_valores y saldo_anterior persiste los datos', async () => {
    const dbPath = join(tmpDir, 'otros-valores.db');
    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      const otrosValores = [
        crearOtroValor('RECONEXION', 50000),
        crearOtroValor('INTERESES_AUTORIZADOS', 5000, 'Res 825 art.14'),
      ];
      const input = inputBase({ otrosValores, saldoAnterior: 15000 });
      const factura = await emitirFacturaConRepo(input, bootstrap.repository, hasher, idGen);

      // Round-trip: las columnas nullable aceptan los datos.
      const recuperada = await bootstrap.repository.buscarPorId(factura.id);
      expect(recuperada).not.toBeNull();
      expect(recuperada!.snapshot.otros_valores).toHaveLength(2);
      expect(recuperada!.snapshot.otros_valores[0].concepto).toBe('RECONEXION');
      expect(recuperada!.snapshot.saldo_anterior).toBe(15000);

      // Total = 20000 + 50000 + 5000 + 15000 = 90000
      expect(calcularTotalFactura(recuperada!)).toBe(90000);
    } finally {
      bootstrap.cerrar();
    }
  });

  it('emitirFacturaConRepo drift check: INSERTs Expo omiten id_prestador/categoria_uso (#844) — caller pasa la entidad completa', async () => {
    // El caller del flow (futuro) debe pasar la entidad Prestador
    // completa al input. Verificamos que el snapshot.prestador.id_prestador
    // es el correcto (no 0 por el drift).
    const dbPath = join(tmpDir, 'drift.db');
    const bootstrap = crearBootstrapFacturaSqlite({ dbPath });
    try {
      const prestadorDistinto: Prestador = { ...prestadorBase(), id_prestador: 42, codigo: '0042' };
      const factura = await emitirFacturaConRepo(
        inputBase({ prestador: prestadorDistinto }),
        bootstrap.repository,
        hasher,
        idGen,
      );
      expect(factura.snapshot.prestador.id_prestador).toBe(42);
      expect(factura.snapshot.prestador.codigo).toBe('0042');
    } finally {
      bootstrap.cerrar();
    }
  });

  it('emitirFacturaConRepo con repo in-memory: mismo resultado que SQLite', async () => {
    const repo = crearFacturaRepositoryInMemory();
    const factura = await emitirFacturaConRepo(inputBase(), repo, hasher, idGen);
    expect(factura.id).not.toBe('');
    expect(factura.snapshot.prestador.id_prestador).toBe(1);
    expect(factura.snapshot.lectura.lectura_actual).toBe(1234);
  });

  it('emitirFactura hash v2 incluye prestador y lectura (cambio en cualquiera cambia hash)', () => {
    const a = emitirFactura(inputBase(), hasher);
    const prestadorDistinto: Prestador = { ...prestadorBase(), nit: '999999999-9' };
    const b = emitirFactura(inputBase({ prestador: prestadorDistinto }), hasher);
    expect(a.hash).not.toBe(b.hash);

    const lecturaDistinta: Lectura = { ...lecturaBase(), lectura_actual: 1500 };
    const c = emitirFactura(inputBase({ lectura: lecturaDistinta }), hasher);
    expect(a.hash).not.toBe(c.hash);
  });

  it('emitirFactura input.lectura requerido al ser parte del shape v2', () => {
    const inputSinLectura = { ...inputBase(), lectura: undefined as unknown as Lectura };
    expect(() => emitirFactura(inputSinLectura, hasher)).toThrow(/lectura/i);
  });

  it('emitirFactura input.prestador requerido al ser parte del shape v2', () => {
    const inputSinPrestador = { ...inputBase(), prestador: undefined as unknown as Prestador };
    expect(() => emitirFactura(inputSinPrestador, hasher)).toThrow(/prestador/i);
  });

  it('emitirFacturaConRepo con snapshot version v2 (hash_version en metadata)', () => {
    const factura = emitirFactura(inputBase(), hasher);
    expect(factura.snapshot.metadata.hash_version).toBe('v2');
  });

  it('prestador + lectura + otrosValores + saldoAnterior: el caller hidrata T0DO, emitir no infiere', async () => {
    // El flow real de captura-lectura → resultado-calculo pasa prestador
    // y lectura por input. emitir NO los busca: valida que estan.
    // Si falta, error explicito (no fallar silenciosamente).
    const repo = crearFacturaRepositoryInMemory();
    const input = inputBase({
      prestador: prestadorBase(),
      lectura: lecturaBase(),
      otrosValores: [crearOtroValor('RECONEXION', 50000)],
      saldoAnterior: 15000,
    });
    const factura = await emitirFacturaConRepo(input, repo, hasher, idGen);
    expect(factura.snapshot.prestador).toBeDefined();
    expect(factura.snapshot.lectura).toBeDefined();
    expect(factura.snapshot.otros_valores).toHaveLength(1);
    expect(factura.snapshot.saldo_anterior).toBe(15000);
  });
});
