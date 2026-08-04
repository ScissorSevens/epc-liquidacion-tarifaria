/**
 * Mock oficial de AsyncStorage para tests Jest.
 *
 * Documentado en:
 * https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
 *
 * Wired automaticamente via `moduleNameMapper` en `package.json`:
 *   `"^@react-native-async-storage/async-storage$":
 *      "<rootDir>/__tests__/__mocks__/@react-native-async-storage/async-storage.js"`
 *
 * Provee una implementacion in-memory de `getItem`, `setItem`,
 * `removeItem`, `clear` con la misma firma de Promise.
 */

'use strict';

let store = {};

const mock = {
  setItem: jest.fn((key, value) => {
    store[key] = value;
    return Promise.resolve(undefined);
  }),
  getItem: jest.fn((key) => Promise.resolve(store[key] ?? null)),
  removeItem: jest.fn((key) => {
    delete store[key];
    return Promise.resolve(undefined);
  }),
  clear: jest.fn(() => {
    store = {};
    return Promise.resolve(undefined);
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
  multiGet: jest.fn((keys) =>
    Promise.resolve(keys.map((k: string) => [k, store[k] ?? null])),
  ),
  multiSet: jest.fn((pairs) => {
    for (const [k, v] of pairs) store[k] = v;
    return Promise.resolve(undefined);
  }),
  multiRemove: jest.fn((keys) => {
    for (const k of keys) delete store[k];
    return Promise.resolve(undefined);
  }),
};

module.exports = mock;
