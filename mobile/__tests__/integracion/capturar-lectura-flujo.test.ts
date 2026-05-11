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

// --- Helpers de mocks ---

const makeHasher = () => ({ sha256: jest.fn((_s: string) => 'hash-test') });
const makeIdGen = () => ({ uuid: jest.fn(() => 'item-uuid-test') });

const makeLecturaRepo = (persistida: Lectura) => ({
  guardar: jest.fn(async (_l: Lectura) => persistida),
});

const makeColaRepo = (existentes: ItemCola[] = []) => ({
  guardar: jest.fn(async (_item: ItemCola) => undefined),
  listar: jest.fn(async () => [...existentes]),
});

// --- Fixtures compartidas ---

const PARAMS: ParametrosTarifa = {
  cargoFijo: 5000,
  precioM3: 1200,
  precioM3Excedente: 2400,
  consumoBasico: 20,
};

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

    const resultado = liquidarLectura(LECTURA_CAPTURADA, PARAMS, 3);

    await persistirYEncolarLectura({
      lectura: LECTURA_CAPTURADA,
      lecturaRepo,
      colaRepo,
      idGenerator: makeIdGen(),
      hasher: makeHasher(),
    });

    expect(resultado.consumo).toBe(150);
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
    const lecturaRepo = { guardar: jest.fn(async () => { throw err; }) };
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
