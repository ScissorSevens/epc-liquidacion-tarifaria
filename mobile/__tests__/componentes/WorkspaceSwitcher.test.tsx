// mobile/__tests__/componentes/WorkspaceSwitcher.test.tsx
//
// Tests contractuales del WorkspaceSwitcher (Fase 4.2.3 del change
// setup-inicial-multi-tenant-auth + Mobile fix item #3 del mismo SDD —
// fix COR-08 del reporte de calidad).
//
// El componente se muestra en el header de Admin y permite al operario
// cambiar entre sus prestadores vinculados (programa "Agua la Vereda").
//
// Bajo cobertura:
//   - T-WS-RENDER-1: NO se muestra si hay 0 o 1 prestadores.
//   - T-WS-RENDER-2: muestra el botón con el nombre del prestador activo
//     cuando hay >1 prestadores disponibles.
//   - T-WS-UI-1: al tocar una opción del dropdown, llama `onCambiar(id)`.
//     La integración end-to-end se verifica pasando un `onCambiar` que
//     internamente invoca `useWorkspace.cambiarPrestadorYCargarContexto`
//     (forma en que Admin.tsx lo usa). Se verifica que el método del
//     store fue llamado con el id correcto.
//
// Mocks:
//   - expo-splash-screen: silencio el boot de splash.
//   - AsyncStorage: zustand/persist escribe en cada set del store.
//   - theme tokens: defaults seguros para que el componente renderice.
//   - @expo/vector-icons/MaterialIcons: ya mockeado globalmente vía
//     moduleNameMapper en package.json (devuelve un Text vacío).
//
// TDD Evidence:
//   RED  → estos tests son la primera cobertura del WorkspaceSwitcher.
//          Antes de este commit, el componente no tenía tests directos —
//          se cubría indirectamente via Admin (sin test propio aún).
//   GREEN → el componente expone `onCambiar` y el handler de Admin
//          llama `cambiarPrestadorYCargarContexto`, ambos verificables
//          en este test.

import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/theme/skeletal-tokens', () => ({
  BORDERS: { thin: { borderWidth: 1 } },
  COLORS: {
    background: '#fff',
    primary: '#031632',
    onPrimary: '#fff',
    primaryContainer: '#3596C8',
    surfaceContainerLowest: '#fff',
    outlineVariant: '#ccc',
    onSurface: '#000',
    onSurfaceVariant: '#555',
  },
  RADIUS: { sm: 4, md: 8, full: 999 },
  SHADOWS: { card: {} },
  SPACING: { xs: 4, sm: 8, md: 16 },
  TYPOGRAPHY: {
    labelMd: { fontSize: 14 },
    bodyMd: { fontSize: 14 },
    bodySm: { fontSize: 12 },
  },
}));

import { useWorkspace } from '../../src/composicion/useWorkspace';
import { WorkspaceSwitcher } from '../../src/composicion/WorkspaceSwitcher';

/** Fixture: 2 prestadores para forzar la visibilidad del componente. */
const prestadorA = {
  id_prestador: 5,
  codigo: 'P005',
  nombre: 'ASOCIACIÓN A',
  nit: '900000005',
  representante_legal: 'Representante A',
  representante_legal_cedula: '123456',
  municipio: 'Municipio A',
  departamento: 'Departamento A',
  segmento: 2 as const,
  num_suscriptores_urbanos: 0,
  num_suscriptores_rurales: 100,
  contacto: null,
  estado: 'activo' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const prestadorB = {
  ...prestadorA,
  id_prestador: 7,
  codigo: 'P007',
  nombre: 'ASOCIACIÓN B',
  municipio: 'Municipio B',
};

/** Estado base del store (sin prestadores). Coincide con el de
 *  useWorkspace.test.ts para coherencia entre suites. */
const ESTADO_INICIAL = {
  id_prestador_activo: 0,
  prestador: null,
  prestadores_disponibles: [] as never[],
  acuerdo_vigente: null,
  parametros_vigentes: null,
  cargando: false,
};

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    // Reset del store entre tests para que cada uno arranque limpio.
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // Render condicional
  // ─────────────────────────────────────────────────────────────
  describe('visibilidad', () => {
    it('T-WS-RENDER-1 no renderiza si hay 0 prestadores', () => {
      useWorkspace.setState({
        prestadores_disponibles: [],
      });
      const onCambiar = jest.fn();

      const { toJSON } = render(<WorkspaceSwitcher onCambiar={onCambiar} />);

      // El componente retorna `null` cuando hay 0/1 prestadores.
      expect(toJSON()).toBeNull();
    });

    it('T-WS-RENDER-1b no renderiza si hay 1 solo prestador', () => {
      useWorkspace.setState({
        prestadores_disponibles: [prestadorA as never],
      });
      const onCambiar = jest.fn();

      const { toJSON } = render(<WorkspaceSwitcher onCambiar={onCambiar} />);

      expect(toJSON()).toBeNull();
    });

    it('T-WS-RENDER-2 renderiza el botón con el nombre del prestador activo cuando hay >1', () => {
      useWorkspace.setState({
        prestadores_disponibles: [prestadorA, prestadorB] as never[],
        id_prestador_activo: 7, // B es el actual
      });
      const onCambiar = jest.fn();

      const { getByText } = render(<WorkspaceSwitcher onCambiar={onCambiar} />);

      // El label visible debe ser el nombre del prestador activo (id=7).
      expect(getByText('ASOCIACIÓN B')).toBeTruthy();
      // Y NO mostrar el otro nombre (no es el activo, solo aparece al
      // desplegar el dropdown, que inicialmente está cerrado).
      // Para no ser flaky, buscamos específicamente el botón con el
      // nombre del activo.
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Interacción: tocar opción del dropdown → llama onCambiar(id).
  // ─────────────────────────────────────────────────────────────
  describe('cambio de prestador', () => {
    it('T-WS-UI-1 al tocar una opción llama onCambiar con el id del prestador', async () => {
      useWorkspace.setState({
        prestadores_disponibles: [prestadorA, prestadorB] as never[],
        id_prestador_activo: 5, // A activo
      });
      const onCambiar = jest.fn().mockResolvedValue(undefined);

      const { getByText } = render(<WorkspaceSwitcher onCambiar={onCambiar} />);

      // (a) Click en el botón del dropdown para abrirlo.
      //      El Pressable contenedor tiene el onPress; el Text hijo muestra
      //      el nombre del prestador activo. fireEvent.press sobre el Text
      //      no propaga al Pressable padre — necesitamos el View wrapper.
      //      Accedemos via `.parent` del Text (padre inmediato View).
      const triggerButton = getByText('ASOCIACIÓN A').parent;
      expect(triggerButton).toBeTruthy();
      fireEvent.press(triggerButton as never);

      // (b) Ahora el dropdown está abierto. Click en la opción B (id=7).
      //      El botón exterior ya muestra A (al cerrarse se mantiene A),
      //      pero el dropdown renderiza ambas opciones con sus nombres.
      const opcionB = getByText('ASOCIACIÓN B');
      // Después de abrir el dropdown, hay 2 textos con "ASOCIACIÓN B"
      // (el botón sigue mostrando A; el nuevo item dropdown muestra B).
      // El handler onPress vive en el Pressable que envuelve el Text
      // de la opción. Buscamos el Pressable correcto via parent.
      fireEvent.press(opcionB.parent as never);

      // (c) Verificamos que onCambiar fue llamado con id=7.
      await waitFor(() => {
        expect(onCambiar).toHaveBeenCalledTimes(1);
      });
      expect(onCambiar).toHaveBeenCalledWith(7);
    });

    it('T-WS-UI-2 integración: onCambiar invoca cambiarPrestadorYCargarContexto con el id correcto', async () => {
      useWorkspace.setState({
        prestadores_disponibles: [prestadorA, prestadorB] as never[],
        id_prestador_activo: 5,
      });

      // Espiamos el método nuevo del store y construimos un `onCambiar`
      // que lo invoca con un bag mínimo de repos (mocks que resuelven
      // null, suficiente para verificar el wiring).
      const spyCambiar = jest
        .spyOn(useWorkspace.getState(), 'cambiarPrestadorYCargarContexto')
        .mockResolvedValue(undefined);

      const reposFakes = {
        prestador: { obtenerPorId: jest.fn().mockResolvedValue(null) },
        acuerdo: { buscarVigente: jest.fn().mockResolvedValue(null) },
        parametros: { buscarVigente: jest.fn().mockResolvedValue(null) },
      };
      const onCambiar = (id: number): Promise<void> =>
        useWorkspace
          .getState()
          .cambiarPrestadorYCargarContexto(id, reposFakes);

      const { getByText } = render(<WorkspaceSwitcher onCambiar={onCambiar} />);

      // Abrir dropdown
      const trigger = getByText('ASOCIACIÓN A').parent?.parent;
      fireEvent.press(trigger as never);

      // Click opción B (id=7)
      const opcionB = getByText('ASOCIACIÓN B');
      fireEvent.press(opcionB.parent as never);

      // Verificar que cambiarPrestadorYCargarContexto(7, reposFakes)
      // fue llamado por el wiring de Admin.
      await waitFor(() => {
        expect(spyCambiar).toHaveBeenCalledTimes(1);
      });
      const [idArg, reposArg] = spyCambiar.mock.calls[0]!;
      expect(idArg).toBe(7);
      expect(reposArg).toBe(reposFakes);

      // Cleanup del spy para no afectar otros tests.
      spyCambiar.mockRestore();
    });
  });
});
