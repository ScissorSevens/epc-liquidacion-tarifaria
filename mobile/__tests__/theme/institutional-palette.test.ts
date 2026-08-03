// mobile/__tests__/theme/institutional-palette.test.ts
//
// Tests contractuales de la paleta institucional EPC y los mapeos de
// tokens semanticos -> institucionales. Verifica ademas los ratios de
// contraste WCAG AA sobre los pares criticos de la UI.
//
// Contexto:
//   - La paleta institucional fue confirmada por el usuario y es la
//     fuente de verdad de la identidad visual.
//   - Los tokens semanticos (primary, secondary, error) se MAPEAN a los
//     institucionales para no romper contraste ni consistencia.
//   - Tokens funcionales (background, surface, onSurface) NO se cambian
//     porque son neutrales (no son institucionales).
//
// Estrategia:
//   - Tests sobre los 7 brand tokens (valores literales hex).
//   - Tests sobre los 3 mapeos semanticos -> institucionales.
//   - Helper getContrastRatio() implementa WCAG 2.x relative luminance
//     para validar accesibilidad AA (>= 4.5:1) sobre los pares usados.

import { COLORS } from '../../src/theme/skeletal-tokens';

// --- Helper WCAG 2.x --------------------------------------------------------

/**
 * Convierte un canal sRGB (0..255) a su luminancia lineal (0..1).
 * Implementacion canonica de WCAG 2.x: piecewise sRGB -> linear.
 */
function linearizarCanal(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/**
 * Luminancia relativa WCAG 2.x para un color hex (`#RRGGBB` o `#RGB`).
 * Retorna un numero en [0, 1].
 */
function luminanciaRelativa(hex: string): number {
  const limpio = hex.replace('#', '');
  const expandido =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;
  const r = parseInt(expandido.substring(0, 2), 16);
  const g = parseInt(expandido.substring(2, 4), 16);
  const b = parseInt(expandido.substring(4, 6), 16);
  return (
    0.2126 * linearizarCanal(r) +
    0.7152 * linearizarCanal(g) +
    0.0722 * linearizarCanal(b)
  );
}

/**
 * Ratio de contraste WCAG 2.x entre dos colores hex. El orden no importa:
 * siempre retorna el ratio del mas claro sobre el mas oscuro, en [1, 21].
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const lA = luminanciaRelativa(hexA);
  const lB = luminanciaRelativa(hexB);
  const [masClaro, masOscuro] = lA > lB ? [lA, lB] : [lB, lA];
  return (masClaro + 0.05) / (masOscuro + 0.05);
}

// --- Tests -------------------------------------------------------------------

describe('theme/institutional-palette — brand tokens EPC', () => {
  it('T-TOKENS-1 COLORS.brandAzulOscuro es el azul oscuro institucional (#093C5D)', () => {
    expect(COLORS.brandAzulOscuro).toBe('#093C5D');
  });

  it('T-TOKENS-2 COLORS.brandAzulClaro es el azul claro institucional (#359CC8)', () => {
    expect(COLORS.brandAzulClaro).toBe('#359CC8');
  });

  it('T-TOKENS-3 COLORS.brandAmarillo es el amarillo institucional (#FFDC26)', () => {
    expect(COLORS.brandAmarillo).toBe('#FFDC26');
  });

  it('T-TOKENS-4 COLORS.brandRojo es el rojo institucional (#D5212A)', () => {
    expect(COLORS.brandRojo).toBe('#D5212A');
  });

  it('T-TOKENS-7 COLORS.brandVerde es el verde institucional (#76B718)', () => {
    expect(COLORS.brandVerde).toBe('#76B718');
  });

  it('T-TOKENS-8 COLORS.brandAzulDigital es el azul digital institucional (#0092FF)', () => {
    expect(COLORS.brandAzulDigital).toBe('#0092FF');
  });

  it('T-TOKENS-9 COLORS.brandGrisClaro es el gris claro institucional (#DADADA)', () => {
    expect(COLORS.brandGrisClaro).toBe('#DADADA');
  });
});

describe('theme/institutional-palette — mapeos semanticos -> institucionales', () => {
  it('T-TOKENS-10 COLORS.primary esta mapeado al brandAzulOscuro institucional', () => {
    // Mapeo explicito: el token semantico `primary` adopta el valor de
    // identidad. Coincidir con el brand garantiza una sola fuente de verdad.
    expect(COLORS.primary).toBe(COLORS.brandAzulOscuro);
    expect(COLORS.primary).toBe('#093C5D');
  });

  it('T-TOKENS-11 COLORS.secondary esta mapeado al brandAzulDigital institucional', () => {
    expect(COLORS.secondary).toBe(COLORS.brandAzulDigital);
    expect(COLORS.secondary).toBe('#0092FF');
  });

  it('T-TOKENS-12 COLORS.error esta mapeado al brandRojo institucional', () => {
    expect(COLORS.error).toBe(COLORS.brandRojo);
    expect(COLORS.error).toBe('#D5212A');
  });
});

describe('theme/institutional-palette — contrastes WCAG AA sobre pares criticos', () => {
  it('T-TOKENS-5 onPrimary (#FFFFFF) sobre primary (#093C5D) >= 4.5:1 (AA body)', () => {
    // Texto blanco sobre azul oscuro institucional. AAA esperado por el
    // alto contraste (>11:1). El assert es >= 4.5 (umbral AA).
    const ratio = getContrastRatio(COLORS.onPrimary, COLORS.primary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('T-TOKENS-6 error (#D5212A) sobre background (#F8F9FF) >= 4.5:1 (AA body)', () => {
    // Texto de error institucional sobre fondo claro. Debe pasar AA.
    const ratio = getContrastRatio(COLORS.error, COLORS.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('T-TOKENS-13 brandAmarillo (#FFDC26) sobre brandAzulOscuro (#093C5D) >= 4.5:1 (AA body)', () => {
    // Par complementario destacado: amarillo sobre azul oscuro institucional.
    // Alto contraste esperado, sirve para banners/CTA criticos.
    const ratio = getContrastRatio(COLORS.brandAmarillo, COLORS.brandAzulOscuro);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('T-TOKENS-14 onSurface (#0B1C30) sobre background (#F8F9FF) >= 4.5:1 (AA body)', () => {
    // Texto neutro sobre fondo: garantia de legibilidad del contenido
    // aunque los tokens sean funcionales (no institucionales).
    const ratio = getContrastRatio(COLORS.onSurface, COLORS.background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});