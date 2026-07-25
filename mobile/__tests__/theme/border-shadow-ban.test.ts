// mobile/__tests__/theme/border-shadow-ban.test.ts
//
// Characterization tests para el ban de impecable v1 sobre el "ghost-card"
// pattern (border + shadow decorativo sobre cards de contenido).
//
// Estrategia: parseamos el codigo fuente de las pantallas target y
// validamos que las StyleSheets de los containers de contenido NO
// combinan `borderWidth + shadow` (elevation / shadowColor / shadowOpacity
// / shadowRadius). Las sombras quedan reservadas para elevacion FUNCIONAL
// (FAB, bottom-bar, popover, snackbar).
//
// Las pantallas con sombras decorativas tenian ese combo en el mismo
// bloque de StyleSheet. Este test protege el refactor y evita regresiones
// silenciosas si alguien re-introduce el patron en otra iteracion.

import { readFileSync } from 'fs';
import { join } from 'path';

const MOBILE_ROOT = join(__dirname, '../..');

interface BloqueTarget {
  readonly archivo: string;
  readonly estilos: readonly string[];
}

/**
 * Pantallas con cards de contenido que tenian border + shadow combo.
 * Tras el refactor, los nombres de estilo siguen existiendo (no rompemos
 * el shape del StyleSheet) pero el bloque ya no incluye shadow tokens.
 *
 * Excluimos conscientemente: btnPrimary sin border, snackBox sin border,
 * bottomBar con borderTop (divisor funcional), iconos flotantes — esos
 * SI mantienen shadow porque es elevacion funcional.
 */
const TARGETS: readonly BloqueTarget[] = [
  { archivo: 'src/pantallas/AltaSuscriptor.tsx', estilos: ['seccion:'] },
  { archivo: 'src/pantallas/EditarSuscriptor.tsx', estilos: ['seccion:'] },
  { archivo: 'src/pantallas/DetalleSuscriptor.tsx', estilos: ['card:'] },
  {
    archivo: 'src/pantallas/ResultadoCalculo.tsx',
    estilos: ['bentoColFullWhite:', 'btnSecondary:'],
  },
  {
    archivo: 'src/pantallas/Sincronizacion.tsx',
    estilos: ['progresoCard:', 'statCard:', 'conexionCard:', 'fallidosCard:'],
  },
];

/** Devuelve el substring del bloque de un estilo: desde `nombre:` hasta el `},` de cierre. */
function bloqueDeEstilo(codigo: string, nombreEstilo: string): string | null {
  const idx = codigo.indexOf(nombreEstilo);
  if (idx === -1) return null;
  const fin = codigo.indexOf('},', idx);
  if (fin === -1) return null;
  return codigo.substring(idx, fin);
}

describe('Bloque 1 — border+shadow combo ban en cards de contenido', () => {
  it.each(TARGETS)(
    '$archivo: estilos $estilos NO tienen shadow decorativo (ghost-card ban)',
    ({ archivo, estilos }) => {
      const codigo = readFileSync(join(MOBILE_ROOT, archivo), 'utf8');
      for (const estilo of estilos) {
        const bloque = bloqueDeEstilo(codigo, estilo);
        // Si el estilo no existe en este archivo, lo salteamos.
        if (bloque === null) continue;
        expect(bloque).not.toMatch(/elevation|shadowColor|shadowOpacity|shadowRadius/);
      }
    },
  );

  it.each(TARGETS)(
    '$archivo: estilos $estilos mantienen borderWidth: 1 + borderColor (jerarquia visual)',
    ({ archivo, estilos }) => {
      const codigo = readFileSync(join(MOBILE_ROOT, archivo), 'utf8');
      for (const estilo of estilos) {
        const bloque = bloqueDeEstilo(codigo, estilo);
        if (bloque === null) continue;
        // Mantenemos la jerarquia visual (cards planas con borde).
        expect(bloque).toMatch(/borderWidth:\s*1/);
        expect(bloque).toMatch(/borderColor:/);
      }
    },
  );
});
