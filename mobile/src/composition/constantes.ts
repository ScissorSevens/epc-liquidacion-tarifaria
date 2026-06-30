/**
 * Constantes de composicion relacionadas con la sesion del operario.
 *
 * La sesion se persiste en AsyncStorage con la clave `clave_storage_sesion`.
 * AuthGate consulta esta clave para decidir si mostrar Login o el RootNavigator.
 * Login y MiPerfil escriben/borran este mismo slot al autenticar/cerrar sesion.
 *
 * ⚠️ DEUDA DOCUMENTADA — TICKET-EPIC-LOGIN-001:
 * El shape de Sesion actual (solo `cedula`) es un PLACEHOLDER limitado del
 * OQ3 deferred del spec auth-gate (ver sdd/splash-logo-animado/spec).
 * Cuando se implemente auth real con backend .NET, migrar a:
 *   { token: string; cedula: string; expiresAt?: string (ISO 8601) }
 * y refinar `cargarSesion()` para devolver null si `expiresAt` está vencido
 * (`Date.now() < new Date(expiresAt).getTime()`).
 * El criterio de validez actual NO decodifica JWT ni verifica expiración.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clave_storage_sesion = '@sistema_epc:sesion';

export interface Sesion {
  readonly cedula: string;
}

export async function cargarSesion(): Promise<Sesion | null> {
  const crudo = await AsyncStorage.getItem(clave_storage_sesion);
  if (crudo === null) return null;
  try {
    const parsed = JSON.parse(crudo) as Partial<Sesion>;
    if (typeof parsed.cedula !== 'string' || parsed.cedula.length === 0) {
      return null;
    }
    return { cedula: parsed.cedula };
  } catch {
    // Limpieza defensiva: si el JSON está corrupto, removemos la entrada
    // para evitar re-validación repetida del mismo basura. Spec 2.3 SHOULD.
    void AsyncStorage.removeItem(clave_storage_sesion).catch(() => {
      // Silencioso: storage cleanup es defensivo, no debe romper el flujo.
    });
    return null;
  }
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  await AsyncStorage.setItem(clave_storage_sesion, JSON.stringify(sesion));
}

export async function limpiarSesion(): Promise<void> {
  await AsyncStorage.removeItem(clave_storage_sesion);
}