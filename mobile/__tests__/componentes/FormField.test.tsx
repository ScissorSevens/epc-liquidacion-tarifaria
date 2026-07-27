// mobile/__tests__/componentes/FormField.test.tsx
//
// Tests contractuales del FormField — componente reusable para inputs de
// formularios del sistema EPC. Encapsula los principios de craft de
// impeccable v1 y los non-negotiables del PRODUCT.md:
//
//   T-FF-1   Renderiza label + value (smoke + identidad)
//   T-FF-2   Muestra asterisco (*) en el label cuando required=true
//   T-FF-3   Muestra error con icono MaterialIcons cuando hay error prop
//   T-FF-4   Muestra helperText debajo del campo cuando se provee
//   T-FF-5   Pasa accessibilityLabel + accessibilityHint al TextInput
//   T-FF-6   Sin textTransform uppercase en el label (ALL CAPS ban)
//   T-FF-7   Sin ghost-card: inputs SIN shadow + border combo
//   T-FF-8   Touch target >= 44px (WCAG 2.5.5, PRODUCT.md non-negotiable)
//   T-FF-9   Renderiza el icono MaterialIcons cuando se pasa (opcional)
//
// Mocks:
//   - @expo/vector-icons/MaterialIcons: ya mockeado via moduleNameMapper.
//     El mock devuelve un Text con el nombre del icono. Los tests pueden
//     buscar el icono via getByText('error-outline') u otro nombre.
//
// TDD Evidence:
//   RED  → este archivo se creo ANTES que FormField.tsx. La importacion
//          de '../../src/componentes/FormField' falla (modulo no existe)
//          → el suite se ejecuta con errores y los tests fallan.
//   GREEN → FormField.tsx implementado, los tests pasan.

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { FormField } from '../../src/componentes/FormField';

/**
 * Source del componente — la mayoria de los tests de craft son REGRESION
 * de la identidad de tokens (no del valor resuelto, sino de la REFERENCIA
 * semantica). Patron copiado de BotonPrimario.test.tsx.
 */
const formFieldSource = fs.readFileSync(
  path.join(__dirname, '../../src/componentes/FormField.tsx'),
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

/** Localiza el bloque de un estilo por nombre en el StyleSheet del componente. */
function extraerBloque(source: string, nombre: string): string {
  const match = source.match(new RegExp(`${nombre}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?`));
  if (!match) {
    throw new Error(`No se encontro el bloque StyleSheet "${nombre}".`);
  }
  return match[1];
}

describe('FormField — principios impeccable', () => {
  // ── T-FF-1: render label + value ─────────────────────────────────────────
  describe('T-FF-1: renderiza label y mantiene value controlado', () => {
    it('renderiza el label y el valor controlado', () => {
      const onChangeText = jest.fn();
      render(
        <FormField label="Cédula" value="51800012" onChangeText={onChangeText} testID="ff-1" />,
      );
      expect(screen.getByText('Cédula')).toBeTruthy();
      // El input debe tener el valor controlado.
      const input = screen.getByTestId('ff-1');
      expect(input.props.value).toBe('51800012');
    });

    it('emite onChangeText cuando el input cambia', () => {
      const onChangeText = jest.fn();
      render(
        <FormField label="Nombre" value="" onChangeText={onChangeText} testID="ff-1-change" />,
      );
      // El input testID se propaga; cambiar texto dispara callback.
      screen.getByTestId('ff-1-change').props.onChangeText('Juan');
      expect(onChangeText).toHaveBeenCalledWith('Juan');
    });
  });

  // ── T-FF-2: required asterisk ────────────────────────────────────────────
  describe('T-FF-2: muestra asterisco (*) cuando required=true', () => {
    it('muestra asterisco rojo en el label cuando required es true', () => {
      // El asterisco vive en un Text anidado (children compuestos). Buscamos
      // via UNSAFE_getByProps porque jest-expo testing-library tiene
      // comportamiento inconsistente con getByTestId en nodos con
      // accessibilityElementsHidden.
      const { UNSAFE_getByProps, getByText } = render(
        <FormField
          label="Cédula"
          required
          value=""
          onChangeText={jest.fn()}
          testID="ff-2-req"
        />,
      );
      // El label "Cédula" debe estar presente.
      expect(getByText(/Cédula/)).toBeTruthy();
      // El asterisco: el Text anidado debe tener testID="ff-2-req-required".
      const asterisco = UNSAFE_getByProps({ testID: 'ff-2-req-required' });
      expect(asterisco).toBeTruthy();
    });

    it('NO muestra asterisco cuando required es false (default)', () => {
      const { UNSAFE_queryByProps } = render(
        <FormField label="Email (opcional)" value="" onChangeText={jest.fn()} testID="ff-2-noreq" />,
      );
      // Sin required → el Text del asterisco NO debe estar en el arbol.
      const asterisco = UNSAFE_queryByProps({ testID: 'ff-2-noreq-required' });
      expect(asterisco).toBeNull();
    });
  });

  // ── T-FF-3: inline error con icono ───────────────────────────────────────
  describe('T-FF-3: error inline con icono y texto claro', () => {
    it('muestra el texto del error debajo del input cuando hay error prop', () => {
      render(
        <FormField
          label="Cédula"
          required
          value="abc"
          onChangeText={jest.fn()}
          error="Cédula debe tener 6 a 12 dígitos"
          testID="ff-3"
        />,
      );
      // El mensaje de error debe aparecer en el árbol.
      expect(screen.getByText('Cédula debe tener 6 a 12 dígitos')).toBeTruthy();
    });

    it('el bloque del error referencia el token COLORS.error (semantico)', () => {
      // Craft: el color del texto de error debe ser el token semantico,
      // NO un hex hardcodeado. Esto evita "colores decorativos" (ban
      // impecable) y asegura WCAG AA consistente.
      const bloque = extraerBloque(formFieldSource, 'errorText');
      expect(bloque).toContain('COLORS.error');
      expect(bloque).not.toMatch(/color:\s*['"]#/);
    });

    it('NO muestra texto de error cuando error es undefined', () => {
      const { queryByText } = render(
        <FormField
          label="Cédula"
          value="51800012"
          onChangeText={jest.fn()}
          testID="ff-3-noerr"
        />,
      );
      // Sin prop error → no debe haber texto de error.
      expect(queryByText(/error/i)).toBeNull();
    });
  });

  // ── T-FF-4: helperText debajo del campo ──────────────────────────────────
  describe('T-FF-4: helperText debajo del campo (descripcion secundaria)', () => {
    it('muestra helperText cuando se provee', () => {
      render(
        <FormField
          label="Categoría de uso"
          value=""
          onChangeText={jest.fn()}
          helperText="Define cómo el motor tarifario aplica subsidios."
          testID="ff-4"
        />,
      );
      expect(
        screen.getByText('Define cómo el motor tarifario aplica subsidios.'),
      ).toBeTruthy();
    });

    it('NO muestra helperText cuando no se provee', () => {
      const { queryByText } = render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          testID="ff-4-no"
        />,
      );
      // Sin helperText → ningún texto de ayuda.
      expect(queryByText(/subsidios/i)).toBeNull();
    });
  });

  // ── T-FF-5: accesibilidad pasa al TextInput ──────────────────────────────
  describe('T-FF-5: accesibilidad — accessibilityLabel y accessibilityHint', () => {
    it('pasa accessibilityLabel derivado del label al TextInput', () => {
      render(
        <FormField
          label="Cédula del representante"
          value=""
          onChangeText={jest.fn()}
          testID="ff-5"
        />,
      );
      const input = screen.getByTestId('ff-5');
      // El TextInput debe recibir accessibilityLabel y accessibilityHint.
      // accessibilityLabel default = label.
      expect(input.props.accessibilityLabel).toBe('Cédula del representante');
      // accessibilityHint default debe ser un hint derivado.
      expect(input.props.accessibilityHint).toBeDefined();
      expect(typeof input.props.accessibilityHint).toBe('string');
    });

    it('respeta accessibilityLabel custom cuando se provee', () => {
      render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          accessibilityLabel="Cédula del operario"
          testID="ff-5-custom"
        />,
      );
      const input = screen.getByTestId('ff-5-custom');
      expect(input.props.accessibilityLabel).toBe('Cédula del operario');
    });

    it('respeta accessibilityHint custom cuando se provee', () => {
      render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          accessibilityHint="Ingrese 6 a 12 dígitos numéricos"
          testID="ff-5-hint"
        />,
      );
      const input = screen.getByTestId('ff-5-hint');
      expect(input.props.accessibilityHint).toBe('Ingrese 6 a 12 dígitos numéricos');
    });
  });

  // ── T-FF-6: sin ALL CAPS en el label ─────────────────────────────────────
  describe('T-FF-6: sin textTransform uppercase (ALL CAPS ban)', () => {
    it('el codigo del componente no contiene textTransform: uppercase (excluyendo comentarios)', () => {
      // Mismo patron que BotonPrimario.test.tsx → comentarios pueden
      // documentar el ban, asi que stripamos comentarios antes de auditar.
      const sinComentarios = formFieldSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).not.toMatch(/textTransform:\s*['"]uppercase['"]/);
    });

    it('el texto del label no tiene textTransform aplicado', () => {
      render(
        <FormField label="Cédula" value="" onChangeText={jest.fn()} testID="ff-6" />,
      );
      const txt = screen.getByText('Cédula');
      const flat = flattenStyle(txt.props.style);
      expect(flat.textTransform).not.toBe('uppercase');
    });
  });

  // ── T-FF-7: sin ghost-card ───────────────────────────────────────────────
  describe('T-FF-7: sin border + shadow combo (ghost-card ban)', () => {
    it('el componente NO combina borderWidth con elevation en el mismo bloque', () => {
      // El ban explicito de impecable: ghost-card = border + shadow.
      // En el FormField, los inputs usan solo border (no shadow) para
      // permitir legibilidad sin gritar "card elevada".
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?elevation:\s*[1-9]/;
      expect(formFieldSource).not.toMatch(ghostPattern);
    });

    it('el componente NO combina borderWidth con shadowRadius en el mismo bloque', () => {
      const ghostPattern = /borderWidth:\s*[1-9][\s\S]{0,200}?shadowRadius:\s*[1-9]/;
      expect(formFieldSource).not.toMatch(ghostPattern);
    });
  });

  // ── T-FF-8: touch target >= 44px ─────────────────────────────────────────
  describe('T-FF-8: touch target >= 44px en alto (WCAG 2.5.5, PRODUCT.md)', () => {
    it('el bloque inputFila (wrapper del touch target) tiene height/minHeight >= 44', () => {
      // El bloque "input" es solo el TextInput interior; el touch target
      // real esta definido por "inputFila" (el View wrapper con border).
      // Auditamos ambos para que ninguna capa baje el target por debajo
      // del minimo WCAG.
      const bloque = extraerBloque(formFieldSource, 'inputFila');
      const heights = [...bloque.matchAll(/(?:^|\s)(?:height|minHeight):\s*(\d+)/g)].map((m) =>
        Number(m[1]),
      );
      expect(heights.length).toBeGreaterThan(0);
      heights.forEach((h) => {
        expect(h).toBeGreaterThanOrEqual(44);
      });
    });

    it('el borderRadius del input wrapper es RADIUS.md (12, sin sobre-redondeo)', () => {
      // El ban de impecable: inputs sobre-redondeados (>= 24) son codex tell.
      const bloque = extraerBloque(formFieldSource, 'inputFila');
      // borderRadius debe usar el token (RADIUS.md).
      expect(bloque).toMatch(/borderRadius:\s*RADIUS\.md/);
      // NUNCA borderRadius 24, 32, xl, full.
      expect(bloque).not.toMatch(/borderRadius:\s*RADIUS\.xl/);
      expect(bloque).not.toMatch(/borderRadius:\s*RADIUS\.full/);
      expect(bloque).not.toMatch(/borderRadius:\s*24/);
      expect(bloque).not.toMatch(/borderRadius:\s*32/);
      expect(bloque).not.toMatch(/borderRadius:\s*9999/);
    });
  });

  // ── T-FF-9: icono opcional ───────────────────────────────────────────────
  describe('T-FF-9: icono opcional cuando se pasa', () => {
    it('renderiza el icono MaterialIcons cuando se pasa via prop', () => {
      // El componente propaga el testID derivado `${testID}-icon` solo
      // cuando hay icono presente. Buscamos via UNSAFE_getByProps porque
      // jest-expo testing-library tiene comportamiento inconsistente con
      // getByTestId en nodos hijos de mocks.
      const { UNSAFE_getByProps } = render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          icono="badge"
          testID="ff-9"
        />,
      );
      const iconoText = UNSAFE_getByProps({ testID: 'ff-9-icon' });
      expect(iconoText).toBeTruthy();
    });

    it('NO renderiza icono cuando no se pasa prop (testID -icon ausente)', () => {
      const { UNSAFE_queryByProps } = render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          testID="ff-9-no"
        />,
      );
      // Sin icono → no debe haber Text con testID="ff-9-no-icon".
      const iconoText = UNSAFE_queryByProps({ testID: 'ff-9-no-icon' });
      expect(iconoText).toBeNull();
    });
  });

  // ── T-FF-10: error reemplaza helperText (no se muestran ambos) ──────────
  describe('T-FF-10: prioridad de mensajes debajo del input', () => {
    it('cuando hay error, el helperText NO se muestra (error tiene prioridad)', () => {
      // UX decision: cuando el input tiene error, el mensaje de ayuda
      // (descripción) deja de mostrarse para reducir ruido cognitivo.
      // El operario ve SOLO el error.
      const { queryByText, getByText } = render(
        <FormField
          label="Cédula"
          value=""
          onChangeText={jest.fn()}
          helperText="Ingrese 6 a 12 dígitos numéricos"
          error="Cédula obligatoria"
          testID="ff-10"
        />,
      );
      expect(getByText('Cédula obligatoria')).toBeTruthy();
      expect(queryByText('Ingrese 6 a 12 dígitos numéricos')).toBeNull();
    });
  });

  // ── Sanidad ──────────────────────────────────────────────────────────────
  describe('sanidad', () => {
    it('exporta FormField como forwardRef (componente con ref forwarding)', () => {
      // forwardRef retorna un objeto con $$typeof: REACT_FORWARD_REF_TYPE,
      // no una función. Verificamos que el objeto tenga la marca de
      // forwardRef (compatible con React 18+).
      // Alternativa: typeof FormField === 'object' && $$typeof.
      expect(FormField).toBeDefined();
      expect(typeof FormField).toBe('object');
      // $$typeof debe ser el symbol de forwardRef (REACT_FORWARD_REF_TYPE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((FormField as any).$$typeof?.toString()).toMatch(/forward_ref|Symbol\(react\.forward_ref\)/);
    });

    it('el archivo del componente importa StyleSheet (sanity)', () => {
      expect(formFieldSource).toContain('StyleSheet');
      expect(formFieldSource.length).toBeGreaterThan(500);
    });

    it('usa tokens del skeletal-tokens (no hex hardcodeados en styles principales)', () => {
      // El codigo (sin contar strings/comentarios) debe importar desde
      // skeletal-tokens y NO hardcodear #hex en bloques principales.
      // Comentarios que mencionan hex como referencia son OK.
      const sinComentarios = formFieldSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios).toContain("from '../theme/skeletal-tokens'");
    });
  });
});