// jest.setup.ts (root)
//
// Setup files ejecutados ANTES de cada test en el root jest.config.
// Compensan globals que Metro (RN/Expo) inyecta en runtime pero que no
// existen cuando el root corre con testEnvironment: 'node':
//
//   __DEV__ → booleano que el código de mobile/ lee en module-top-level
//             (ej: mobile/src/composicion/logger.ts: `const ENABLED = __DEV__`).
//             Sin este global, los tests del root que importan código de
//             mobile/ (vía composition, persistencia, etc.) revientan con
//             `ReferenceError: __DEV__ is not defined`.

(globalThis as { __DEV__?: boolean }).__DEV__ = false;