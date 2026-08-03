// mobile/__tests__/integracion/capturar-lectura-flujo.test.ts
//
// Tests de integración del flujo capturar-lectura end-to-end.
//
// Usa funciones reales del dominio (registrarLectura, liquidarLectura) y el
// adapter real (persistirYEncolarLectura). Solo mockea las repos (lecturaRepo,
// colaRepo) — sin expo-sqlite, sin DB real.
//
// Escenarios cubiertos:
//   SC-INT-01: Happy path completo
//   SC-INT-02: RESTRICCION_UNICIDAD bloquea el flujo
//   SC-INT-03: Evidencia foto viaja en el payload
//   SC-INT-04: dependeDe cuando hay MEDIDOR PENDIENTE en cola

import { registrarLectura, liquidarLectura } from '@dominio/captura-lecturas/captura-lecturas';
import { persistirYEncolarLectura } from '../../src/adapters/persistir-y-encolar-lectura';
import type { Lectura, EntradaLectura } from '@dominio/captura-lecturas/types';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { ParametrosTarifa } from '@dominio/motor-tarifario/types';
import type { Suscriptor } from '@dominio/suscriptores/types';

// --- Helpers de mocks ---

const makeHasher = () => ({ sha256: jest.fn((_s: string) => 'hash-test') });
const makeIdGen = () => ({ uuid: jest.fn(() => 'item-uuid-test') });

const makeLecturaRepo = (persistida: Lectura) => ({
  withTransactionAsync: jest.fn(async (task: () => Promise<void>): Promise<void> => task()),
  guardar: jest.fn(async (_l: Lectura) => persistida),
});

const makeColaRepo = (existentes: ItemCola[] = []) => ({
  guardar: jest.fn(async (_item: ItemCola) => undefined),
  listar: jest.fn(async () => [...existentes]),
});

// --- Fixtures compartidas ---

// ParametrosTarifas con ASP negativo (agua < perdidas) → ccUnitario ≈ 2000
const PARAMS: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 0,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 30_000_000,
  cmo: 1500,
  cmi: 300,
  cmt: 200,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 100_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 30_000_000 / 3000,
  cargo_consumo_resultante: 1500 + 300 + 200,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01T00:00:00',
    anio_base: 2016,
    factor_indexacion_ipc: 1.0,
};

// Suscriptor multi-tenant mínimo — id_prestador = 0 (legacy) para matchear PARAMS
const SUSCRIPTOR_BASE: Suscriptor = {
  id_suscriptor: 1,
  codigo: 'S001',
  nombre_apellidos: 'Test',
  cedula: '123',
  municipio: 'Bog',
  direccion: 'Calle 1',
  estrato: 3,
  aplica_subsidio: false,
  estado: 'activo',
  created_at: '2026-01-01T00:00:00',
  id_prestador: 0,
  categoria_uso: 'residencial',
};

const CONTEXTO = { parametros: PARAMS, acuerdo: null };

const ENTRADA_BASE: EntradaLectura = {
  id_medidor: 7,
  id_operario: 1,
  id_periodo: '202605',
  lectura_anterior: 1000,
  lectura_actual: 1150,
};

const LECTURA_CAPTURADA = registrarLectura(ENTRADA_BASE);
const LECTURA_PERSISTIDA: Lectura = { ...LECTURA_CAPTURADA, id_lectura: 42 };

// --- Escenarios ---

describe('Flujo capturar-lectura (integracion)', () => {
  it('SC-INT-01: happy path — persiste, encola y consumo correcto', async () => {
    const lecturaRepo = makeLecturaRepo(LECTURA_PERSISTIDA);
    const colaRepo = makeColaRepo([]);

    const resultado = liquidarLectura(LECTURA_CAPTURADA, SUSCRIPTOR_BASE, CONTEXTO);

    await persistirYEncolarLectura({
      lectura: LECTURA_CAPTURADA,
      lecturaRepo,
      colaRepo,
      idGenerator: makeIdGen(),
      hasher: makeHasher(),
    });

    expect(resultado.consumo_m3).toBe(150);
    expect(lecturaRepo.guardar).toHaveBeenCalledTimes(1);
    expect(colaRepo.guardar).toHaveBeenCalledTimes(1);

    const item = colaRepo.guardar.mock.calls[0][0] as unknown as ItemCola;
    expect(item.tipo).toBe('LECTURA');
    expect(item.estado).toBe('PENDIENTE');
    expect(item.intentos).toBe(0);
    expect(item.payload).toEqual(LECTURA_PERSISTIDA);
  });

  it('SC-INT-02: RESTRICCION_UNICIDAD — rechaza y no encola', async () => {
    const err = Object.assign(new Error('ya existe'), {
      cause: { codigo: 'RESTRICCION_UNICIDAD' },
    });
    const lecturaRepo = {
      withTransactionAsync: jest.fn(async (task: () => Promise<void>): Promise<void> => task()),
      guardar: jest.fn(async () => { throw err; }),
    };
    const colaRepo = makeColaRepo([]);

    await expect(
      persistirYEncolarLectura({
        lectura: LECTURA_CAPTURADA,
        lecturaRepo,
        colaRepo,
        idGenerator: makeIdGen(),
        hasher: makeHasher(),
      }),
    ).rejects.toThrow('ya existe');

    expect(colaRepo.guardar).not.toHaveBeenCalled();
  });

  it('SC-INT-03: evidencia foto viaja en el payload', async () => {
    const entradaConFoto: EntradaLectura = {
      ...ENTRADA_BASE,
      evidencia: { foto_path: 'foto-7.jpg', foto_hash: 'a'.repeat(64) },
    };
    const lecturaConFoto = registrarLectura(entradaConFoto);
    const persistidaConFoto: Lectura = { ...lecturaConFoto, id_lectura: 43 };
    const lecturaRepo = makeLecturaRepo(persistidaConFoto);
    const colaRepo = makeColaRepo([]);

    await persistirYEncolarLectura({
      lectura: lecturaConFoto,
      lecturaRepo,
      colaRepo,
      idGenerator: makeIdGen(),
      hasher: makeHasher(),
    });

    const item = colaRepo.guardar.mock.calls[0][0] as unknown as ItemCola;
    expect((item.payload as Lectura).evidencia).toEqual({
      foto_path: 'foto-7.jpg',
      foto_hash: 'a'.repeat(64),
    });
  });

  it('SC-INT-04: dependeDe cuando hay MEDIDOR PENDIENTE para el mismo medidor', async () => {
    const itemMedPendiente: ItemCola = {
      id: 'item-med-pending',
      tipo: 'MEDIDOR',
      payload: {
        id_medidor: 7,
        numero_medidor: 'MED-7',
        id_suscriptor: 1,
        fecha_instalacion: '2024-01-01',
        estado: 'activo',
        created_at: '',
      },
      hashLocal: 'h',
      estado: 'PENDIENTE',
      intentos: 0,
      ultimoError: null,
      ultimoIntentoEn: null,
      creadoEn: new Date(),
    };
    const lecturaRepo = makeLecturaRepo(LECTURA_PERSISTIDA);
    const colaRepo = makeColaRepo([itemMedPendiente]);

    await persistirYEncolarLectura({
      lectura: LECTURA_CAPTURADA,
      lecturaRepo,
      colaRepo,
      idGenerator: makeIdGen(),
      hasher: makeHasher(),
    });

    const item = colaRepo.guardar.mock.calls[0][0] as unknown as ItemCola;
    expect(item.dependeDe).toEqual(['item-med-pending']);
  });
});
