/**
 * Validador puro del módulo PRESTADORES — reglas multi-tenant.
 *
 * Las funciones aquí retornan `boolean` para mantener el validador puro y
 * testeable sin dependencia de strings de UI. La capa de presentación
 * (Fase 5) es responsable de mapear `false` → mensaje al usuario.
 *
 * Reglas cubiertas:
 *   - 2.1 `cedulaRepresentanteLegalValida` — cédula colombiana entre 6 y 12 dígitos.
 *
 * Por ahora el módulo solo contiene reglas del change
 * `setup-inicial-multi-tenant-auth`. Las reglas históricas del módulo
 * (codigo_vacio, nombre_largo, etc.) viven en `prestadores.ts` factory
 * a través de `MENSAJES_ERROR_PRESTADOR`.
 */

const REGEX_CEDULA_COLOMBIA = /^\d{6,12}$/;

/**
 * Valida la cédula del representante legal del prestador.
 *
 * Acepta exclusivamente cadenas de dígitos entre 6 y 12 caracteres. No
 * admite separadores (puntos, guiones, espacios) ni letras; la regla
 * busca el formato canónico colombiano que se almacena en la columna
 * `representante_legal_cedula` agregada por migration 016.
 *
 * @param cedula cadena cruda del input del usuario.
 * @returns `true` si cumple el formato, `false` en cualquier otro caso
 *          (incluye string vacío, `undefined` no convertible, longitudes
 *          fuera de [6, 12], separadores o caracteres no numéricos).
 */
export function cedulaRepresentanteLegalValida(cedula: string): boolean {
  return REGEX_CEDULA_COLOMBIA.test(cedula);
}
