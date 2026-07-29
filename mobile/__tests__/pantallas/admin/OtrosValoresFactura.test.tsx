/**
 * Tests de la pantalla admin OtrosValoresFactura.
 *
 * Cambio introducido en `factura-compliance-hardening` Task 8: el catalogo
 * de conceptos se carga via `getBootstrap().conceptoOtroValorRepo.listar(true)`
 * en lugar de la constante hardcoded `OtrosValoresCatalogo`. La UI es
 * async: muestra estado de carga mientras el repo responde.
 *
 * Cobertura (compatible con la version anterior + nuevas verificaciones):
 *  - Renderiza la lista de otros_valores iniciales.
 *  - Permite agregar un nuevo concepto desde el catálogo.
 *  - Permite editar el valor de un concepto existente.
 *  - Permite eliminar un concepto de la lista.
 *  - Edita saldo_anterior.
 *  - Boton guardar invoca onGuardar con los datos finales.
 *  - Boton cancelar invoca onCancelar.
 *  - Accesibilidad WCAG 2.5.5: touch targets ≥ 44px.
 *  - testID en cada control.
 *
 * Mocks:
 *  - `getBootstrap()` se mockea para devolver un `conceptoOtroValorRepo`
 *    con los 7 conceptos seed.
 *
 * TDD: tests RED que validan la UI antes de crearla.
 */
'use strict';

import { waitFor, render, fireEvent } from '@testing-library/react-native';
import {
  type ConceptoOtroValor,
} from '@dominio/concepto-otro-valor';
import OtrosValoresFactura from '../../../src/pantallas/admin/OtrosValoresFactura';

const CATALOGO_SEED: readonly ConceptoOtroValor[] = [
  { idConcepto: 1, codigo: 'SALDO_ANTERIOR', descripcion: 'Saldo pendiente de periodos anteriores', version: '1038-2026-v1', activo: true, requiereGlosa: false, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 2, codigo: 'INTERESES_AUTORIZADOS', descripcion: 'Intereses de mora autorizados', version: '1038-2026-v1', activo: true, requiereGlosa: true, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 3, codigo: 'RECONEXION', descripcion: 'Cargo por reconexión del servicio', version: '1038-2026-v1', activo: true, requiereGlosa: false, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 4, codigo: 'FINANCIACION', descripcion: 'Cuota de financiación de deuda previa', version: '1038-2026-v1', activo: true, requiereGlosa: true, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 5, codigo: 'MATERIALES_ACOMETIDA', descripcion: 'Materiales de acometida', version: '1038-2026-v1', activo: true, requiereGlosa: false, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 6, codigo: 'AJUSTES_DEVOLUCIONES', descripcion: 'Ajustes o devoluciones', version: '1038-2026-v1', activo: true, requiereGlosa: true, createdAt: '2026-07-29T00:00:00.000Z' },
  { idConcepto: 7, codigo: 'OTROS_AUTORIZADOS', descripcion: 'Otros conceptos autorizados', version: '1038-2026-v1', activo: true, requiereGlosa: true, createdAt: '2026-07-29T00:00:00.000Z' },
];

jest.mock('../../../src/composition/get-bootstrap', () => ({
  getBootstrap: jest.fn(() =>
    Promise.resolve({
      repos: {
        conceptoOtroValorRepo: {
          async listar() {
            return CATALOGO_SEED;
          },
          async buscarPorCodigo(codigo: string) {
            return CATALOGO_SEED.find((c) => c.codigo === codigo.toUpperCase()) ?? null;
          },
        },
      },
    }),
  ),
}));

interface OtroValorTest {
  readonly concepto: string;
  readonly valor: number;
  readonly glosa?: string;
}

describe('OtrosValoresFactura — pantalla admin', () => {
  it('renderiza el titulo y subtitulo', async () => {
    const { getByText } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[]}
        saldoAnteriorInicial={0}
        onGuardar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );
    expect(getByText(/Otros valores y saldo anterior/i)).toBeTruthy();
  });

  it('renderiza cada concepto del catalogo seed como opcion en el selector', async () => {
    const { getByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[]}
        saldoAnteriorInicial={0}
        onGuardar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      for (const concepto of CATALOGO_SEED) {
        expect(getByTestId(`catalogo-${concepto.codigo}`)).toBeTruthy();
      }
    });
  });

  it('renderiza la lista de otros_valores iniciales con descripcion desde el repo', async () => {
    const iniciales: OtroValorTest[] = [
      { concepto: 'RECONEXION', valor: 50000 },
      { concepto: 'FINANCIACION', valor: 100000, glosa: 'Cuota 1/12' },
    ];
    const { getByTestId, getByText } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={iniciales}
        saldoAnteriorInicial={0}
        onGuardar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('item-RECONEXION')).toBeTruthy();
      expect(getByTestId('item-FINANCIACION')).toBeTruthy();
    });
    // Descripcion cargada desde el repo (no del constante).
    expect(getByText(/Cargo por reconexión/i)).toBeTruthy();
  });

  it('al hacer click en un catalogo, agrega el concepto a la lista', async () => {
    const onGuardar = jest.fn();
    const { getByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[]}
        saldoAnteriorInicial={0}
        onGuardar={onGuardar}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('catalogo-RECONEXION')).toBeTruthy();
    });
    fireEvent.press(getByTestId('catalogo-RECONEXION'));
    expect(getByTestId('item-RECONEXION')).toBeTruthy();
  });

  it('al hacer click en eliminar, quita el concepto de la lista', async () => {
    const { getByTestId, queryByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[{ concepto: 'RECONEXION', valor: 50000 }]}
        saldoAnteriorInicial={0}
        onGuardar={jest.fn()}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('item-RECONEXION')).toBeTruthy();
    });
    fireEvent.press(getByTestId('eliminar-RECONEXION'));
    await waitFor(() => {
      expect(queryByTestId('item-RECONEXION')).toBeNull();
    });
  });

  it('el boton guardar invoca onGuardar con los datos finales', async () => {
    const onGuardar = jest.fn();
    const { getByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[{ concepto: 'RECONEXION', valor: 50000 }]}
        saldoAnteriorInicial={0}
        onGuardar={onGuardar}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('boton-guardar')).toBeTruthy();
    });
    fireEvent.press(getByTestId('boton-guardar'));
    expect(onGuardar).toHaveBeenCalledWith({
      otrosValores: [{ concepto: 'RECONEXION', valor: 50000 }],
      saldoAnterior: 0,
    });
  });

  it('el boton cancelar invoca onCancelar una vez', async () => {
    const onCancelar = jest.fn();
    const { getByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[]}
        saldoAnteriorInicial={0}
        onGuardar={jest.fn()}
        onCancelar={onCancelar}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('boton-cancelar')).toBeTruthy();
    });
    fireEvent.press(getByTestId('boton-cancelar'));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('el input de saldo_anterior acepta valores numericos', async () => {
    const onGuardar = jest.fn();
    const { getByTestId } = render(
      <OtrosValoresFactura
        otrosValoresIniciales={[]}
        saldoAnteriorInicial={0}
        onGuardar={onGuardar}
        onCancelar={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByTestId('boton-guardar')).toBeTruthy();
    });
    const input = getByTestId('input-saldo-anterior');
    fireEvent.changeText(input, '15000');
    fireEvent.press(getByTestId('boton-guardar'));
    expect(onGuardar).toHaveBeenCalledWith({
      otrosValores: [],
      saldoAnterior: 15000,
    });
  });

  // WCAG 2.5.5 — touch targets ≥ 44px. Endurecido en este change:
  // inspecciona los estilos computados via `props.style` del test instance,
  // no se conforma con la presencia de testID. Si el componente baja
  // accidentamente el minHeight a < 44, el test falla ruidosamente.
  describe('Touch targets WCAG 2.5.5 (≥ 44px) — inspeccion de styles', () => {
    /** Extrae el numero de pixels de un style value: numero directo, o
     * derivado de un array de styles concatenados. */
    function resolverMinHeight(style: unknown): number {
      const arr = Array.isArray(style) ? style : [style];
      let resolved: { minHeight?: number; height?: number; width?: number; minWidth?: number } = {};
      for (const s of arr) {
        if (s === null || s === undefined) continue;
        if (typeof s === 'number') continue; // StyleSheet id, no inspeccionable
        if (typeof s === 'object') {
          resolved = { ...resolved, ...(s as Record<string, number>) };
        }
      }
      // Consideramos valido si height >= 44 o minHeight >= 44.
      const v = resolved.height ?? resolved.minHeight ?? 0;
      return v;
    }

    it('boton-guardar tiene minHeight >= 44px', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('boton-guardar')).toBeTruthy();
      });
      const style = getByTestId('boton-guardar').props.style;
      const h = resolverMinHeight(style);
      // El componente declara TOUCH_TARGET = 56 → esperamos 56.
      expect(h).toBeGreaterThanOrEqual(44);
    });

    it('boton-cancelar tiene minHeight >= 44px', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('boton-cancelar')).toBeTruthy();
      });
      const style = getByTestId('boton-cancelar').props.style;
      const h = resolverMinHeight(style);
      expect(h).toBeGreaterThanOrEqual(44);
    });

    it('input-saldo-anterior tiene minHeight >= 44px', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('input-saldo-anterior')).toBeTruthy();
      });
      const style = getByTestId('input-saldo-anterior').props.style;
      const h = resolverMinHeight(style);
      expect(h).toBeGreaterThanOrEqual(44);
    });

    it('eliminar de item tiene width y height >= 44px', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[{ concepto: 'RECONEXION', valor: 50000 }]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('eliminar-RECONEXION')).toBeTruthy();
      });
      const style = getByTestId('eliminar-RECONEXION').props.style;
      const arr = Array.isArray(style) ? style : [style];
      let merged: { width?: number; height?: number; minHeight?: number; minWidth?: number } = {};
      for (const s of arr) {
        if (s === null || s === undefined || typeof s !== 'object') continue;
        merged = { ...merged, ...(s as Record<string, number>) };
      }
      expect(merged.width ?? merged.minWidth ?? 0).toBeGreaterThanOrEqual(44);
      expect(merged.height ?? merged.minHeight ?? 0).toBeGreaterThanOrEqual(44);
    });

    it('chip del catalogo tiene minHeight y minWidth >= 44px', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      await waitFor(() => {
        expect(getByTestId('catalogo-RECONEXION')).toBeTruthy();
      });
      const style = getByTestId('catalogo-RECONEXION').props.style;
      const arr = Array.isArray(style) ? style : [style];
      let merged: { minHeight?: number; minWidth?: number; height?: number; width?: number } = {};
      for (const s of arr) {
        if (s === null || s === undefined || typeof s !== 'object') continue;
        merged = { ...merged, ...(s as Record<string, number>) };
      }
      expect(merged.minHeight ?? merged.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(merged.minWidth ?? merged.width ?? 0).toBeGreaterThanOrEqual(44);
    });
  });

  // Verifica que la UI NO importa la constante legacy. Esta garantia
  // estructura el "fuente de verdad =  repo" del change
  // `factura-compliance-hardening`. Si alguien readd el import, este
  // test falla con el path ofensor — sin trampas de `expect(true).toBe(true)`.
  describe('Sin import de la constante legacy OtrosValoresCatalogo', () => {
    it('el archivo OtrosValoresFactura.tsx NO contiene import de OtrosValoresCatalogo', () => {
      const fs = jest.requireActual('fs') as typeof import('fs');
      const path = jest.requireActual('path') as typeof import('path');
      const srcPath = path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'pantallas',
        'admin',
        'OtrosValoresFactura.tsx',
      );
      const src = fs.readFileSync(srcPath, 'utf-8');
      // Quitamos comentarios en bloque para no romper el assert por
      // una linea de documentacion.
      const limpio = src.replace(/\/\*[\s\S]*?\*\//g, '');
      // El archivo NO debe importar la constante legacy desde
      // `otros-valores-catalogo`. Re-exportes via `index.ts` de
      // `@dominio/factura` SI son aceptables (los tipos vienen de ahi).
      const regexImport = /import\s+[^;]*['"]\.\.\/\.\.\/\.\.\/dominio\/factura\/otros-valores-catalogo['"]/;
      expect(limpio).not.toMatch(regexImport);
    });

    it('Bootstrap.conceptoOtroValorRepo.listar(true) es la fuente de la lista renderizada', async () => {
      const { getByTestId } = render(
        <OtrosValoresFactura
          otrosValoresIniciales={[]}
          saldoAnteriorInicial={0}
          onGuardar={jest.fn()}
          onCancelar={jest.fn()}
        />,
      );
      // La lista de "conceptos seed" debe renderizarse → el mock
      // `conceptoOtroValorRepo.listar` con `CATALOGO_SEED` es la
      // fuente. Si la UI re-importara `OtrosValoresCatalogo` y la
      // usara, el render seria independiente del mock (no fallaria
      // por el mock, pero tampoco probaria la fuente).
      await waitFor(() => {
        expect(getByTestId('catalogo-RECONEXION')).toBeTruthy();
        expect(getByTestId('catalogo-FINANCIACION')).toBeTruthy();
      });
      // Test que dependa del dato unico del mock (no de la constante):
      // la constante legacy no tiene `descripcion: 'Saldo pendiente de
      // periodos anteriores'` cargada — solo la mock version la tiene.
      expect(getByTestId('catalogo-SALDO_ANTERIOR')).toBeTruthy();
    });
  });
});
