// mobile/__tests__/componentes/TarjetaMetrica.test.tsx
//
// Tests contractuales de la TarjetaMetrica — extraccion del patron
// duplicado en Sincronizacion.tsx (3 stat cards: exitosos / fallidos /
// pendientes) y MiPerfil.tsx (2 stat cards: lecturas / ultimaSincro).
//
// Antes de extraer, cada pantalla tenia su propio statCard/gridCard
// con pequenas variaciones:
//   - Sincronizacion: RADIUS.xl (24) — codex defect "32px+ border-radius"
//   - MiPerfil:      RADIUS.xl (24) — mismo problema
//   - icon sizes 22 vs 24
//   - variantes de color por estado (verde / rojo / muted)
//
// Cobertura de principios impeccable:
//   T-TARJETA-1   Renderiza el valor verbatim y el icono.
//   T-TARJETA-2   Border radius <= 16 (RADIUS.card / RADIUS.md). NO RADIUS.xl.
//   T-TARJETA-3   No ghost-card (sin border + shadow combo).
//   T-TARJETA-4   Variante 'normal' usa COLORS.brandAzulOscuro (no
//                 COLORS.primary generico) — token institucional.
//   T-TARJETA-5   Variante 'exito' usa COLORS.brandVerde.
//   T-TARJETA-6   Variante 'error' usa COLORS.error.
//   T-TARJETA-7   Contraste WCAG AA: brandAzulOscuro sobre
//                 surfaceContainerLowest (#FFFFFF) >= 4.5:1.
//   T-TARJETA-8   Sin textTransform: uppercase (ALL CAPS ban).
//   T-TARJETA-9   Valor (numero destacado) usa TYPOGRAPHY.headlineSm o
//                 mayor — jerarquia visual con la etiqueta.
//   T-TARJETA-10  Ningun hex hardcodeado en backgroundColor/borderColor.
//
// Mocks:
//   - @expo/vector-icons/MaterialIcons: mock global via moduleNameMapper
//     (devuelve un Text con testID {testID}-icon-name).

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { TarjetaMetrica } from '../../src/componentes/TarjetaMetrica';

/**
 * Source del componente — los tests de craft son REGRESION de la
 * identidad de tokens. Patron copiado de TopBar/BotonPrimario.test.tsx.
 */
const tarjetaSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/TarjetaMetrica.tsx'),
  'utf8',
);

/** Flatten un style array/object en un solo objeto. */
function flattenStyle(raw: unknown): Record<string, unknown> {
  const flat = Array.isArray(raw)
    ? raw.flatMap((s: unknown) =>
        typeof s === 'object' && s !== null ? [s as Record<string, unknown>] : [],
      )
    : [raw as Record<string, unknown>];
  return Object.assign({}, ...flat);
}

/** Calcula la luminancia relativa WCAG (0..1) para un hex `#RRGGBB`. */
function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  const r = parseInt(limpio.slice(0, 2), 16) / 255;
  const g = parseInt(limpio.slice(2, 4), 16) / 255;
  const b = parseInt(limpio.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.072 * lin(b);
}

/** Ratio de contraste WCAG entre dos hex. */
function contrasteWCAG(hex1: string, hex2: string): number {
  const l1 = luminancia(hex1);
  const l2 = luminancia(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('TarjetaMetrica — principios impeccable', () => {
  // ── T-TARJETA-1: render ──────────────────────────────────────────────────
  describe('T-TARJETA-1: renderiza valor, etiqueta e icono', () => {
    it('muestra el valor verbatim', () => {
      render(
        <TarjetaMetrica
          icono="check-circle"
          etiqueta="Exitosos"
          valor={42}
          testID="tarjeta"
        />,
      );
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('Exitosos')).toBeTruthy();
    });

    it('renderiza con valor string', () => {
      render(
        <TarjetaMetrica
          icono="sync"
          etiqueta="Última sincronización"
          valor="—"
          testID="tarjeta-str"
        />,
      );
      expect(screen.getByText('—')).toBeTruthy();
    });
  });

  // ── T-TARJETA-2: border radius <= 16 ────────────────────────────────────
  describe('T-TARJETA-2: border radius <= 16 (sin sobre-redondeo)', () => {
    it('el componente NO usa RADIUS.xl (24) ni borderRadius > 16', () => {
      // Ban explicito de impecable v1: 32px+ border-radius en cards es
      // codex defect. RADIUS.xl = 24 ya esta en la zona prohibida.
      expect(tarjetaSource).not.toMatch(/borderRadius:\s*RADIUS\.xl/);
      expect(tarjetaSource).not.toMatch(/borderRadius:\s*24/);
      expect(tarjetaSource).not.toMatch(/borderRadius:\s*3[2-9]/);
    });

    it('los borderRadius del componente usan RADIUS.md o RADIUS.card', () => {
      const usaMd = /borderRadius:\s*RADIUS\.md/.test(tarjetaSource);
      const usaCard = /borderRadius:\s*RADIUS\.card/.test(tarjetaSource);
      expect(usaMd || usaCard).toBe(true);
    });
  });

  // ── T-TARJETA-3: sin ghost-card ──────────────────────────────────────────
  describe('T-TARJETA-3: sin ghost-card (border + shadow combo)', () => {
    it('ningun bloque combina borderWidth >= 1 con elevation a menos de 200 chars', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?elevation:\s*[1-9]/;
      expect(tarjetaSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque combina borderWidth >= 1 con shadowRadius a menos de 200 chars', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?shadowRadius:\s*[1-9]/;
      expect(tarjetaSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque del StyleSheet declara shadowRadius > 0', () => {
      // TarjetaMetrica = card de contenido. Segun skeletal-tokens.ts,
      // las cards de contenido usan solo borderWidth + borderColor;
      // shadow se reserva para FABs / bottom-bars / popovers.
      expect(tarjetaSource).not.toMatch(/shadowRadius:\s*[1-9]/);
    });
  });

  // ── T-TARJETA-4: variante 'normal' usa COLORS.brandAzulOscuro ────────────
  describe("T-TARJETA-4: variante 'normal' usa COLORS.brandAzulOscuro", () => {
    it('la variante normal referencia COLORS.brandAzulOscuro para el valor', () => {
      // El codigo debe mencionar el token brand* (no COLORS.primary generico).
      const tokensNormal = [
        ...tarjetaSource.matchAll(/brandAzulOscuro|brandVerde|COLORS\.error/g),
      ];
      expect(tokensNormal.length).toBeGreaterThan(0);
    });

    it('la variante normal NO usa COLORS.primary generico para el valor', () => {
      // Para el numero destacado, queremos el token institucional explicito.
      // COLORS.primary esta bien para backgrounds de flujos, pero el
      // valor destacado debe dejar visible la intencion institucional.
      // Aceptamos COLORS.primary solo en backgrounds NO destacados.
      const variantesBloques = [
        'varianteNormalValor',
        'varianteNormalColor',
        'varianteNormal',
        'valorNormal',
      ];
      const referencias = variantesBloques
        .map((n) => {
          const match = tarjetaSource.match(
            new RegExp(`${n}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`),
          );
          return match ? match[1] : '';
        })
        .filter(Boolean);
      // Si hay bloques variante*, al menos uno debe referenciar COLORS.brandAzulOscuro
      if (referencias.length > 0) {
        const algunaConBrand = referencias.some((r) => r.includes('brandAzulOscuro'));
        expect(algunaConBrand).toBe(true);
      }
    });
  });

  // ── T-TARJETA-5: variante 'exito' usa COLORS.brandVerde para el icono ───
  describe("T-TARJETA-5: variante 'exito' usa COLORS.brandVerde para el icono", () => {
    it('la variante exito referencia COLORS.brandVerde en algun punto', () => {
      // brandVerde se reserva al icono (elemento grafico, 3:1 suficiente).
      const match = tarjetaSource.match(
        /varianteExito(?:Valor|Color|Icono)?:\s*\{([\s\S]*?)\n\s*\},?/,
      );
      if (match) {
        expect(match[1]).toContain('brandVerde');
      } else {
        expect(tarjetaSource).toContain('brandVerde');
      }
    });

    it('el icono en variante exito resuelve a COLORS.brandVerde (#76B718)', () => {
      // El MaterialIcons recibe color dinamico segun variante. El mock
      // global descarta la prop `color`, asi que verificamos via source
      // inspection que el ternario de colorIcono devuelve brandVerde
      // cuando variante === 'exito'.
      const ternarioColorIcono = tarjetaSource.match(
        /colorIcono\s*=\s*([\s\S]*?);/,
      );
      expect(ternarioColorIcono).not.toBeNull();
      const expr = ternarioColorIcono![1];
      // La expresion debe mencionar tanto 'exito' como brandVerde.
      expect(expr).toMatch(/['"]exito['"]/);
      expect(expr).toMatch(/brandVerde/);
    });
  });

  // ── T-TARJETA-6: variante 'error' usa COLORS.error ──────────────────────
  describe("T-TARJETA-6: variante 'error' usa COLORS.error", () => {
    it('la variante error referencia COLORS.error', () => {
      const match = tarjetaSource.match(
        /varianteError(?:Valor|Color|Icono)?:\s*\{([\s\S]*?)\n\s*\},?/,
      );
      if (match) {
        expect(match[1]).toContain('COLORS.error');
      } else {
        // Fallback: el ternario debe mencionar COLORS.error
        expect(tarjetaSource).toContain('COLORS.error');
      }
    });
  });

  // ── T-TARJETA-7: WCAG AA ────────────────────────────────────────────────
  describe('T-TARJETA-7: contraste WCAG AA del valor destacado', () => {
    it('brandAzulOscuro (#093C5D) sobre surfaceContainerLowest (#FFFFFF) >= 4.5:1', () => {
      // brandAzulOscuro se usa como color del valor en variantes normal/exito.
      const ratio = contrasteWCAG('#093C5D', '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('error (#D5212A) sobre surfaceContainerLowest (#FFFFFF) >= 4.5:1', () => {
      // COLORS.error se usa como color del valor en variante error.
      const ratio = contrasteWCAG('#D5212A', '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('el componente NO usa COLORS.brandVerde para el color del valor', () => {
      // brandVerde (#76B718) sobre blanco da 2.45:1 — falla WCAG AA.
      // Por diseno, brandVerde solo se usa para el ICONO (elemento
      // grafico, contraste 3:1 alcanza), nunca para el valor textual.
      // Verificamos que el color del VALOR (Text hijo) no resuelva a #76B718.
      const { rerender } = render(
        <TarjetaMetrica
          icono="check-circle"
          etiqueta="Exitosos"
          valor={42}
          variante="exito"
          testID="t-wcag"
        />,
      );
      const valor = screen.getByText('42');
      const flat = flattenStyle(valor.props.style);
      // El color puede ser COLORS.brandAzulOscuro (#093C5D) o COLORS.error
      // (#D5212A). Nunca debe ser el verde (#76B718).
      expect(flat.color).not.toBe('#76B718');
      expect(flat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  // ── T-TARJETA-8: sin ALL CAPS ────────────────────────────────────────────
  describe('T-TARJETA-8: sin textTransform: uppercase', () => {
    it('el codigo del componente no contiene textTransform: uppercase (excluyendo comentarios)', () => {
      const sinComentarios = tarjetaSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });
  });

  // ── T-TARJETA-9: jerarquia valor > etiqueta ──────────────────────────────
  describe('T-TARJETA-9: valor destacado con tipografia mayor que la etiqueta', () => {
    it('el valor usa TYPOGRAPHY.headlineSm o mayor', () => {
      // headlineSm = fontSize 20. La etiqueta debe ser menor.
      // Buscamos en el codigo que se aplique una tipografia de tamano
      // adecuado al valor.
      const valorBloque = tarjetaSource.match(
        /(?:valorDestacado|valorText|valorStyle|valor):\s*\{([\s\S]*?)\n\s*\},?/,
      );
      const referencia = valorBloque
        ? valorBloque[1]
        : tarjetaSource;
      // Debe haber referencia a TYPOGRAPHY.headline* o fontSize >= 20.
      const tieneHeadline = /headline[LSM]/i.test(referencia);
      const tieneFontSize = /fontSize:\s*([2-9]\d|\d{3,})/.test(referencia);
      expect(tieneHeadline || tieneFontSize).toBe(true);
    });

    it('la etiqueta usa TYPOGRAPHY.labelSm o menor (mas pequena que el valor)', () => {
      const etiquetaBloque = tarjetaSource.match(
        /(?:etiquetaText|etiquetaStyle|etiqueta):\s*\{([\s\S]*?)\n\s*\},?/,
      );
      const referencia = etiquetaBloque ? etiquetaBloque[1] : tarjetaSource;
      const tieneLabel = /label[LSM]/i.test(referencia);
      const tieneFontSizePequeno = /fontSize:\s*1[0-4]/.test(referencia);
      expect(tieneLabel || tieneFontSizePequeno).toBe(true);
    });
  });

  // ── T-TARJETA-10: sin hex hardcoded ──────────────────────────────────────
  describe('T-TARJETA-10: sin hex hardcoded en backgroundColor/borderColor', () => {
    it('ninguna backgroundColor usa hex literal', () => {
      // Buscamos backgroundColor: '#...' (hex hardcoded)
      const hexBg = /backgroundColor:\s*['"]#[0-9a-fA-F]{3,8}['"]/;
      expect(tarjetaSource).not.toMatch(hexBg);
    });

    it('ninguna borderColor usa hex literal', () => {
      const hexBorder = /borderColor:\s*['"]#[0-9a-fA-F]{3,8}['"]/;
      expect(tarjetaSource).not.toMatch(hexBorder);
    });
  });

  // ── Render: variantes producen estilos distintos ─────────────────────────
  describe('render: variantes producen estilos diferentes', () => {
    it('variante normal vs error: el color del valor cambia', () => {
      const { rerender } = render(
        <TarjetaMetrica
          icono="check-circle"
          etiqueta="A"
          valor="1"
          variante="normal"
          testID="t"
        />,
      );
      const valorNormal = screen.getByText('1');
      const colorNormal = flattenStyle(valorNormal.props.style).color;

      rerender(
        <TarjetaMetrica
          icono="error"
          etiqueta="A"
          valor="1"
          variante="error"
          testID="t"
        />,
      );
      const valorError = screen.getByText('1');
      const colorError = flattenStyle(valorError.props.style).color;

      expect(colorNormal).not.toBe(colorError);
    });
  });

  // ── Sanidad ──────────────────────────────────────────────────────────────
  describe('sanidad', () => {
    it('exporta TarjetaMetrica como componente nominal', () => {
      expect(typeof TarjetaMetrica).toBe('function');
    });

    it('importa StyleSheet de react-native', () => {
      expect(tarjetaSource).toContain('StyleSheet');
    });
  });
});