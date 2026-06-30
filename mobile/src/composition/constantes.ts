/**
 * Constantes de composicion relacionadas con la sesion del operario.
 *
 * La sesion se persiste en AsyncStorage con la clave `clave_storage_sesion`.
 * AuthGate consulta esta clave para decidir si mostrar Login o el RootNavigator.
 * Login y MiPerfil escriben/borran este mismo slot al autenticar/cerrar sesion.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clave_storage_sesion = '@sistema_epc:sesion';

export interface Sesion {
  readonly cedula: string;
  readonly id_operario: string;
  readonly rol: string;
}

export async function cargarSesion(): Promise<Sesion | null> {
  const crudo = await AsyncStorage.getItem(clave_storage_sesion);
  if (crudo === null) return null;
  try {
    const parsed = JSON.parse(crudo) as Sesion;
    if (typeof parsed.cedula !== 'string' || typeof parsed.id_operario !== 'string' || typeof parsed.rol !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  await AsyncStorage.setItem(clave_storage_sesion, JSON.stringify(sesion));
}

export async function limpiarSesion(): Promise<void> {
  await AsyncStorage.removeItem(clave_storage_sesion);
}