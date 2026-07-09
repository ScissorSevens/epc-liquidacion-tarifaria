/**
 * Constantes de composicion relacionadas con la sesion del operario.
 *
 * La sesion se persiste en AsyncStorage con la clave `clave_storage_sesion`.
 * AuthGate consulta esta clave para decidir si mostrar Login o el RootNavigator.
 * Login y MiPerfil escriben/borran este mismo slot al autenticar/cerrar sesion.
 *
 * ⚠️ DEUDA DOCUMENTADA — TICKET-EPIC-LOGIN-001:
 * Shape de Sesion actual:
 *   { token: string; cedula: string; nombre?: string; idPrestador: number; expiresAt: number }
 * Token = GUID random que devuelve el backend de EPC (.NET) tras autenticar.
 * expiresAt = timestamp absoluto en ms (Date.now()); la sesion vence 24h
 * despues del login y `cargarSesion()` la descarta transparentemente.
 *
 * FASE 4 TAREA 4.1 — reemplazo del placeholder `{ cedula }` por el shape real.
 * `esSesionValida` se exporta unicamente para tests (helper privado de hecho,
 * expuesto por necesidad de cobertura). No es parte de la API publica.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clave_storage_sesion = '@sistema_epc:sesion';

export interface Sesion {
  readonly token: string;
  readonly cedula: string;
  readonly nombre?: string;
  readonly idPrestador: number;
  /** Timestamp absoluto en ms desde epoch. La sesion vence cuando Date.now() >= expiresAt. */
  readonly expiresAt: number;
}

/**
 * Type guard: devuelve true solo si TODOS los campos requeridos son validos.
 * Reglas (Fase 4.1 contrato):
 *   - token:      string no vacio
 *   - cedula:     string no vacio
 *   - idPrestador: number entero > 0
 *   - expiresAt:  number, estrictamente futuro (Date.now() < expiresAt)
 *   - nombre:     opcional, string si esta presente
 *
 * Se exporta para tests; en el codigo de produccion se usa solo desde
 * `cargarSesion()`. Mantenerlo puro (sin side-effects) es clave para TDD.
 */
export function esSesionValida(s: Partial<Sesion>): s is Sesion {
  return (
    typeof s.token === 'string' &&
    s.token.length > 0 &&
    typeof s.cedula === 'string' &&
    s.cedula.length > 0 &&
    typeof s.idPrestador === 'number' &&
    Number.isInteger(s.idPrestador) &&
    s.idPrestador > 0 &&
    typeof s.expiresAt === 'number' &&
    s.expiresAt > Date.now() &&
    (s.nombre === undefined || typeof s.nombre === 'string')
  );
}

/**
 * Lee la sesion persistida y la devuelve si sigue vigente.
 * Devuelve `null` (y limpia AsyncStorage defensivamente) cuando:
 *   - no hay nada en storage
 *   - el JSON esta corrupto
 *   - la sesion esta vencida (expiresAt < Date.now())
 *   - falta algun campo requerido o es invalido
 */
export async function cargarSesion(): Promise<Sesion | null> {
  const crudo = await AsyncStorage.getItem(clave_storage_sesion);
  if (crudo === null) return null;

  try {
    const parsed = JSON.parse(crudo) as Partial<Sesion>;
    if (!esSesionValida(parsed)) {
      // Sesion invalida (vencida o corrupta por shape): limpieza defensiva
      // para no re-validar el mismo basura en el proximo cold-boot.
      // Spec 2.3 SHOULD: rechazo silencioso + cleanup.
      void AsyncStorage.removeItem(clave_storage_sesion).catch(() => {
        // Silencioso: storage cleanup es defensivo, no debe romper el flujo
        // de arranque de AuthGate.
      });
      return null;
    }
    return parsed as Sesion;
  } catch {
    // JSON corrupto: misma limpieza defensiva.
    void AsyncStorage.removeItem(clave_storage_sesion).catch(() => {
      // Silencioso.
    });
    return null;
  }
}

/**
 * Persiste la sesion completa bajo la clave esperada. El shape se serializa
 * tal cual: es responsabilidad del caller garantizar `esSesionValida(sesion)`
 * en alguna verificacion previa al `setItem` (conexion de red OK, backend
 * devolvio token valido, expiresAt = now + 24h, etc.).
 */
export async function guardarSesion(sesion: Sesion): Promise<void> {
  await AsyncStorage.setItem(clave_storage_sesion, JSON.stringify(sesion));
}

/**
 * Elimina la sesion persistida. Se invoca desde:
 *   - AuthGate: cuando el operario confirma logout en MiPerfil.
 *   - cargarSesion defensivamente: cuando la sesion guardada esta vencida o
 *     corrupta (cleanup inline arriba).
 * AsyncStorage.removeItem sobre clave inexistente es no-op (no rechaza), asi
 * que esta funcion se mantiene como await lineal sin try/catch.
 */
export async function limpiarSesion(): Promise<void> {
  await AsyncStorage.removeItem(clave_storage_sesion);
}
