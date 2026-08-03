// mobile/__tests__/persistir-y-encolar-lectura.test.ts
//
// Test del adapter orquestador `persistirYEncolarLectura`.
//
// Este adapter vive en `mobile/src/adapters/` porque resuelve el gap del
// flujo capturar → sincronizar (Bug A): la pantalla de captura nunca
// llamaba a `lecturaRepo.guardar()` ni a `colaRepo.guardar()`. El
// adapter orquesta ambos pasos y deja un item `tipo: 'LECTURA'` listo
// para que el procesador de cola lo envíe al backend.
//
// Decisiones de diseño YA tomadas (ver memoria del proyecto):
//  - 1 solo item `LECTURA`, payload = la `Lectura` completa snake_case.
//  - NO se encolan `EVIDENCIA` ni `LIQUIDACION` aparte (la evidencia va
//    embebida en la lectura, la liquidación la deriva el backend).
//  - El `id_lectura` se asigna en `lecturaRepo.guardar()` y debe estar
//    presente en el payload encolado (para que el server lo correlacione).
//
// Corre con jest del root (ts-jest, env node). NO requiere expo-sqlite
// porque las repos son mocks.

import { persistirYEncolarLectura } from '../src/adapters/persistir-y-encolar-lectura';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';

function transaccionPassthrough() {
  return jest.fn(async (task: () => Promise<void>): Promise<void> => task());
}

describe('persistirYEncolarLectura', () => {
  it('persiste la lectura, encola un item LECTURA con el id asignado y devuelve ambos ids', async () => {
    // Arrange — lectura sin id_lectura (recién capturada en campo)
    const lecturaCapturada: Lectura = {
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 1015,
      lectura_anterior: 1000,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };

    // Lectura "post-persist": la repo le asigna id_lectura.
    const lecturaPersistida: Lectura = { ...lecturaCapturada, id_lectura: 42 };

    const lecturaRepo = {
      withTransactionAsync: transaccionPassthrough(),
      guardar: jest.fn(async (_l: Lectura) => lecturaPersistida),
    };
    const colaRepo = {
      guardar: jest.fn(async (_i: ItemCola) => undefined),
      listar: jest.fn(async () => [] as ItemCola[]),
    };
    const idGenerator = {
      uuid: jest.fn(() => 'item-uuid-1'),
    };
    const hasher = {
      sha256: jest.fn((_s: string) => 'hash-abc'),
    };

    // Act
    const resultado = await persistirYEncolarLectura({
      lectura: lecturaCapturada,
      lecturaRepo,
      colaRepo,
      idGenerator,
      hasher,
    });

    // Assert — persistencia
    expect(lecturaRepo.guardar).toHaveBeenCalledTimes(1);
    expect(lecturaRepo.guardar).toHaveBeenCalledWith(lecturaCapturada);

    // Assert — encolado: 1 sola llamada con el item armado correcto
    expect(colaRepo.guardar).toHaveBeenCalledTimes(1);
    const itemEncolado = colaRepo.guardar.mock.calls[0][0] as ItemCola;
    expect(itemEncolado.id).toBe('item-uuid-1');
    expect(itemEncolado.tipo).toBe('LECTURA');
    expect(itemEncolado.payload).toEqual(lecturaPersistida);
    expect(itemEncolado.hashLocal).toBe('hash-abc');
    expect(itemEncolado.estado).toBe('PENDIENTE');
    expect(itemEncolado.intentos).toBe(0);
    expect(itemEncolado.ultimoError).toBeNull();
    expect(itemEncolado.ultimoIntentoEn).toBeNull();
    expect(itemEncolado.creadoEn).toBeInstanceOf(Date);

    // Assert — el hasher se invocó sobre el JSON del payload persistido
    expect(hasher.sha256).toHaveBeenCalledWith(JSON.stringify(lecturaPersistida));

    // Assert — resultado devuelto
    expect(resultado).toEqual({
      idItemCola: 'item-uuid-1',
      lectura: lecturaPersistida,
    });
  });

  // --- D33+ Camino 3: dependeDe sobre items MEDIDOR pendientes ---
  //
  // Si el medidor referenciado por la lectura todavia tiene un item
  // MEDIDOR PENDIENTE/ENVIANDO en cola (alta reciente del medidor que
  // no termino de sincronizar), la lectura nueva debe declarar
  // `dependeDe = [idItemMedidor]` para que el procesador respete el
  // orden: primero el MEDIDOR (POST /api/v1/medidores), despues la
  // LECTURA (POST /api/v1/lecturas con FK ya resuelta en el server).
  //
  // Si NO hay item MEDIDOR pendiente (medidor ya sincronizado), la
  // lectura se encola SIN dependeDe.

  function lecturaBase(idMed: number): Lectura {
    return {
      id_medidor: idMed,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 1015,
      lectura_anterior: 1000,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };
  }

  function medidorEnPayload(idMed: number): Medidor {
    return {
      id_medidor: idMed,
      numero_medidor: `MED-${idMed}`,
      id_suscriptor: 100,
      fecha_instalacion: '2024-01-01',
      estado: 'activo',
      created_at: '2026-05-06T00:00:00.000Z',
    };
  }

  function itemMedPendiente(idItem: string, idMed: number): ItemCola {
    return {
      id: idItem,
      tipo: 'MEDIDOR',
      payload: medidorEnPayload(idMed),
      hashLocal: 'h',
      estado: 'PENDIENTE',
      intentos: 0,
      ultimoError: null,
      ultimoIntentoEn: null,
      creadoEn: new Date('2026-05-06T00:00:00.000Z'),
    };
  }

  it('encola_lectura_con_dependeDe_si_medidor_tiene_item_PENDIENTE_en_cola', async () => {
    const cap = lecturaBase(50);
    const persistida: Lectura = { ...cap, id_lectura: 99 };

    const lecturaRepo = {
      withTransactionAsync: transaccionPassthrough(),
      guardar: jest.fn(async () => persistida),
    };
    const colaRepo = {
      guardar: jest.fn(),
      // Hay un MEDIDOR PENDIENTE para id_medidor=50.
      listar: jest.fn(async () => [
        itemMedPendiente('item-med-pending', 50),
        // Y un MEDIDOR EXITOSO para otro id (no debe matchear).
        { ...itemMedPendiente('item-med-otro', 999), estado: 'EXITOSO' as const },
      ]),
    };
    const idGenerator = { uuid: jest.fn(() => 'item-lec-1') };
    const hasher = { sha256: jest.fn(() => 'hash-x') };

    await persistirYEncolarLectura({
      lectura: cap,
      lecturaRepo,
      colaRepo,
      idGenerator,
      hasher,
    });

    const item = colaRepo.guardar.mock.calls[0][0] as ItemCola;
    expect(item.dependeDe).toEqual(['item-med-pending']);
  });

  it('encola_lectura_sin_dependeDe_si_no_hay_item_MEDIDOR_pendiente', async () => {
    const cap = lecturaBase(60);
    const persistida: Lectura = { ...cap, id_lectura: 100 };

    const lecturaRepo = {
      withTransactionAsync: transaccionPassthrough(),
      guardar: jest.fn(async () => persistida),
    };
    const colaRepo = {
      guardar: jest.fn(),
      // El medidor 60 ya tiene item EXITOSO → no bloquea.
      listar: jest.fn(async () => [
        { ...itemMedPendiente('item-viejo', 60), estado: 'EXITOSO' as const },
      ]),
    };
    const idGenerator = { uuid: jest.fn(() => 'item-lec-2') };
    const hasher = { sha256: jest.fn(() => 'hash-y') };

    await persistirYEncolarLectura({
      lectura: cap,
      lecturaRepo,
      colaRepo,
      idGenerator,
      hasher,
    });

    const item = colaRepo.guardar.mock.calls[0][0] as ItemCola;
    expect(item.dependeDe).toBeUndefined();
  });

  it('T-TX-4 si encolar falla, SQLite revierte la lectura persistida', async () => {
    const lecturaCapturada = lecturaBase(70);
    const lecturaPersistida: Lectura = { ...lecturaCapturada, id_lectura: 101 };
    const lecturas: Lectura[] = [];
    const errorCola = new Error('cola write failed');

    const withTransactionAsync = jest.fn(async (task: () => Promise<void>): Promise<void> => {
      const snapshot = [...lecturas];
      try {
        await task();
      } catch (error) {
        lecturas.splice(0, lecturas.length, ...snapshot);
        throw error;
      }
    });
    const lecturaRepo = {
      withTransactionAsync,
      guardar: jest.fn(async () => {
        lecturas.push(lecturaPersistida);
        return lecturaPersistida;
      }),
    };
    const colaRepo = {
      listar: jest.fn(async () => [] as ItemCola[]),
      guardar: jest.fn().mockRejectedValue(errorCola),
    };

    await expect(
      persistirYEncolarLectura({
        lectura: lecturaCapturada,
        lecturaRepo,
        colaRepo,
        idGenerator: { uuid: () => 'item-lec-tx' },
        hasher: { sha256: () => 'hash-tx' },
      }),
    ).rejects.toBe(errorCola);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(lecturas).toEqual([]);
  });
});
