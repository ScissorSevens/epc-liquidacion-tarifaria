/**
 * Validador puro del módulo OPERARIOS — reglas multi-tenant.
 *
 * Las funciones aquí retornan `boolean` para mantener el validador puro y
 * testeable sin dependencia de strings de UI. La capa de presentación
 * (Fase 5) es responsable de mapear `false` → mensaje al usuario.
 *
 * Reglas cubiertas:
 *   - 2.2 `idPrestadorRequeridoValido` — operario multi-tenant debe tener
 *     `id_prestador > 0` (columna agregada por migration 016, FK a prestador).
 *   - 2.3 `passwordCumpleMinima` — política de longitud mínima para la
 *     contraseña cruda que el operario envía al login.
 *
 * Por ahora el módulo solo contiene reglas del change
 * `setup-inicial-multi-tenant-auth`. Las reglas históricas (cedula, email,
 * password_hash) viven en `operarios.ts` factory a través de
 * `MENSAJES_ERROR_OPERARIO`.
 */

const PASSWORD_LONGITUD_MINIMA = 8;

/**
 * Valida que un operario pertenezca a un prestador multi-tenant.
 *
 * El modelo multi-tenant exige `id_prestador > 0` (entero positivo) para
 * todo operario creado post-migration 016. El legacy `id_prestador = 0`
 * está reservado para datos importados previos al change.
 *
 * La función también rechaza decimales y `NaN`: aunque la columna SQLite
 * es INTEGER, la capa de UI podría enviar `parseFloat(input.value)` por
 * error; la guarda evita que un no-entero pase al repositorio.
 *
 * @param idPrestador valor numérico a validar.
 * @returns `true` solo si es entero y `> 0`. `false` para `0`, negativos,
 *          decimales y `NaN`.
 */
export function idPrestadorRequeridoValido(idPrestador: number): boolean {
  return Number.isInteger(idPrestador) && idPrestador > 0;
}

/**
 * Valida que la contraseña cruda tenga la longitud mínima aceptable.
 *
 * Política: 8 caracteres mínimo (alineado con NIST SP 800-63B como
 * referencia base; el hasher real y la sal se gestionan en la capa de
 * infraestructura — el dominio solo recibe la contraseña cruda desde la
 * pantalla de Login para verificar la regla de UX antes de enviar al
 * puerto de auth real en Fase 4).
 *
 * El parámetro se declara `string` pero la guarda `typeof === 'string'`
 * hace que la función sea segura ante entradas `undefined`/null que un
 * form mal inicializado podría entregar.
 *
 * @param password cadena cruda del input del usuario.
 * @returns `true` solo si es string con `length >= 8`. `false` para
 *          vacío, no-string o longitud insuficiente.
 */
export function passwordCumpleMinima(password: string): boolean {
  return typeof password === 'string' && password.length >= PASSWORD_LONGITUD_MINIMA;
}
