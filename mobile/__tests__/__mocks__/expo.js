// Mock global de `expo` para jest SDK 54.
//
// El paquete `expo` carga `src/winter/runtime.native.ts` al importarse,
// que accede a `globalThis.__ExpoImportMetaRegistry`. En jest-expo SDK 54
// ese registry no esta configurado correctamente y rompe cualquier test
// que importe `react-native` (porque react-native termina requiriendo expo).
//
// Mockeando `expo` evitamos que se ejecute el runtime nativo y destrabamos
// los tests de componentes que solo necesitan RN virtual.
module.exports = {};