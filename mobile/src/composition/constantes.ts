/**
 * Constantes de composicion relacionadas con la sesion del operario.
 *
 * La sesion se persiste en AsyncStorage con la clave `clave_storage_sesion`.
 * AuthGate consulta esta clave para decidir si mostrar Login o el RootNavigator.
 * Login y MiPerfil escriben/borran este mismo slot al autenticar/cerrar sesion.
 *
 * ⚠️ DEUDA DOCUMENTADA — TICKET-EPIC-LOGIN-001:
 * Shape de Sesion actual:
 *   { token, cedula, nombre?, idOperario, idPrestador, expiresAt }
 * Token = GUID random que devuelve el backend de EPC (.NET) tras autenticar.
 * expiresAt = timestamp absoluto en ms (Date.now()); la sesion vence 24h
 * despues del login y `cargarSesion()` la descarta transparentemente.
 * idOperario = id del operario en la DB local; requerido por ley para
 * atribuir legalmente cada lectura capturada (CRA 825/2017 art. 1.3.1.5 +
 * Res SSPD 2018). Sin este campo, las lecturas quedaban con `id_operario: 1`
 * hardcoded y la auditoría era inservible (COR-04 reporte de calidad).
 *
 * FASE 4 TAREA 4.1 — reemplazo del placeholder `{ cedula }` por el shape real.
 * `esSesionValida` se exporta unicamente para tests (helper privado de hecho,
 * expuesto por necesidad de cobertura). No es parte de la API publica.
 *
 * FASE 5 TAREA 5.3 — PUNTO C: token vencido con mensaje claro.
 * `estadoSesionPersistida()` devuelve 'no_existe' | 'vencida' | 'invalida'
 * | 'valida' para que AuthGate pueda distinguir "primera vez" de "el token
 * vencio" y mostrar el banner adecuado. La sesion `vencida` NO se borra de
 * storage (queda ahi para que el proximo login overwrite la borre via
 * `guardarSesion`). `cargarSesion()` se vuelve wrapper de este helper.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const clave_storage_sesion = '@sistema_epc:sesion';

export interface Sesion {
  readonly token: string;
  readonly cedula: string;
  readonly nombre?: string;
  /**
   * ID del operario que inicio sesion (requerido por auditoria legal —
   * cada lectura debe atribuirse al operario que la capturo).
   * Entero estrictamente positivo (id_operario de la tabla `operarios`).
   */
  readonly idOperario: number;
  readonly idPrestador: number;
  /** Timestamp absoluto en ms desde epoch. La sesion vence cuando Date.now() >= expiresAt. */
  readonly expiresAt: number;
}

/**
 * Estado posible de la sesion persistida en AsyncStorage.
 *
 * - 'no_existe': la clave nunca fue escrita. Cold-boot limpio / primer login.
 * - 'vencida':   hubo sesion pero `expiresAt <= Date.now()`. NO se borra
 *                de storage — AuthGate debe informar al operario.
 * - 'invalida':  basura en storage (JSON corrupto, shape invalido, campos
 *                requeridos faltantes). Se borra defensivamente para no
 *                re-validar el mismo error en cada cold-boot.
 * - 'valida':    sesion vigente con todos los campos requeridos en orden.
 */
export type EstadoSesion = 'no_existe' | 'vencida' | 'invalida' | 'valida';

/**
 * Helper interno: borra la clave de sesion de AsyncStorage silenciosamente.
 * Usado por `estadoSesionPersistida()` cuando detecta estado 'invalida'.
 * Encapsulado aca para que los tests puedan espiar UN solo punto de cleanup
 * y para que el try/catch de la promise colgante no se duplique.
 */
function limpiarStorageDefensivo(): void {
  void AsyncStorage.removeItem(clave_storage_sesion).catch(() => {
    // Silencioso: storage cleanup es defensivo, no debe romper el flujo
    // de arranque de AuthGate si AsyncStorage fallara (DB corrupta, etc.).
  });
}

/**
 * Lee la sesion persistida y la clasifica segun POR QUE es o no utilizable.
 *
 * Diferencia con `cargarSesion()`: cargarSesion colapsa todo en `Sesion|null`,
 * perdiendo la razon del null. Este helper expone el motivo para que AuthGate
 * pueda decidir si mostrar Login silencioso, Login con banner de "sesion
 * vencida", o SetupInicial.
 *
 * Reglas de cleanup (PUNTO C):
 *   - 'no_existe': nada que limpiar.
 *   - 'vencida':   NO se borra (queremos que el operario sepa que vencio).
 *                  `guardarSesion()` del proximo login overwrite la entrada.
 *   - 'invalida':  borra defensivo para no re-validar basura en cold-boot.
 *   - 'valida':    nada que limpiar.
 *
 * Las reglas de "shape invalido" replican el contrato de `esSesionValida()`:
 *   - token: string no vacio.
 *   - cedula: string no vacio.
 *   - idPrestador: number entero > 0.
 *   - idOperario: number entero > 0. (CRA 825/2017 — auditoria legal)
 *   - expiresAt: number.
 * A diferencia de `esSesionValida`, este helper considera 'vencida' cuando
 * `expiresAt <= Date.now()` (no `>`). El boundary se trata como vencida
 * porque el token ya no es util para una nueva peticion.
 */
export async function estadoSesionPersistida(): Promise<EstadoSesion> {
  const crudo = await AsyncStorage.getItem(clave_storage_sesion);
  if (crudo === null) return 'no_existe';

  let parsed: Partial<Sesion>;
  try {
    parsed = JSON.parse(crudo) as Partial<Sesion>;
  } catch {
    limpiarStorageDefensivo();
    return 'invalida';
  }

  if (typeof parsed.token !== 'string' || parsed.token.length === 0) {
    limpiarStorageDefensivo();
    return 'invalida';
  }
  if (typeof parsed.cedula !== 'string' || parsed.cedula.length === 0) {
    limpiarStorageDefensivo();
    return 'invalida';
  }
  if (
    typeof parsed.idPrestador !== 'number' ||
    !Number.isInteger(parsed.idPrestador) ||
    parsed.idPrestador <= 0
  ) {
    limpiarStorageDefensivo();
    return 'invalida';
  }
  if (
    typeof parsed.idOperario !== 'number' ||
    !Number.isInteger(parsed.idOperario) ||
    parsed.idOperario <= 0
  ) {
    limpiarStorageDefensivo();
    return 'invalida';
  }
  if (typeof parsed.expiresAt !== 'number') {
    limpiarStorageDefensivo();
    return 'invalida';
  }
  // Vencio: NO limpiamos storage. AuthGate usa este estado para mostrar
  // el banner "Tu sesion anterior vencio".
  if (parsed.expiresAt <= Date.now()) {
    return 'vencida';
  }
  return 'valida';
}

/**
 * Type guard: devuelve true solo si TODOS los campos requeridos son validos.
 * Reglas (Fase 4.1 contrato + Fase 7 auditoria legal):
 *   - token:      string no vacio
 *   - cedula:     string no vacio
 *   - idPrestador: number entero > 0
 *   - idOperario:  number entero > 0  (CRA 825/2017 — cada lectura debe
 *                     atribuirse al operario que la capturo, NO hardcoded)
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
    typeof s.idOperario === 'number' &&
    Number.isInteger(s.idOperario) &&
    s.idOperario > 0 &&
    typeof s.expiresAt === 'number' &&
    s.expiresAt > Date.now() &&
    (s.nombre === undefined || typeof s.nombre === 'string')
  );
}

/**
 * Lee la sesion persistida y la devuelve si sigue vigente. Devuelve `null`
 * en cualquier otro caso.
 *
 * Tras PUNTO C, esta funcion es un wrapper sobre `estadoSesionPersistida()`:
 * delega a ella la decision de cleanup (que distingue 'vencida' vs
 * 'invalida') y solo cuando el estado es 'valida' re-lee storage para
 * devolver el objeto tipado. Asi, cargarSesion no pierde la informacion
 * sobre POR QUE devolvio null (AuthGate ya la tiene via estadoSesionPersistida).
 *
 * Si `estadoSesionPersistida()` retorna 'valida', el `getItem` siguiente
 * debe devolver la misma cadena que acabamos de parsear — confiamos en
 * que AsyncStorage no la modifica entre llamadas (es read-only en RN).
 */
export async function cargarSesion(): Promise<Sesion | null> {
  const estado = await estadoSesionPersistida();
  if (estado !== 'valida') return null;

  // Re-leemos para tener el objeto crudo (estadoSesionPersistida no lo
  // expone para mantener su contrato chico). El getItem siguiente es
  // idempotente: AsyncStorage no muta la clave entre lecturas.
  const crudo = await AsyncStorage.getItem(clave_storage_sesion);
  if (crudo === null) return null;
  try {
    return JSON.parse(crudo) as Sesion;
  } catch {
    // Estado 'valida' garantizo JSON parseable, pero por seguridad:
    return null;
  }
}

/**
 * Persiste la sesion completa bajo la clave esperada. El shape se serializa
 * tal cual: es responsabilidad del caller garantizar `esSesionValida(sesion)`
 * en alguna verificacion previa al `setItem` (conexion de red OK, backend
 * devolvio token valido, expiresAt = now + 24h, etc.).
 *
 * En PUNTO C, esta funcion tambien cumple el rol de "cleanup" del caso
 * `vencida`: cuando el operario se loguea exitosamente despues de ver el
 * banner, `guardarSesion()` overwrite la entrada expirada.
 */
export async function guardarSesion(sesion: Sesion): Promise<void> {
  await AsyncStorage.setItem(clave_storage_sesion, JSON.stringify(sesion));
}

/**
 * Elimina la sesion persistida. Se invoca desde:
 *   - AuthGate: cuando el operario confirma logout en MiPerfil.
 *   - estadoSesionPersistida defensivamente: cuando la sesion guardada
 *     tiene shape invalido (cleanup inline, encapsulado en
 *     `limpiarStorageDefensivo`).
 * AsyncStorage.removeItem sobre clave inexistente es no-op (no rechaza), asi
 * que esta funcion se mantiene como await lineal sin try/catch.
 */
export async function limpiarSesion(): Promise<void> {
  await AsyncStorage.removeItem(clave_storage_sesion);
}
