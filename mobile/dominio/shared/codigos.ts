/**
 * Helpers compartidos de codigos verificables de la factura.
 *
 * Justificacion: este modulo existe porque `calcularCodigoVerificacionPlaceholder`
 * estaba DUPLICADO en 3 lugares del repo:
 *   - `mobile/dominio/factura/factura.ts:422`
 *   - `mobile/dominio/factura/factura-repository-sqlite.ts:136`
 *   - `mobile/src/persistencia/expo-sqlite/factura-repository-expo-sqlite.ts:130`
 *
 * La duplicacion es deuda tecnica (DRY): cualquier fix o cambio de algoritmo
 * tenia que editar 3 archivos sincronizados. Aqui consolidamos:
 *   - `calcularCodigoVerificacionPlaceholder(hash)`: deriva un codigo base36
 *     de longitud fija desde un hash. Pensado para FILAS LEGACY (pre-2027)
 *     donde `codigo_verificacion` no existe en la migration 020.
 *   - `CODIGO_VERIFICACION_LONGITUD`: constante del contrato regulatorio
 *     (Res CRA 1038/2026: 10 chars base36). Re-exportada para que
 *     callers legacy (`pagos.ts`) no pierdan el binding.
 *
 * Algoritmo (verbatim del helper previo, sin cambios):
 *   1. Toma el hash canonico (hex SHA-256, 64 chars).
 *   2. Filtra solo chars hex validos (defensa ante hasher fake en tests).
 *   3. Toma los primeros 16 chars hex (8 bytes = 64 bits).
 *   4. PadEnd a 16 si quedan menos (caso legacy).
 *   5. Convierte ese fragmento de hex a entero.
 *   6. Codifica en base36 (0-9, A-Z), primeros 10 chars, padStart a 10.
 *
 * Deterministe: mismo hash -> mismo codigo. NO depende de timestamp.
 */

/**
 * Longitud del codigo de verificacion. 10 chars base36 — contrato
 * normativo Res CRA 1038/2026: codigo legible por el usuario + robusto
 * para busqueda (~60 bits de entropia en 36^10).
 */
export const CODIGO_VERIFICACION_LONGITUD = 10;

/**
 * Deriva un codigo de verificacion de longitud fija a partir de un hash.
 * Pensado para filas legacy pre-2027 que no tienen columna `codigo_verificacion`.
 *
 * Si el hash NO es hex puro (caso de hasher fake en tests), filtramos
 * los chars no-hex y padEnd con '0' para llegar a 16.
 *
 * @param hash Hash canonico de la Factura (hex SHA-256, 64 chars en prod).
 * @returns Codigo de 10 chars base36 (0-9, A-Z).
 */
export function calcularCodigoVerificacionPlaceholder(hash: string): string {
  const hexOnly = (hash + '0'.repeat(16))
    .split('')
    .filter((ch) => /[0-9a-fA-F]/.test(ch))
    .join('')
    .slice(0, 16)
    .padEnd(16, '0');
  const valor = parseInt(hexOnly, 16);
  const base36 = valor.toString(36).toUpperCase();
  return base36.slice(0, CODIGO_VERIFICACION_LONGITUD).padStart(CODIGO_VERIFICACION_LONGITUD, '0');
}
