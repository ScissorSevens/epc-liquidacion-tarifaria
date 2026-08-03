// mobile/__tests__/componentes/TopBar.test.tsx
//
// Tests contractuales de la TopBar — refactor de craft segun principios
// de la skill impecable (registro product, RN).
//
// TopBar tiene 2 variantes:
//   - topBarRaiz    : fondo brandAzulOscuro, titulo blanco, sin flecha.
//   - topBarDetalle : fondo surfaceContainerLowest, titulo dark, con flecha.
//
// Cobertura de principios impeccable:
//   T-TOPBAR-1  brandAzulOscuro explicito en topBarRaiz (no COLORS.primary
//               generico). Ambos resuelven al mismo #093C5D pero el token
//               explicito deja claro que es la identidad institucional.
//   T-TOPBAR-2  topBarDetalle usa COLORS.surfaceContainerLowest (M3 neutral).
//   T-TOPBAR-3  Botones de icono (back) >= 44x44 px (WCAG 2.5.5 + PRODUCT.md
//               non-negotiable). Actual: 36x36 -> fail a11y audit.
//   T-TOPBAR-4  Ningun bloque combina borderWidth >= 1 con elevation
//               (ghost-card anti-pattern de impecable v1).
//   T-TOPBAR-5  Sin textTransform: 'uppercase' (ALL CAPS ban).
//   T-TOPBAR-6  Contraste onPrimary/brandAzulOscuro >= 4.5:1 (WCAG AA).
//
// Mocks:
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente via
//     moduleNameMapper en package.json (devuelve un Text).
//   - react-native-safe-area-context: SafeAreaProvider con initialMetrics
//     zero para aserciones estables.
//
// TDD Evidence plan:
//   RED    -> T-TOPBAR-1 y T-TOPBAR-3 fallan (color generico + touch target
//             debajo del minimo WCAG). T-TOPBAR-2, 4, 5, 6 pasan.
//   GREEN  -> tras el refactor, los 6 tests pasan.

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TopBar } from '../../src/componentes/TopBar';

/**
 * Source del TopBar — la mayoria de los tests de craft son REGRESION
 * de la identidad de tokens (no del valor resuelto, sino de la REFERENCIA
 * semantica). Esto es un test arquitectonico: TopBar debe usar
 * COLORS.brandAzulOscuro explicito, no COLORS.primary generico,
 * aunque ambos resuelvan al mismo #093C5D.
 */
const topBarSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/TopBar.tsx'),
  'utf8',
);

const renderConSafeArea = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
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
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ratio de contraste WCAG entre dos hex. */
function contrasteWCAG(hex1: string, hex2: string): number {
  const l1 = luminancia(hex1);
  const l2 = luminancia(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('TopBar — principios impeccable', () => {
  // ── T-TOPBAR-1: brandAzulOscuro explicito en topBarRaiz ──────────────────
  describe('T-TOPBAR-1: topBarRaiz usa COLORS.brandAzulOscuro explicito', () => {
    it('el bloque topBarRaiz referencia COLORS.brandAzulOscuro', () => {
      const match = topBarSource.match(/topBarRaiz:\s*\{([\s\S]*?)\}/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toContain('COLORS.brandAzulOscuro');
    });

    it('el bloque topBarRaiz NO referencia COLORS.primary generico', () => {
      const match = topBarSource.match(/topBarRaiz:\s*\{([\s\S]*?)\}/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).not.toMatch(/\bCOLORS\.primary\b/);
    });
  });

  // ── T-TOPBAR-2: surfaceContainerLowest en topBarDetalle ──────────────────
  describe('T-TOPBAR-2: topBarDetalle usa COLORS.surfaceContainerLowest', () => {
    it('el bloque topBarDetalle referencia COLORS.surfaceContainerLowest', () => {
      const match = topBarSource.match(/topBarDetalle:\s*\{([\s\S]*?)\}/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toContain('COLORS.surfaceContainerLowest');
    });

    it('el bloque topBarDetalle no tiene hardcoded #FFFFFF como backgroundColor', () => {
      const match = topBarSource.match(/topBarDetalle:\s*\{([\s\S]*?)\}/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).not.toMatch(/backgroundColor:\s*['"]#[Ff][Ff]/);
    });
  });

  // ── T-TOPBAR-3: touch target >= 44x44 (WCAG 2.5.5) ──────────────────────
  describe('T-TOPBAR-3: boton de icono back cumple WCAG touch target', () => {
    // Verificamos el StyleSheet via source-regex porque jest-expo tiene
    // inconvenientes con findAllByType(Pressable) cuando el componente
    // vive dentro de un SafeAreaProvider. La identidad de tokens es
    // exactamente lo que queremos asegurar.

    it('el bloque iconBtn tiene width >= 44 en el StyleSheet', () => {
      const match = topBarSource.match(/iconBtn:\s*\{([\s\S]*?)\n\s*\},?/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toMatch(/width:\s*4[4-9]/);
    });

    it('el bloque iconBtn tiene height >= 44 en el StyleSheet', () => {
      const match = topBarSource.match(/iconBtn:\s*\{([\s\S]*?)\n\s*\},?/);
      expect(match).not.toBeNull();
      const body = match![1];
      expect(body).toMatch(/height:\s*4[4-9]/);
    });

    it('ningun width/height del bloque iconBtn es menor que 44', () => {
      const match = topBarSource.match(/iconBtn:\s*\{([\s\S]*?)\n\s*\},?/);
      expect(match).not.toBeNull();
      const body = match![1];
      const widthMatch = body.match(/width:\s*(\d+)/);
      const heightMatch = body.match(/height:\s*(\d+)/);
      expect(widthMatch).not.toBeNull();
      expect(heightMatch).not.toBeNull();
      expect(Number(widthMatch![1])).toBeGreaterThanOrEqual(44);
      expect(Number(heightMatch![1])).toBeGreaterThanOrEqual(44);
    });
  });

  // ── T-TOPBAR-4: sin border+shadow combo (anti-pattern ghost) ─────────────
  describe('T-TOPBAR-4: no ghost-card (border + shadow combo)', () => {
    it('ningun bloque combina borderWidth >= 1 con elevation a menos de 200 chars', () => {
      // Anti-pattern ghost: borderWidth:N + elevation:M (< 200 chars de
      // distancia) en el mismo bloque. Buscamos la combinacion prohibida.
      // Patron: borderWidth:\s*[1-9] ... elevation:\s*[1-9]
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?elevation:\s*[1-9]/;
      expect(topBarSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque combina borderWidth >= 1 con shadowRadius a menos de 200 chars', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?shadowRadius:\s*[1-9]/;
      expect(topBarSource).not.toMatch(ghostPattern);
    });
  });

  // ── T-TOPBAR-5: sin ALL CAPS residual ────────────────────────────────────
  describe('T-TOPBAR-5: sin textTransform: uppercase', () => {
    it('el source no contiene textTransform: uppercase', () => {
      expect(topBarSource).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });
  });

  // ── T-TOPBAR-6: contraste WCAG AA ────────────────────────────────────────
  describe('T-TOPBAR-6: contraste onPrimary/brandAzulOscuro >= 4.5:1', () => {
    it('el ratio entre #FFFFFF (onPrimary) y #093C5D (brandAzulOscuro) es >= 4.5', () => {
      const ratio = contrasteWCAG('#FFFFFF', '#093C5D');
      // El valor calculado es ~11.4:1 — muy por encima del minimo WCAG AA.
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('el titulo raiz (sobre el fondo brandAzulOscuro) usa COLORS.onPrimary', () => {
      renderConSafeArea(<TopBar titulo="Inicio" />);
      const titulo = screen.getByText('Inicio');
      const flat = flattenStyle(titulo.props.style);
      expect(flat.color).toBe('#FFFFFF');
    });
  });

  // ── D7: props testID/testIDBack (parametros-tarifa-impeccable-v2) ─────────
  describe('D7: props opcionales testID y testIDBack se propagan al DOM', () => {
    it('el contenedor exterior expone el testID pasado via prop testID', () => {
      // Backward-compatible: el prop testID es opcional. Cuando se pasa,
      // se aplica al View raiz para que callers puedan hacer
      // `getByTestId('param-topbar')`.
      const { UNSAFE_getByProps } = renderConSafeArea(
        <TopBar titulo="Parámetros" testID="param-topbar" />,
      );
      const root = UNSAFE_getByProps({ testID: 'param-topbar' });
      expect(root).toBeTruthy();
    });

    it('el Pressable de back expone el testID pasado via prop testIDBack', () => {
      // D7: el back button (Pressable) acepta un testID opcional para
      // que callers (ej: ParametrosTarifa) puedan resolver
      // `getByTestId('param-topbar-back')` y testear el click.
      const { UNSAFE_getByProps } = renderConSafeArea(
        <TopBar titulo="Parámetros" onBack={() => undefined} testIDBack="param-topbar-back" />,
      );
      const back = UNSAFE_getByProps({ testID: 'param-topbar-back' });
      expect(back).toBeTruthy();
    });

    it('cuando NO se pasan testID/testIDBack, los componentes no tienen esos testIDs (default zero-cost)', () => {
      // Backward-compatible: callers existentes (los 4+ que ya usan
      // TopBar sin estos props) deben seguir funcionando sin esos
      // testIDs colgando en el árbol.
      const { UNSAFE_queryByProps } = renderConSafeArea(
        <TopBar titulo="Inicio" onBack={() => undefined} />,
      );
      expect(UNSAFE_queryByProps({ testID: 'param-topbar' })).toBeNull();
      expect(UNSAFE_queryByProps({ testID: 'param-topbar-back' })).toBeNull();
    });
  });

  // ── Sanidad: el componente sigue siendo TopBar ───────────────────────────
  describe('sanidad', () => {
    it('exporta TopBar como componente nominal', () => {
      expect(typeof TopBar).toBe('function');
    });

    it('no usa ALL CAPS en el titulo raiz', () => {
      renderConSafeArea(<TopBar titulo="Sincronización" />);
      // El Text con el titulo no debe tener textTransform: uppercase.
      const titulo = screen.getByText('Sincronización');
      const flat = flattenStyle(titulo.props.style);
      expect(flat.textTransform).not.toBe('uppercase');
    });
  });
});
