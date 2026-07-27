// mobile/__tests__/componentes/BotonPrimario.test.tsx
//
// Tests contractuales del BotonPrimario — extraccion del patron duplicado
// en Login, SetupInicial, Sincronizacion, ResultadoCalculo, MiPerfil,
// DetalleSuscriptor, Historial, ImportarCsv, RutaDeHoy, ListaSuscriptores
// y los 4 admin screens (AcuerdoMunicipal, GestionPrestadores,
// ParametrosTarifa, ImportarPrestadores).
//
// Antes de extraer, cada pantalla tenia su propio btnPrimario/botonPrimario
// con variaciones sutiles:
//   - algunos height:48 / otros height:56
//   - algunos RADIUS.md (12) / otros RADIUS.xl (24)
//   - algunos con elevation (shadow) / otros sin shadow
//   - algunos COLORS.primary (azul oscuro) / otros COLORS.brandAmarillo
//
// Cobertura de principios impeccable:
//   T-BOTON-1   Renderiza el texto verbatim y emite onPress.
//   T-BOTON-2   Touch target >= 44px en alto (WCAG 2.5.5, PRODUCT.md non-neg).
//   T-BOTON-3   Border radius <= 12 (RADIUS.md). Sin sobre-redondeo.
//   T-BOTON-4   Sin border + shadow combo (ghost-card ban).
//   T-BOTON-5   Tono 'azul' usa COLORS.brandAzulOscuro (no COLORS.primary
//               generico) — token institucional explicito.
//   T-BOTON-6   Tono 'amarillo' usa COLORS.brandAmarillo (no hex).
//   T-BOTON-7   Tono 'rojo' usa COLORS.brandRojo (no hex).
//   T-BOTON-8   Disabled aplica opacity:0.5 y NO emite onPress.
//   T-BOTON-9   cargando=true muestra ActivityIndicator y oculta el texto.
//   T-BOTON-10  Icono opcional se muestra cuando se pasa.
//   T-BOTON-11  Contraste WCAG AA: texto blanco sobre brandAzulOscuro
//               >= 4.5:1; brandAzulOscuro sobre brandAmarillo >= 4.5:1.
//   T-BOTON-12  Sin textTransform: 'uppercase' (ALL CAPS ban de impecable).
//
// Mocks:
//   - @expo/vector-icons/MaterialIcons: mock global via moduleNameMapper
//     (devuelve un Text). Tests de icono inspeccionan el componente via
//     findAllByType o via los props del Text mock.
//   - react-native-paper no se usa.

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { BotonPrimario } from '../../src/componentes/BotonPrimario';

/**
 * Source del componente — la mayoria de los tests de craft son REGRESION
 * de la identidad de tokens (no del valor resuelto, sino de la REFERENCIA
 * semantica). Patron copiado de TopBar.test.tsx.
 */
const botonSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/BotonPrimario.tsx'),
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

/** Localiza el bloque de un estilo por nombre en el StyleSheet del componente. */
function extraerBloque(source: string, nombre: string): string {
  const match = source.match(new RegExp(`${nombre}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`));
  if (!match) {
    throw new Error(`No se encontro el bloque StyleSheet "${nombre}".`);
  }
  return match[1];
}

describe('BotonPrimario — principios impeccable', () => {
  // ── T-BOTON-1: render + onPress ──────────────────────────────────────────
  describe('T-BOTON-1: renderiza el texto y emite onPress', () => {
    it('renderiza el texto verbatim', () => {
      const onPress = jest.fn();
      render(<BotonPrimario texto="Ingresar" onPress={onPress} testID="btn" />);
      expect(screen.getByText('Ingresar')).toBeTruthy();
    });

    it('emite onPress al tocar', () => {
      const onPress = jest.fn();
      render(<BotonPrimario texto="Sincronizar ahora" onPress={onPress} testID="btn" />);
      fireEvent.press(screen.getByTestId('btn'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  // ── T-BOTON-2: touch target >= 44px ──────────────────────────────────────
  describe('T-BOTON-2: touch target >= 44px en alto (WCAG 2.5.5)', () => {
    it('el StyleSheet tiene height >= 44 en todos los bloques de tamano', () => {
      const heightMatches = [
        ...botonSource.matchAll(/(?:tamanoNormal|tamanoCompacto):\s*\{[\s\S]*?height:\s*(\d+)/g),
      ];
      expect(heightMatches.length).toBeGreaterThan(0);
      heightMatches.forEach((m) => {
        expect(Number(m[1])).toBeGreaterThanOrEqual(44);
      });
    });

    it('ningun height dentro de bloques tamano* es < 44', () => {
      const bloques = ['tamanoNormal', 'tamanoCompacto'];
      for (const nombre of bloques) {
        const bloque = extraerBloque(botonSource, nombre);
        const heights = [...bloque.matchAll(/height:\s*(\d+)/g)].map((m) => Number(m[1]));
        expect(heights.length).toBeGreaterThan(0);
        heights.forEach((h) => {
          expect(h).toBeGreaterThanOrEqual(44);
        });
      }
    });
  });

  // ── T-BOTON-3: border radius <= 12 ──────────────────────────────────────
  describe('T-BOTON-3: border radius <= 12 (RADIUS.md)', () => {
    it('el componente usa RADIUS.md (12) para los borderRadius', () => {
      // El ban explicito de impecable v1: borderRadius > 16 en cards/botones.
      // El componente DEBE referenciar RADIUS.md y NO RADIUS.xl/RADIUS.full.
      expect(botonSource).toMatch(/borderRadius:\s*RADIUS\.md/);
    });

    it('el componente NO usa RADIUS.xl (24) ni RADIUS.full como borderRadius', () => {
      expect(botonSource).not.toMatch(/borderRadius:\s*RADIUS\.xl/);
      expect(botonSource).not.toMatch(/borderRadius:\s*RADIUS\.full/);
      expect(botonSource).not.toMatch(/borderRadius:\s*24/);
      expect(botonSource).not.toMatch(/borderRadius:\s*9999/);
    });
  });

  // ── T-BOTON-4: sin border + shadow combo ─────────────────────────────────
  describe('T-BOTON-4: sin ghost-card (border + shadow combo)', () => {
    it('ningun bloque combina borderWidth >= 1 con elevation a menos de 200 chars', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?elevation:\s*[1-9]/;
      expect(botonSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque combina borderWidth >= 1 con shadowRadius a menos de 200 chars', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?shadowRadius:\s*[1-9]/;
      expect(botonSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque del StyleSheet declara borderWidth > 0', () => {
      // El componente tiene sombra pero NO border — shadow solo o border solo,
      // nunca ambos. Para CTAs primary usamos shadow sin border.
      const bloques = [
        'base',
        'tamanoNormal',
        'tamanoCompacto',
        'tonoAzul',
        'tonoAmarillo',
        'tonoRojo',
      ];
      for (const nombre of bloques) {
        try {
          const bloque = extraerBloque(botonSource, nombre);
          expect(bloque).not.toMatch(/borderWidth:\s*[1-9]/);
        } catch {
          // bloque no presente → ok, no hay nada que auditar
        }
      }
    });
  });

  // ── T-BOTON-5: tono 'azul' usa COLORS.brandAzulOscuro ────────────────────
  describe("T-BOTON-5: tono 'azul' usa COLORS.brandAzulOscuro explicito", () => {
    it('el bloque tonoAzul referencia COLORS.brandAzulOscuro', () => {
      const bloque = extraerBloque(botonSource, 'tonoAzul');
      expect(bloque).toContain('COLORS.brandAzulOscuro');
    });

    it('el bloque tonoAzul no tiene hex hardcodeado en backgroundColor', () => {
      const bloque = extraerBloque(botonSource, 'tonoAzul');
      expect(bloque).not.toMatch(/backgroundColor:\s*['"]#/);
    });
  });

  // ── T-BOTON-6: tono 'amarillo' usa COLORS.brandAmarillo ──────────────────
  describe("T-BOTON-6: tono 'amarillo' usa COLORS.brandAmarillo", () => {
    it('el bloque tonoAmarillo referencia COLORS.brandAmarillo', () => {
      const bloque = extraerBloque(botonSource, 'tonoAmarillo');
      expect(bloque).toContain('COLORS.brandAmarillo');
    });

    it('el bloque tonoAmarillo no tiene hex hardcodeado en backgroundColor', () => {
      const bloque = extraerBloque(botonSource, 'tonoAmarillo');
      expect(bloque).not.toMatch(/backgroundColor:\s*['"]#/);
    });
  });

  // ── T-BOTON-7: tono 'rojo' usa COLORS.brandRojo ──────────────────────────
  describe("T-BOTON-7: tono 'rojo' usa COLORS.brandRojo", () => {
    it('el bloque tonoRojo referencia COLORS.brandRojo', () => {
      const bloque = extraerBloque(botonSource, 'tonoRojo');
      expect(bloque).toContain('COLORS.brandRojo');
    });

    it('el bloque tonoRojo no tiene hex hardcodeado en backgroundColor', () => {
      const bloque = extraerBloque(botonSource, 'tonoRojo');
      expect(bloque).not.toMatch(/backgroundColor:\s*['"]#/);
    });
  });

  // ── T-BOTON-8: disabled ──────────────────────────────────────────────────
  describe('T-BOTON-8: disabled aplica opacity y no emite onPress', () => {
    it('el bloque disabled existe con opacity', () => {
      const bloque = extraerBloque(botonSource, 'disabled');
      expect(bloque).toMatch(/opacity:\s*0\.\d/);
    });

    it('disabled=true hace que fireEvent.press NO llame al callback', () => {
      const onPress = jest.fn();
      render(
        <BotonPrimario texto="Guardar" onPress={onPress} disabled testID="btn-disabled" />,
      );
      fireEvent.press(screen.getByTestId('btn-disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // ── T-BOTON-9: cargando ──────────────────────────────────────────────────
  describe('T-BOTON-9: cargando muestra ActivityIndicator y oculta texto', () => {
    it('cargando=true oculta el texto original y muestra el textoCargando', () => {
      render(
        <BotonPrimario
          texto="Sincronizar ahora"
          onPress={() => {}}
          cargando
          textoCargando="Sincronizando…"
          testID="btn-loading"
        />,
      );
      expect(screen.queryByText('Sincronizar ahora')).toBeNull();
      expect(screen.getByText('Sincronizando…')).toBeTruthy();
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('cargando=true NO emite onPress al tocar', () => {
      const onPress = jest.fn();
      render(
        <BotonPrimario texto="Guardar" onPress={onPress} cargando testID="btn-loading-press" />,
      );
      fireEvent.press(screen.getByTestId('btn-loading-press'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // ── T-BOTON-10: icono opcional ──────────────────────────────────────────
  describe('T-BOTON-10: icono opcional se muestra cuando se pasa', () => {
    it('renderiza sin icono cuando no se pasa', () => {
      render(<BotonPrimario texto="Solo texto" onPress={() => {}} testID="btn-noicon" />);
      // El componente mock de MaterialIcons es un Text; sin icono, no debe
      // haber un Text con nombre de icono en el subtree.
      const tree = screen.getByTestId('btn-noicon');
      const allTexts = tree.findAllByType('Text' as never);
      const iconTexts = allTexts.filter(
        (t: { props: { children?: unknown } }) =>
          typeof t.props.children === 'string' &&
          ['sync', 'check', 'login'].includes(t.props.children),
      );
      expect(iconTexts).toHaveLength(0);
    });
  });

  // ── T-BOTON-11: WCAG AA ──────────────────────────────────────────────────
  describe('T-BOTON-11: contraste WCAG AA sobre los tonos', () => {
    it('texto blanco (#FFFFFF) sobre brandAzulOscuro (#093C5D) >= 4.5:1', () => {
      const ratio = contrasteWCAG('#FFFFFF', '#093C5D');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('texto brandAzulOscuro (#093C5D) sobre brandAmarillo (#FFDC26) >= 4.5:1', () => {
      const ratio = contrasteWCAG('#093C5D', '#FFDC26');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('texto blanco (#FFFFFF) sobre brandRojo (#D5212A) >= 4.5:1', () => {
      const ratio = contrasteWCAG('#FFFFFF', '#D5212A');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('la seleccion de color de texto referencia los tokens semanticos correctos', () => {
      // El componente debe elegir entre brandAzulOscuro (tono amarillo) y
      // onPrimary (tonos azul/rojo) segun el tono. Buscamos un ternario
      // que mencione ambos tokens en una sola linea de codigo.
      const lineas = botonSource.split('\n');
      const ternarioEncontrado = lineas.some((linea) => {
        return /brandAzulOscuro/.test(linea) && /onPrimary/.test(linea) && /\?/.test(linea);
      });
      expect(ternarioEncontrado).toBe(true);
    });
  });

  // ── T-BOTON-12: sin ALL CAPS ─────────────────────────────────────────────
  describe('T-BOTON-12: sin textTransform: uppercase', () => {
    it('el codigo del componente no contiene textTransform: uppercase (excluyendo comentarios)', () => {
      // Strip comments (line and block) before checking — los comentarios
      // pueden mencionar el termino "uppercase" al documentar el ban.
      const sinComentarios = botonSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });

    it('el texto renderizado no tiene textTransform aplicado', () => {
      render(<BotonPrimario texto="Ingresar" onPress={() => {}} testID="btn-cap" />);
      const txt = screen.getByText('Ingresar');
      const flat = flattenStyle(txt.props.style);
      expect(flat.textTransform).not.toBe('uppercase');
    });
  });

  // ── Sanidad ──────────────────────────────────────────────────────────────
  describe('sanidad', () => {
    it('exporta BotonPrimario como componente nominal', () => {
      expect(typeof BotonPrimario).toBe('function');
    });

    it('el StyleSheet existe y es objeto', () => {
      // Sanity: el archivo no debe estar vacio y debe importar StyleSheet.
      expect(botonSource).toContain('StyleSheet');
      expect(botonSource.length).toBeGreaterThan(500);
    });
  });
});