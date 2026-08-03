// mobile/__tests__/componentes/FooterApp.test.tsx
//
// Tests contractuales de FooterApp — componente actualmente desactivado
// que retorna null. Reservado para evitar romper los 14 imports que las
// pantallas tienen hoy (`<FooterApp />` despues del ScrollView).
//
// Antes de este refactor, el comentario del componente era minimal:
//   "FooterApp — desactivado. Retorna null para no mostrar el banner de versión."
// Ahora ampliamos el comentario y agregamos tests de regresion que
// garantizan:
//   - Si alguien reactiva el footer, NO hardcodea hex.
//   - NO introduce ALL CAPS.
//   - NO introduce ghost-card (border + shadow combo).
//   - El componente sigue retornando null (contrato actual).
//
// Cobertura de principios impeccable:
//   T-FOOTER-1   Sin hex hardcoded en backgroundColor/borderColor/color.
//   T-FOOTER-2   Sin textTransform: uppercase (ALL CAPS ban).
//   T-FOOTER-3   Sin border + shadow combo (ghost-card ban) si se reactiva.
//   T-FOOTER-4   El componente retorna null (contrato actual preservado).
//   T-FOOTER-5   Esta exportado como named export FooterApp.
//
// Decisión:
//   Por ahora FooterApp queda como null — el usuario pidió
//   "dejarlo así pero documentar en un comment". Este test es la red
//   de seguridad: si alguien reactiva el contenido en el futuro, las
//   primeras cosas que rompe son las regresiones de craft.

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';

import { FooterApp } from '../../src/componentes/FooterApp';

const footerSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/FooterApp.tsx'),
  'utf8',
);

describe('FooterApp — principios impeccable', () => {
  // ── T-FOOTER-1: sin hex hardcoded ────────────────────────────────────────
  describe('T-FOOTER-1: source sin hex hardcoded en estilos', () => {
    it('ninguna backgroundColor usa hex literal', () => {
      const hexBg = /backgroundColor:\s*['"]#[0-9a-fA-F]{3,8}['"]/;
      expect(footerSource).not.toMatch(hexBg);
    });

    it('ninguna borderColor usa hex literal', () => {
      const hexBorder = /borderColor:\s*['"]#[0-9a-fA-F]{3,8}['"]/;
      expect(footerSource).not.toMatch(hexBorder);
    });

    it('ninguna color (de Text) usa hex literal', () => {
      const hexColor = /\bcolor:\s*['"]#[0-9a-fA-F]{3,8}['"]/;
      expect(footerSource).not.toMatch(hexColor);
    });
  });

  // ── T-FOOTER-2: sin ALL CAPS ─────────────────────────────────────────────
  describe('T-FOOTER-2: source sin textTransform: uppercase', () => {
    it('el codigo (no comentarios) no contiene textTransform: uppercase', () => {
      const sinComentarios = footerSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });
  });

  // ── T-FOOTER-3: sin ghost-card ───────────────────────────────────────────
  describe('T-FOOTER-3: source sin border + shadow combo', () => {
    it('ningun bloque combina borderWidth >= 1 con elevation', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?elevation:\s*[1-9]/;
      expect(footerSource).not.toMatch(ghostPattern);
    });

    it('ningun bloque combina borderWidth >= 1 con shadowRadius', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?shadowRadius:\s*[1-9]/;
      expect(footerSource).not.toMatch(ghostPattern);
    });
  });

  // ── T-FOOTER-4: contrato preservado ──────────────────────────────────────
  describe('T-FOOTER-4: contrato actual preservado (retorna null)', () => {
    it('renderiza un subtree vacio (null)', () => {
      const { toJSON } = render(<FooterApp />);
      const tree = toJSON();
      // RN renderiza `null` como `null` (no como View vacio). El toJSON
      // puede devolver null directamente.
      expect(tree === null || tree === undefined).toBe(true);
    });
  });

  // ── T-FOOTER-5: export nominal ───────────────────────────────────────────
  describe('T-FOOTER-5: export nominal', () => {
    it('exporta FooterApp como componente nominal', () => {
      expect(typeof FooterApp).toBe('function');
    });

    it('el componente se llama FooterApp (no anonimo)', () => {
      expect(FooterApp.name).toBe('FooterApp');
    });
  });

  // ── Documentacion: comentario amplio en el source ────────────────────────
  describe('documentacion del source', () => {
    it('el comentario JSDoc explica el por que del null', () => {
      // Patron: bloque /** ... */ al inicio del archivo con la palabra
      // "desactivado" o "null" para que un futuro dev entienda la decision.
      const comentarioJSDoc = footerSource.match(/^\s*\/\*\*([\s\S]*?)\*\//);
      expect(comentarioJSDoc).not.toBeNull();
      const cuerpo = comentarioJSDoc![1].toLowerCase();
      const mencionaDecision = cuerpo.includes('desactivado') || cuerpo.includes('null');
      expect(mencionaDecision).toBe(true);
    });
  });
});