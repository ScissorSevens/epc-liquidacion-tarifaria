/**
 * Jest setup — mocks globales para `expo-haptics`, `expo-image` y las
 * dos libs Bluetooth (`react-native-ble-plx`,
 * `react-native-bluetooth-escpos-printer`).
 *
 * Por qué existen como setup global:
 *   - expo-haptics: API nativa no disponible en jest. Necesitamos espiar
 *     `selectionAsync` y `notificationAsync` para verificar la integración
 *     UX (haptics antes/después de navigate).
 *   - expo-image: SF Symbols via string source `"sf:..."` requieren un
 *     loader nativo. Mockeamos como `<Text testID="expo-image-source">`
 *     para que los tests puedan verificar el symbol renderizado.
 *   - Bluetooth libs: APIs nativas no disponibles en jest. Stubs no-op
 *     para que `require('react-native-ble-plx')` y
 *     `require('react-native-bluetooth-escpos-printer')` resuelvan sin
 *     crashear; los adapters pueden instanciarse y los tests verifican
 *     el contrato del port sin device físico.
 *
 * Wired via `module.exports` para que el test pueda `require('./jest.setup')`
 * o via `setupFiles` en `package.json` cuando se agregue.
 *
 * Referencias:
 *   - mobile/__tests__/pantallas/RutaDeHoy.test.tsx (T-NATIVE-3, T-NATIVE-4)
 *   - mobile/__tests__/pantallas/admin/ParametrosTarifa.test.tsx (mismo patron)
 *   - mobile/src/adapters/impresion/* (commit 10 de
 *     factura-preview-print-bluetooth)
 */

// Mock expo-haptics: espiable, retorna Promise<void>.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock expo-image: el componente Image acepta un string `source="sf:..."`
// (SF Symbol) y lo renderea como <Text testID="expo-image-source">.
// Evita el import del native asset loader de expo-image.
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const MockImage = function MockImage(props: {
    source: unknown;
    style?: unknown;
    tintColor?: string;
    accessibilityLabel?: string;
  }) {
    const sourceStr = typeof props.source === 'string'
      ? props.source
      : (props.source as { uri?: string })?.uri ?? '';
    return React.createElement(
      Text,
      {
        testID: 'expo-image-source',
        style: props.style,
        accessibilityHint: props.tintColor !== undefined
          ? `tint:${props.tintColor}`
          : undefined,
        accessibilityLabel: props.accessibilityLabel,
      },
      sourceStr,
    );
  };
  return { Image: MockImage };
});

// Mock react-native-ble-plx: stub BleManager con metodos no-op que
// resuelven promises vacios. Asi el adapter puede instanciarse en
// jest sin device físico.
jest.mock('react-native-ble-plx', () => ({
  BleManager: class {
    startDeviceScan() {
      /* noop */
    }
    stopDeviceScan() {
      /* noop */
    }
    requestConnection() {
      return Promise.resolve({});
    }
    discoverAllServicesAndCharacteristics() {
      return Promise.resolve({});
    }
    writeCharacteristicWithResponse() {
      return Promise.resolve({});
    }
    destroy() {
      /* noop */
    }
  },
}));

// Mock react-native-bluetooth-escpos-printer: stub BluetoothManager
// y BluetoothEscposPrinter con jest.fn() espiables. Cubre las
// funciones que los adapters consumen.
jest.mock('react-native-bluetooth-escpos-printer', () => ({
  BluetoothManager: {
    enableBluetooth: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scanDevices: jest.fn().mockResolvedValue([]),
  },
  BluetoothEscposPrinter: {
    printerInit: jest.fn().mockResolvedValue(undefined),
    printText: jest.fn().mockResolvedValue(undefined),
    printColumn: jest.fn().mockResolvedValue(undefined),
  },
}));