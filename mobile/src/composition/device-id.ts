/**
 * Helper `obtenerOCrearDeviceId()` — extraido a modulo compartido en el
 * fix del bug `bootstrapCompleto no vinculaba dispositivo al operario`
 * y para evitar duplicacion con la copia inline que vivia en
 * `Configuracion.tsx`.
 *
 * Comportamiento:
 *   1. Lee la clave `device_uuid` de AsyncStorage.
 *   2. Si existe una cadena no-vacia, la retorna (es la identidad estable
 *      del dispositivo actual entre cold starts).
 *   3. Si no existe, genera un UUID v4 nuevo, lo persiste y lo retorna.
 *
 * Persistencia:
 *   - Entre cold starts: SI (mismo dispositivo fisico).
 *   - Entre reinstalaciones de la app: NO (eso es el comportamiento
 *     esperado de AsyncStorage, que se borra cuando se desinstala).
 *
 * Generacion de UUID:
 *   Implementacion inline sin dependencias externas, suficiente para
 *   identidad de dispositivo (no es criptograficamente seguro pero es
 *   lo unico que necesitamos: el device_uuid es la mitad del contrato
 *   de vinculacion operador↔dispositivo, NO un token de auth).
 *
 *   Si en el futuro hace falta un UUID criptograficamente seguro,
 *   reemplazar el cuerpo de `generarUuid()` por una llamada a
 *   `crypto.randomUUID()` (disponible en RN 0.71+ via el polyfill
 *   que carga bootstrap.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Clave del slot AsyncStorage donde persiste el device_uuid. */
export const CLAVE_DEVICE_ID = 'device_uuid';

/**
 * Genera un UUID v4 simple sin dependencias externas.
 *
 * Formato: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 *   - caracter 13 en posicion de version: `4` (v4)
 *   - caracter 17 en posicion de variant: `[89ab]` (RFC 4122)
 */
export function generarUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retorna el `device_uuid` estable para este dispositivo.
 *
 * Si no existe en AsyncStorage (cold install, primer launch), genera uno
 * nuevo, lo persiste y lo retorna. Es la funcion que tanto `bootstrap-completo.ts`
 * (al crear el primer operario) como `Configuracion.tsx` (al cargar el
 * perfil) usan para identificar el dispositivo actual.
 *
 * Garantia de idempotencia: llamadas sucesivas dentro del mismo proceso
 * y entre cold starts retornan el mismo valor mientras la app no se
 * reinstale.
 */
export async function obtenerOCrearDeviceId(): Promise<string> {
  const existente = await AsyncStorage.getItem(CLAVE_DEVICE_ID);
  if (existente !== null && existente.length > 0) {
    return existente;
  }
  const nuevo = generarUuid();
  await AsyncStorage.setItem(CLAVE_DEVICE_ID, nuevo);
  return nuevo;
}
