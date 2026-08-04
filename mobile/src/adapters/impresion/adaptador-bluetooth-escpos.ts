/**
 * Implementacion de `ImpresoraTermica` sobre
 * `react-native-bluetooth-escpos-printer`. Cubre Classic SPP (muchas
 * termicas economicas usan el perfil SPP via UUID
 * `00001101-0000-1000-8000-00805F9B34FB`).
 *
 * Lazy require: si la lib no esta disponible al instanciar el
 * adapter, `estado() === 'error'` y los metodos rechazan.
 *
 * Capacidades SPP (mas rica que BLE generica):
 *   - soportaCorte: true
 *   - soportaCodigoBarras: true
 *   - soportaDobleAncho: true
 *   - anchoMaximo: 42 chars (80mm)
 *   - codePage: PC850
 */

import type {
  CapacidadImpresora,
  EstadoImpresora,
  Impresora,
  ImpresoraTermica,
  TransporteImpresora,
} from '@dominio/impresion';
import { ExcepcionImpresora } from '@dominio/impresion';

interface BluetoothEscposLib {
  BluetoothManager: {
    enableBluetooth: () => Promise<void>;
    connect: (mac: string) => Promise<unknown>;
    disconnect: () => Promise<void>;
    scanDevices: () => Promise<readonly { name: string; address: string }[]>;
  };
  BluetoothEscposPrinter: {
    printerInit: () => Promise<void>;
    printText: (text: string, opts: unknown) => Promise<void>;
  };
}

function tryRequireBluetoothEscpos(): BluetoothEscposLib | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-bluetooth-escpos-printer') as BluetoothEscposLib;
  } catch {
    return null;
  }
}

export class AdaptadorBluetoothEscpos implements ImpresoraTermica {
  readonly id = 'bluetooth-escpos';
  readonly transporte: TransporteImpresora = 'SPP';

  private _estado: EstadoImpresora = 'desconocido';
  private _lib: BluetoothEscposLib | null = null;

  constructor() {
    const lib = tryRequireBluetoothEscpos();
    if (!lib) {
      this._estado = 'error';
      return;
    }
    try {
      this._lib = lib;
      this._estado = 'lista';
    } catch {
      this._estado = 'error';
    }
  }

  estado(): EstadoImpresora {
    return this._estado;
  }

  async escanear(timeoutMs: number): Promise<readonly Impresora[]> {
    if (!this._lib) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: '',
        mensaje: 'Adaptador Bluetooth SPP no disponible',
      });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), timeoutMs);
      this._lib!.BluetoothManager.scanDevices()
        .then((devices) => {
          clearTimeout(timer);
          resolve(
            devices.map((d) => ({
              id: d.address,
              nombre: d.name || d.address,
              transporte: 'SPP' as const,
              direccion: d.address,
              anchoPapel: '80mm' as const,
              estado: 'disponible' as const,
            })),
          );
        })
        .catch(() => {
          clearTimeout(timer);
          resolve([]);
        });
    });
  }

  async emparejar(impresora: Impresora): Promise<void> {
    if (!this._lib) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: impresora.direccion,
        mensaje: 'Adaptador Bluetooth SPP no disponible',
      });
    }
    // SPP pairing es automatico via connect; no hay paso explicito.
    return Promise.resolve();
  }

  async conectar(direccion: string): Promise<void> {
    if (!this._lib) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion,
        mensaje: 'Adaptador Bluetooth SPP no disponible',
      });
    }
    this._estado = 'conectando';
    try {
      await this._lib.BluetoothManager.connect(direccion);
      this._estado = 'conectada';
    } catch (err) {
      this._estado = 'error';
      throw new ExcepcionImpresora({
        codigo: 'CONEXION_FALLIDA',
        direccion,
        mensaje: 'No se pudo conectar por SPP',
        cause: err,
      });
    }
  }

  async imprimir(payload: readonly string[]): Promise<void> {
    if (!this._lib) {
      throw new ExcepcionImpresora({
        codigo: 'NO_ENCONTRADA',
        direccion: '',
        mensaje: 'Adaptador Bluetooth SPP no disponible',
      });
    }
    await this._lib.BluetoothEscposPrinter.printerInit();
    for (const linea of payload) {
      await this._lib.BluetoothEscposPrinter.printText(linea + '\n', {});
    }
  }

  async obtenerCapacidades(): Promise<CapacidadImpresora> {
    return {
      soportaCorte: true,
      soportaCodigoBarras: true,
      soportaDobleAncho: true,
      anchoMaximo: 42,
      codePage: 'PC850',
    };
  }

  async desconectar(): Promise<void> {
    if (!this._lib) return;
    await this._lib.BluetoothManager.disconnect();
    this._estado = 'lista';
  }
}
