/**
 * Adapter universal de IdGenerator: usa `uuid` v4 (JS puro).
 *
 * En React Native requiere el polyfill `react-native-get-random-values`,
 * que debe importarse UNA SOLA VEZ desde el bootstrap móvil ANTES de este
 * adapter. En Node, `crypto.getRandomValues` ya existe globalmente.
 */
import { v4 as uuidv4 } from 'uuid';
import type { IdGenerator } from '../ports/id-generator';

export function crearIdGeneratorUuid(): IdGenerator {
  return {
    uuid: () => uuidv4(),
  };
}
