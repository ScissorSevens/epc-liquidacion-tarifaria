jest.mock('react-native-ble-plx', () => {
  const manager = {
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    requestConnection: jest.fn().mockResolvedValue({}),
    connectToDevice: jest.fn().mockResolvedValue({}),
    writeCharacteristicWithResponseForDevice: jest.fn().mockResolvedValue({}),
    destroy: jest.fn(),
  };
  return {
    BleManager: jest.fn(() => manager),
    __mockManager: manager,
  };
}, { virtual: true });

import { AdaptadorBlePlx } from '../adaptador-ble-plx';

const bleModule = require('react-native-ble-plx') as {
  __mockManager: {
    writeCharacteristicWithResponseForDevice: jest.Mock;
  };
};


describe('AdaptadorBlePlx.imprimir', () => {
  beforeEach(() => {
    bleModule.__mockManager.writeCharacteristicWithResponseForDevice.mockClear();
    bleModule.__mockManager.writeCharacteristicWithResponseForDevice.mockResolvedValue({});
  });

  it('escribe cada chunk con device, service, characteristic y payload base64', async () => {
    const adapter = new AdaptadorBlePlx({
      deviceId: 'AA:BB',
      serviceUUID: 'service-uuid',
      characteristicUUID: 'characteristic-uuid',
    });

    await adapter.imprimir(['x'.repeat(45)]);

    const calls = bleModule.__mockManager.writeCharacteristicWithResponseForDevice.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([
      'AA:BB',
      'service-uuid',
      'characteristic-uuid',
      expect.any(String),
    ]);
    expect(Buffer.from(calls[0][3], 'base64').byteLength).toBe(20);
    expect(Buffer.from(calls[1][3], 'base64').byteLength).toBe(20);
    expect(Buffer.from(calls[2][3], 'base64').byteLength).toBe(5);
  });

  it('envuelve errores de escritura como ErrorImpresion tipado', async () => {
    bleModule.__mockManager.writeCharacteristicWithResponseForDevice.mockRejectedValueOnce(
      new Error('GATT write failed'),
    );
    const adapter = new AdaptadorBlePlx({
      deviceId: 'AA:BB',
      serviceUUID: 'service-uuid',
      characteristicUUID: 'characteristic-uuid',
    });

    await expect(adapter.imprimir(['ticket'])).rejects.toMatchObject({
      codigo: 'IMPRESION_FALLIDA',
    });
  });
});
