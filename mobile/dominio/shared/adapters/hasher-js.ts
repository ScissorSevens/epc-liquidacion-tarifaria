/**
 * Adapter universal de Hasher: usa `js-sha256` (JS puro, sin builds nativos).
 *
 * Funciona en Node y React Native sin modificación. NO importa el módulo
 * `crypto` de Node — esa es exactamente la razón de existencia del port:
 * el bundle Metro de RN no resuelve `crypto` y rompe en runtime.
 */
import { sha256 } from 'js-sha256';
import type { Hasher } from '../ports/hasher';

export function crearHasherJs(): Hasher {
  return {
    sha256: (input: string) => sha256(input),
  };
}
