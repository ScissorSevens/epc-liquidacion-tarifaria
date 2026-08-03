// mobile/__tests__/composicion/device-id.test.ts
//
// Tests contractuales del helper `obtenerOCrearDeviceId()` introducido al
// extraer el helper inline que vivia en `Configuracion.tsx` y al fix del
// bug del bootstrap donde el primer operario quedaba sin `dispositivo_id`.
//
// QUE HACE:
//   Lee una clave 'device_uuid' de AsyncStorage; si existe la retorna, si
//   no genera un UUID v4 nuevo y lo persiste. Persiste entre cold starts
//   del dispositivo pero NO entre reinstalaciones de la app (eso es el
//   comportamiento esperado de AsyncStorage en RN).
//
// COMPORTAMIENTO BAJO PRUEBA:
//   - Primera llamada: genera un UUID, lo guarda, lo retorna.
//   - Segunda llamada (sin reinstalacion): retorna el MISMO UUID.
//   - UUID generado tiene formato `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
//   - La operacion de lectura NO debe escribir si el valor ya existe
//     (verificamos que setItem se llame solo cuando hace falta).
//
// MOCKS:
//   - AsyncStorage mockeado a nivel modulo (mismo patron que el resto
//     de la suite `composicion/*.test.ts`).

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  obtenerOCrearDeviceId,
  generarUuid,
  CLAVE_DEVICE_ID,
} from '../../src/composition/device-id';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

describe('device-id.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Tests del helper exportarUuid (T-DEV-5) ──────────────────────────────
  describe('generarUuid', () => {
    it('T-DEV-5 produce un string con formato UUID v4 8-4-4-4-12', () => {
      const id = generarUuid();

      // Formato v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      //   - version 4 en el caracter 13 (pos 14 contando el guion)
      //   - variant 8/9/a/b en el caracter 17 (pos 19 contando guion)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('T-DEV-5b generarUuid() genera UUIDs distintos en llamadas sucesivas', () => {
      // No es un test determinista al 100% (colision por azar es ~0),
      // pero verifica que NO retornamos un hardcodeado. Dos llamadas
      // producen dos valores distintos en la practica con 36^36 espacios.
      const a = generarUuid();
      const b = generarUuid();

      expect(a).not.toBe(b);
    });
  });

  // ── Tests de obtenerOCrearDeviceId (T-DEV-1, T-DEV-2) ────────────────────
  describe('obtenerOCrearDeviceId', () => {
    it('T-DEV-1 la primera vez genera un UUID, lo guarda en AsyncStorage y lo retorna', async () => {
      mockedGetItem.mockResolvedValueOnce(null);

      const id = await obtenerOCrearDeviceId();

      // Lectura apuntando a la clave correcta.
      expect(mockedGetItem).toHaveBeenCalledWith(CLAVE_DEVICE_ID);
      expect(mockedGetItem).toHaveBeenCalledTimes(1);

      // Escritura con el mismo valor que se devolvio.
      expect(mockedSetItem).toHaveBeenCalledTimes(1);
      expect(mockedSetItem).toHaveBeenCalledWith(CLAVE_DEVICE_ID, id);

      // El id retornado cumple el formato v4 (el setter recibio el mismo).
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('T-DEV-2 la segunda vez retorna el mismo UUID que ya estaba guardado (no sobreescribe)', async () => {
      const idPreexistente = '11111111-2222-4333-8444-555555555555';
      mockedGetItem.mockResolvedValueOnce(idPreexistente);

      const id = await obtenerOCrearDeviceId();

      // Devolvemos el valor preexistente (no generamos uno nuevo).
      expect(id).toBe(idPreexistente);

      // NO escribimos en AsyncStorage porque el valor ya existia.
      // Esta es la garantia clave de persistencia entre cold starts.
      expect(mockedSetItem).not.toHaveBeenCalled();
    });

    it('T-DEV-2b llamadas consecutivas dentro del mismo proceso devuelven el mismo id una vez que se persiste', async () => {
      // Simulamos el ciclo de vida real: primera llamada escribe,
      // las siguientes lecturas reciben el mismo valor del storage.
      let storage: string | null = null;
      mockedGetItem.mockImplementation(async () => storage);
      mockedSetItem.mockImplementation(async (_clave: string, valor: string) => {
        storage = valor;
      });

      const primera = await obtenerOCrearDeviceId();
      const segunda = await obtenerOCrearDeviceId();
      const tercera = await obtenerOCrearDeviceId();

      expect(primera).toBe(segunda);
      expect(segunda).toBe(tercera);

      // SetItem se llamo SOLO una vez (en la primera invocacion).
      expect(mockedSetItem).toHaveBeenCalledTimes(1);
      // GetItem se llamo 3 veces (todas las invocaciones leen primero).
      expect(mockedGetItem).toHaveBeenCalledTimes(3);
    });
  });

  // ── Constante de clave ─────────────────────────────────────────────────
  describe('CLAVE_DEVICE_ID', () => {
    it('es un string estable apuntando al slot AsyncStorage del device_uuid', () => {
      // El 'device_uuid' es el contrato entre bootstrap (escritura) y
      // Configuracion (lectura). Si cambia, hay que migrar datos en
      // AsyncStorage de los usuarios ya instalados.
      expect(typeof CLAVE_DEVICE_ID).toBe('string');
      expect(CLAVE_DEVICE_ID.length).toBeGreaterThan(0);
      expect(CLAVE_DEVICE_ID).toBe('device_uuid');
    });
  });
});
