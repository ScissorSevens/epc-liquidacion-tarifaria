// mobile/__tests__/theme/skeletal-tokens.test.ts
//
// Tests contractuales sobre el sistema de tokens del Skeletal Wireframe.
//
// Cobertura:
//   - SHADOWS: solo expone `float` para FAB / bottom-bar / chips flotantes.
//     El antiguo `card` (shadow puramente decorativa, casi invisible) queda
//     deprecado porque combina con borderWidth: 1 para formar el patron
//     "ghost-card" que veta impecable v1.
//
// Porque:
//   - Antes: `SHADOWS.card` (elevation: 2, shadowRadius: 4) se usaba junto
//     a borderWidth: 1 sobre cards de contenido -> efecto "tarjeta fantasma".
//   - Despues: cards de contenido llevan solo borderWidth + borderColor.
//     La sombra se reserva para superficies REALMENTE elevadas del scroll
//     (FAB, bottom-bar, dropdown), donde cumple funcion de separacion.

import { SHADOWS } from '../../src/theme/skeletal-tokens';

describe('theme/skeletal-tokens — SHADOWS (Bloque 1 craft UI)', () => {
  it('T-THEME-A1 SHADOWS NO expone "card" (BAN impecable: border + shadow combo)', () => {
    // El variant `card` estaba pensado para decoracion invisible. Con
    // borderWidth: 1 producia el ghost-card pattern. Solo conservamos
    // `float` para elevacion funcional.
    expect((SHADOWS as Record<string, unknown>).card).toBeUndefined();
  });

  it('T-THEME-A2 SHADOWS.float existe y tiene la forma esperada (functional elevation)', () => {
    // float se usa en FAB, bottom-bar, dropdown — superficies que
    // necesitan sombra para separarse del contenido scrolleable.
    expect(SHADOWS.float).toBeDefined();
    expect(SHADOWS.float.elevation).toBe(8);
    expect(SHADOWS.float.shadowColor).toBe('#000');
    expect(SHADOWS.float.shadowOpacity).toBeGreaterThan(0);
    expect(SHADOWS.float.shadowRadius).toBeGreaterThan(0);
  });
});
