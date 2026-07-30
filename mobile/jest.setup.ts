/**
 * Jest setup — mocks globales para `expo-haptics` y `expo-image`.
 *
 * Por qué existen como setup global:
 *   - expo-haptics: API nativa no disponible en jest. Necesitamos espiar
 *     `selectionAsync` y `notificationAsync` para verificar la integración
 *     UX (haptics antes/después de navigate).
 *   - expo-image: SF Symbols via string source `"sf:..."` requieren un
 *     loader nativo. Mockeamos como `<Text testID="expo-image-source">`
 *     para que los tests puedan verificar el symbol renderizado.
 *
 * Wired via `module.exports` para que el test pueda `require('./jest.setup')`
 * o via `setupFiles` en `package.json` cuando se agregue.
 *
 * Referencias:
 *   - mobile/__tests__/pantallas/RutaDeHoy.test.tsx (T-NATIVE-3, T-NATIVE-4)
 *   - mobile/__tests__/pantallas/admin/ParametrosTarifa.test.tsx (mismo patron)
 */

// Mock expo-haptics: espiable, retorna Promise<void>.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
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