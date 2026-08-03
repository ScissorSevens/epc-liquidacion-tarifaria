/**
 * Implementacion de `ImpresoraTermica` sobre `react-native-ble-plx`.
 *
 * Lazy require: el adapter intenta cargar la lib al instanciarse.
 * Si la lib no esta disponible (no instalada, development build sin
 * link), `estado() === 'error'` y todos los metodos rechazan con
 * `ExcepcionImpresora({ codigo: 'NO_ENCONTRADA' })` o similar.
 *
 * Capacidades BLE genericas (la mayoria de las termicas BLE
 * economicas solo soportan texto + LF):
 *   - soportaCorte: false
 *   - soportaCodigoBarras: false
 *   - soportaDobleAncho: true (algunos modelos via GS !)
 *   - anchoMaximo: 32 chars
 *   - codePage: PC437
 *
 * MTU tipico BLE = 20 bytes. `imprimir()` chunkea el payload en
 * chunks de <=20 bytes via `writeCharacteristicWithResponse`.
 */

import type {
  CapacidadImpresora,
  EstadoImpresora,
  Impresora,
  ImpresoraTermica,
  TransporteImpresora,
} from '@dominio/impresion';
import { ExcepcionImpresora } from '@dominio/impresion';

const MTU_BYTES = 20;
export const UUID_SERVICIO_IMPRESION_BLE = '0000FFE0-0000-1000-8000-00805F9B34FB';
export const UUID_CARACTERISTICA_IMPRESION_BLE = '0000FFE1-0000-1000-8000-00805F9B34FB';

function bytesUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
  const encoded = unescape(encodeURIComponent(value));
  const result = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) result[i] = encoded.charCodeAt(i);
  return result;
}

function base64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    result += alphabet[(n >> 18) & 63];
    result += alphabet[(n >> 12) & 63];
    result += i + 1 < bytes.length ? alphabet[(n >> 6) & 63] : '=';
    result += i + 2 < bytes.length ? alphabet[n & 63] : '=';
  }
  return result;
}

interface BleManagerMock {
  // shape minimal del BleManager que el adapter consume
  startDeviceScan: (
    serviceUUIDs: string[] | null,
    options: Record<string, unknown>,
    callback: (error: Error | null, device: unknown) => void,
  ) => void;
  stopDeviceScan: () => void;
  requestConnection?: (
    deviceId: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
  connectToDevice?: (
    deviceId: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  writeCharacteristicWithResponseForDevice?: (
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
    transactionId?: string,
  ) => Promise<unknown>;
  destroy: () => void;
}

export interface OpcionesAdaptadorBlePlx {
  readonly deviceId?: string;
  readonly serviceUUID?: string;
  readonly characteristicUUID?: string;
  readonly manager?: BleManagerMock;
}

interface BlePlxLib {
  BleManager: new () => BleManagerMock;
}

function tryRequireBlePlx(): BlePlxLib | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-ble-plx') as BlePlxLib;
  } catch {
    return null;
  }
}

export class AdaptadorBlePlx implements ImpresoraTermica {
  readonly id = 'ble-plx';
  readonly transporte: TransporteImpresora = 'BLE';

  private _estado: EstadoImpresora = 'desconocido';
  private _manager: BleManagerMock | null = null;
  private _deviceId: string | null = null;
  private readonly _serviceUUID: string;
  private readonly _characteristicUUID: string;

  constructor(options: OpcionesAdaptadorBlePlx | string = {}) {
    const normalized: OpcionesAdaptadorBlePlx =
      typeof options === 'string' ? { deviceId: options } : options;
    this._deviceId = normalized.deviceId ?? null;
    this._serviceUUID = normalized.serviceUUID ?? UUID_SERVICIO_IMPRESION_BLE;
    this._characteristicUUID =
      normalized.characteristicUUID ?? UUID_CARACTERISTICA_IMPRESION_BLE;
    if (normalized.manager !== undefined) {
      this._manager = normalized.manager;
      this._estado = 'lista';
      return;
    }
    const lib = tryRequireBlePlx();
    if (!lib) {
      this._estado = 'error';
      return;
    }
    try {
      this._manager = new lib.BleManager();
      this._estado = 'lista';
    } catch {
      this._estado = 'error';
    }
  }

  estado(): EstadoImpresora {
    return this._estado;
  }

  async escanear(timeoutMs: number): Promise<readonly Impresora[]> {
    if (!this._manager) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: '',
        mensaje: 'Adaptador BLE no disponible',
      });
    }
    return new Promise((resolve) => {
      const encontrados: Impresora[] = [];
      const timer = setTimeout(() => {
        this._manager?.stopDeviceScan();
        resolve(encontrados);
      }, timeoutMs);
      this._manager!.startDeviceScan(
        null,
        {},
        (_error: Error | null, device: unknown) => {
          if (!device) return;
          const d = device as { id: string; name?: string; rssi?: number };
          encontrados.push({
            id: d.id,
            nombre: d.name ?? d.id,
            transporte: 'BLE',
            direccion: d.id,
            anchoPapel: '58mm',
            rssi: d.rssi,
            estado: 'disponible',
          });
        },
      );
      void timer;
    });
  }

  async emparejar(impresora: Impresora): Promise<void> {
    if (!this._manager) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: impresora.direccion,
        mensaje: 'Adaptador BLE no disponible',
      });
    }
    this._deviceId = impresora.direccion;
    // BLE pairing es automatico al conectar; no hay emparejamiento
    // explicito previo.
    return Promise.resolve();
  }

  async conectar(direccion: string): Promise<void> {
    if (!this._manager) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion,
        mensaje: 'Adaptador BLE no disponible',
      });
    }
    this._estado = 'conectando';
    try {
      this._deviceId = direccion;
      if (this._manager.connectToDevice !== undefined) {
        const device = await this._manager.connectToDevice(direccion, {
          autoConnect: false,
        });
        const discover = (
          device as { discoverAllServicesAndCharacteristics?: () => Promise<unknown> }
        ).discoverAllServicesAndCharacteristics;
        if (discover !== undefined) await discover.call(device);
      } else if (this._manager.requestConnection !== undefined) {
        await this._manager.requestConnection(direccion, { autoConnect: false });
      } else {
        throw new Error('BleManager no expone una operación de conexión');
      }
      this._estado = 'conectada';
    } catch (err) {
      this._estado = 'error';
      throw new ExcepcionImpresora({
        codigo: 'CONEXION_FALLIDA',
        direccion,
        mensaje: 'No se pudo conectar por BLE',
        cause: err,
      });
    }
  }

  async imprimir(payload: readonly string[]): Promise<void> {
    if (!this._manager) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: this._deviceId ?? '',
        mensaje: 'Adaptador BLE no disponible',
      });
    }
    const writer = this._manager.writeCharacteristicWithResponseForDevice;
    if (writer === undefined) {
      throw new ExcepcionImpresora({
        codigo: 'IMPRESION_FALLIDA',
        direccion: this._deviceId ?? '',
        mensaje: 'El adaptador BLE no soporta escritura de características',
      });
    }

    const deviceId = this._deviceId ?? this.id;
    const bytes = bytesUtf8(payload.join('\n'));
    try {
      for (let i = 0; i < bytes.length; i += MTU_BYTES) {
        const chunk = bytes.slice(i, i + MTU_BYTES);
        await writer.call(
          this._manager,
          deviceId,
          this._serviceUUID,
          this._characteristicUUID,
          base64(chunk),
        );
      }
    } catch (err) {
      this._estado = 'error';
      throw new ExcepcionImpresora({
        codigo: 'IMPRESION_FALLIDA',
        direccion: deviceId,
        mensaje: 'No se pudo escribir el tiquete por BLE',
        cause: err,
      });
    }
  }

  async obtenerCapacidades(): Promise<CapacidadImpresora> {
    return {
      soportaCorte: false,
      soportaCodigoBarras: false,
      soportaDobleAncho: true,
      anchoMaximo: 32,
      codePage: 'PC437',
    };
  }

  async desconectar(): Promise<void> {
    if (!this._manager) return;
    this._manager.destroy();
    this._manager = null;
    this._estado = 'lista';
  }
}
