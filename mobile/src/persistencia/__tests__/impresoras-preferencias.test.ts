/**
 * Tests del wrapper AsyncStorage para preferencias de impresora.
 *
 * Cubre `impresora-perfil-preferences` REQ 1-5:
 *  - KEY constante literal `impresion.preferencias.v1`.
 *  - `obtenerUltimaImpresora`: vacio (null), valido, version
 *    futura (null + warn), shape corrupto (null), JSON invalido (null).
 *  - `guardarUltimaImpresora`: persiste JSON correcto, rechaza si
 *    anchoPapel invalido, preserva papel_default existente.
 *  - `invalidarPreferencias`: limpia la key, idempotente.
 *  - `obtenerPapelDefault`: 58mm default, 80mm persistido.
 *  - `guardarPapelDefault`: persiste sin tocar ultima_impresora,
 *    rechaza anchos invalidos.
 *
 * RED phase: la implementacion real (commit 10) reemplaza el stub.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  KEY_PREFERENCIAS_IMPRESION,
  obtenerUltimaImpresora,
  guardarUltimaImpresora,
  invalidarPreferencias,
  obtenerPapelDefault,
  guardarPapelDefault,
} from '../../src/persistencia/impresoras-preferencias';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('KEY_PREFERENCIAS_IMPRESION', () => {
  it('es exactamente "impresion.preferencias.v1"', () => {
    expect(KEY_PREFERENCIAS_IMPRESION).toBe('impresion.preferencias.v1');
  });
});

describe('obtenerUltimaImpresora', () => {
  it('retorna null si AsyncStorage vacio', async () => {
    const result = await obtenerUltimaImpresora();
    expect(result).toBeNull();
  });

  it('retorna la preferencia valida si existe', async () => {
    const blob = {
      version: 1,
      ultima_impresora: {
        id: 'X',
        nombre: 'EPSON T58',
        transporte: 'BLE',
        direccion: 'AA:BB:CC:DD:EE:FF',
        anchoPapel: '58mm',
      },
      papel_default: '58mm',
    };
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify(blob),
    );
    const result = await obtenerUltimaImpresora();
    expect(result).toEqual({
      id: 'X',
      nombre: 'EPSON T58',
      transporte: 'BLE',
      direccion: 'AA:BB:CC:DD:EE:FF',
      anchoPapel: '58mm',
    });
  });

  it('retorna null si version es 2 (futura)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({ version: 2, ultima_impresora: null, papel_default: '58mm' }),
    );
    const result = await obtenerUltimaImpresora();
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('retorna null si shape corrupto (falta ultima_impresora)', async () => {
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({ version: 1, papel_default: '58mm' }),
    );
    const result = await obtenerUltimaImpresora();
    expect(result).toBeNull();
  });

  it('retorna null si JSON invalido', async () => {
    await AsyncStorage.setItem(KEY_PREFERENCIAS_IMPRESION, 'not json{');
    const result = await obtenerUltimaImpresora();
    expect(result).toBeNull();
  });
});

describe('guardarUltimaImpresora', () => {
  it('persiste el JSON correcto', async () => {
    await guardarUltimaImpresora({
      id: 'X',
      nombre: 'EPSON T58',
      transporte: 'BLE',
      direccion: 'AA:BB:CC:DD:EE:FF',
      anchoPapel: '58mm',
    });
    const raw = await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.ultima_impresora.id).toBe('X');
    expect(parsed.ultima_impresora.nombre).toBe('EPSON T58');
    expect(parsed.ultima_impresora.transporte).toBe('BLE');
    expect(parsed.ultima_impresora.direccion).toBe('AA:BB:CC:DD:EE:FF');
    expect(parsed.ultima_impresora.anchoPapel).toBe('58mm');
  });

  it('rechaza con Error("AnchoPapel invalido") si anchoPapel no es 58mm/80mm', async () => {
    await expect(
      guardarUltimaImpresora({
        id: 'X',
        nombre: 'X',
        transporte: 'BLE',
        direccion: 'AA:BB',
        anchoPapel: '12cm' as '58mm',
      }),
    ).rejects.toThrow(/AnchoPapel invalido/);
    const raw = await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION);
    expect(raw).toBeNull();
  });

  it('preserva papel_default existente al guardar', async () => {
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({ version: 1, ultima_impresora: null, papel_default: '80mm' }),
    );
    await guardarUltimaImpresora({
      id: 'X',
      nombre: 'X',
      transporte: 'BLE',
      direccion: 'AA:BB',
      anchoPapel: '58mm',
    });
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION))!,
    );
    expect(parsed.papel_default).toBe('80mm');
    expect(parsed.ultima_impresora.id).toBe('X');
  });
});

describe('invalidarPreferencias', () => {
  it('limpia la key', async () => {
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({ version: 1, ultima_impresora: null, papel_default: '58mm' }),
    );
    await invalidarPreferencias();
    const raw = await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION);
    expect(raw).toBeNull();
  });

  it('no falla si key no existe', async () => {
    await expect(invalidarPreferencias()).resolves.toBeUndefined();
  });
});

describe('obtenerPapelDefault', () => {
  it('retorna 58mm si no hay preferencia', async () => {
    expect(await obtenerPapelDefault()).toBe('58mm');
  });

  it('retorna 80mm si esta persistido', async () => {
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({ version: 1, ultima_impresora: null, papel_default: '80mm' }),
    );
    expect(await obtenerPapelDefault()).toBe('80mm');
  });
});

describe('guardarPapelDefault', () => {
  it('persiste sin tocar ultima_impresora', async () => {
    await AsyncStorage.setItem(
      KEY_PREFERENCIAS_IMPRESION,
      JSON.stringify({
        version: 1,
        ultima_impresora: {
          id: 'PRE',
          nombre: 'EPSON',
          transporte: 'BLE',
          direccion: 'AA',
          anchoPapel: '58mm',
        },
        papel_default: '58mm',
      }),
    );
    await guardarPapelDefault('80mm');
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(KEY_PREFERENCIAS_IMPRESION))!,
    );
    expect(parsed.papel_default).toBe('80mm');
    expect(parsed.ultima_impresora.id).toBe('PRE');
  });

  it('rechaza con Error si ancho invalido', async () => {
    await expect(guardarPapelDefault('12cm' as '58mm')).rejects.toThrow(
      /AnchoPapel invalido/,
    );
  });
});
