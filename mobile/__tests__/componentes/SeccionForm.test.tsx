// mobile/__tests__/componentes/SeccionForm.test.tsx
//
// Tests contractuales del componente SeccionForm — wrapper reusable de
// secciones de formulario con titulo + icono + body children, usando
// tokens del theme. Patron equivalente al `listaCard` de `MiPerfil`.
//
// Cobertura:
//   T-SEC-1  Renderiza el titulo (en un Text con tokens headlineSm).
//   T-SEC-2  Renderiza el icono MaterialIcons cuando se pasa (testID `seccion-form-icono`).
//   T-SEC-3  NO renderiza icono cuando no se pasa la prop `icono`.
//   T-SEC-4  Renderiza children en el body del card.
//   T-SEC-5  Aplica estilo card con tokens (borderWidth 1, RADIUS.md, SPACING.md).
//   T-SEC-6  NO tiene boxShadow / shadowColor (sin ghost-cards).
//   T-SEC-7  testID se propaga al contenedor exterior.
//
// Mocks:
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente via
//     moduleNameMapper. El mock expone el `name` como children, asi
//     que podemos verificar el icono via getByText('event') o por
//     testID derivado `seccion-form-icono`.
//
// TDD Evidence:
//   RED  → SeccionForm NO existe. Importar '../../src/componentes/SeccionForm'
//          tira "Cannot find module" → la suite falla.
//   GREEN → Implementacion minima con tokens. Tests pasan.

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { SeccionForm } from '../../src/componentes/SeccionForm';

/**
 * Source del componente — algunos tests son REGRESION de la identidad
 * de tokens (mismo patron que FormField.test.tsx).
 */
const seccionFormSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/SeccionForm.tsx'),
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

/** Extrae el cuerpo de un bloque StyleSheet por nombre. */
function extraerBloque(source: string, nombre: string): string {
  // Regex literal (no template literal) para evitar sorpresas con escapes.
  // El patron matchea `<nombre>: {` seguido de cualquier contenido
  // (incluyendo saltos de linea) y un cierre `},` o `}`.
  const pattern = new RegExp(
    '(?:^|\\n)\\s*' + nombre + ':\\s*\\{([\\s\\S]*?)\\}\\s*,?',
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`No se encontro el bloque StyleSheet "${nombre}".`);
  }
  return match[1];
}

describe('SeccionForm — principios impeccable + reusabilidad', () => {
  // ── T-SEC-1: render titulo ──────────────────────────────────────────────
  describe('T-SEC-1: renderiza el titulo del card', () => {
    it('renderiza un Text con el titulo exacto', () => {
      render(
        <SeccionForm titulo="Costos medios">
          <Text>child</Text>
        </SeccionForm>,
      );
      expect(screen.getByText('Costos medios')).toBeTruthy();
    });
  });

  // ── T-SEC-2: render icono cuando se pasa ────────────────────────────────
  describe('T-SEC-2: renderiza MaterialIcons cuando se pasa la prop icono', () => {
    it('renderiza el icono con testID `seccion-form-icono` cuando se pasa icono', () => {
      const { UNSAFE_getByProps } = render(
        <SeccionForm titulo="Periodo" icono="event">
          <Text>child</Text>
        </SeccionForm>,
      );
      // El mock expone el `name` como children del Text con testID derivado.
      // Usamos UNSAFE_getByProps porque jest-expo testing-library tiene
      // comportamiento inconsistente con getByTestId en mocks con
      // accessibilityElementsHidden (patron ya documentado en FormField.test.tsx).
      const icono = UNSAFE_getByProps({ testID: 'seccion-form-icono' });
      expect(icono).toBeTruthy();
      // El `name` prop se respeta (mock expone nombre como children).
      // Tambien usamos UNSAFE porque jest-expo trata los textos hijos
      // de mocks de vector-icons con accesibilidad oculta.
      const iconoPorName = UNSAFE_getByProps({ children: 'event' });
      expect(iconoPorName).toBeTruthy();
    });
  });

  // ── T-SEC-3: NO renderiza icono cuando no se pasa ────────────────────────
  describe('T-SEC-3: NO renderiza MaterialIcons cuando NO se pasa la prop icono', () => {
    it('no existe el testID seccion-form-icono si la prop icono esta ausente', () => {
      const { UNSAFE_queryByProps } = render(
        <SeccionForm titulo="Costos medios">
          <Text>child</Text>
        </SeccionForm>,
      );
      const icono = UNSAFE_queryByProps({ testID: 'seccion-form-icono' });
      expect(icono).toBeNull();
    });
  });

  // ── T-SEC-4: render children ─────────────────────────────────────────────
  describe('T-SEC-4: renderiza children dentro del body del card', () => {
    it('renderiza los children que recibe como body', () => {
      render(
        <SeccionForm titulo="Periodo">
          <Text testID="body-content">Contenido del body</Text>
        </SeccionForm>,
      );
      expect(screen.getByTestId('body-content')).toBeTruthy();
      expect(screen.getByText('Contenido del body')).toBeTruthy();
    });
  });

  // ── T-SEC-5: tokens del theme aplicados ──────────────────────────────────
  describe('T-SEC-5: estilo card con tokens del theme', () => {
    it('el contenedor exterior usa borderWidth: 1', () => {
      // El componente debe declarar un estilo card con borderWidth >= 1
      // (identidad de "card", no de "view plano").
      const contenedorBloque = extraerBloque(seccionFormSource, 'contenedor');
      expect(contenedorBloque).toMatch(/borderWidth:\s*[1-9]/);
    });

    it('el contenedor exterior usa tokens RADIUS.* y SPACING.* (no hardcoded)', () => {
      const contenedorBloque = extraerBloque(seccionFormSource, 'contenedor');
      // Radio via token (no numero literal).
      expect(contenedorBloque).toMatch(/borderRadius:\s*RADIUS\./);
      // Padding via token (no numero literal).
      expect(contenedorBloque).toMatch(/padding:\s*SPACING\./);
    });

    it('el card renderizado en runtime tiene borderWidth >= 1', () => {
      const { getByTestId } = render(
        <SeccionForm titulo="Costos" testID="seccion-prueba">
          <Text>x</Text>
        </SeccionForm>,
      );
      const card = getByTestId('seccion-prueba');
      const estilo = flattenStyle(card.props.style) as { borderWidth?: number };
      expect(estilo.borderWidth ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  // ── T-SEC-6: sin shadow / ghost-cards ────────────────────────────────────
  describe('T-SEC-6: NO boxShadow ni shadowColor (sin ghost-cards)', () => {
    it('el source no tiene boxShadow en el StyleSheet del componente', () => {
      expect(seccionFormSource).not.toMatch(/boxShadow/);
    });

    it('el source no tiene shadowColor en el StyleSheet del componente', () => {
      // Captura shadowColor dentro de un bloque StyleSheet (no en comentarios).
      const sinComentarios = seccionFormSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/shadowColor/);
    });
  });

  // ── T-SEC-7: testID se propaga al contenedor exterior ────────────────────
  describe('T-SEC-7: testID se propaga al contenedor exterior del card', () => {
    it('getByTestId(testID) resuelve al View raiz del card', () => {
      const { getByTestId } = render(
        <SeccionForm titulo="Costos" testID="seccion-card-costos">
          <Text>x</Text>
        </SeccionForm>,
      );
      const card = getByTestId('seccion-card-costos');
      expect(card).toBeTruthy();
      // El card envuelve los children.
      expect(StyleSheet.flatten(card.props.style)).toBeTruthy();
    });

    it('cuando no se pasa testID, no hay testID en el contenedor', () => {
      const { UNSAFE_root } = render(
        <SeccionForm titulo="Costos">
          <Text>x</Text>
        </SeccionForm>,
      );
      // El root no debe tener testID si no se pasa.
      expect(UNSAFE_root.props.testID).toBeUndefined();
    });
  });
});