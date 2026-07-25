// mobile/__tests__/navegacion/AppNavigator.test.tsx
//
// Tests contractuales de accesibilidad del TabBar (WCAG 2.1 AA).
//
// Regla de impecable (PRODUCT.md non-negotiables):
//   "Accessibility. Touch targets >= 44px, contrast >= 4.5:1, screen
//    readers get standalone-meaning link text."
//
// El TabBar (BottomTabNavigator) debe ser anunciado por TalkBack/VoiceOver
// con un label standalone ("Ir a Inicio", NO solo "Inicio") para que el
// operario con discapacidad visual entienda la accion al navegar entre
// tabs sin depender del icono grafico.
//
// Contrato:
//   - Cada tab lleva accessibilityLabel que describe el destino de la
//     accion ("Ir a Inicio", "Ir a Lecturas", etc.).
//   - role = "tab" para que el screen reader agrupe los 4 tabs y el
//     operario sepa que esta navegando "tabs" (no botones sueltos).
//   - accessibilityState.selected refleja el tab activo en el momento.
//   - Los 4 tabs del TabParamList (Inicio, Lecturas, Sincronizacion,
//     Config) deben estar anunciados.
//
// Estrategia de mocks:
//   - @react-navigation/bottom-tabs: createBottomTabNavigator devuelve
//     un Tab que rende sus <Tab.Screen> children invocando options.tabBarIcon
//     con { focused } segun la prop `initial` (true para el tab inicial,
//     false para los demas). Asi testeamos el contrato de lo que el
//     navigator REAL le pasaria al icono, sin levantar el navigator real
//     (que requiere animaciones nativas que jest no soporta).
//   - @react-navigation/native: NavigationContainer pasa-through, y el
//     useIsFocused() que TabIcon usa queda disponible (devuelve focused
//     de su argumento por medio de un wrapper — ver mock).
//   - Stacks: stubs que rendeizan un Text vacio. No nos interesa el
//     contenido de cada stack, solo la shell del TabBar.

import { render } from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');
  // Tab.Navigator pasa por sus children (un <Tab.Screen> por tab). El mock
  // no necesita respetar initialRouteName / screenOptions / tabBarStyle;
  // testeamos solo el contrato de tabBarIcon.
  const Tab = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(View, { testID: 'tab-navigator' }, children);
  };
  // Tab.Screen: el mock no conoce initialRouteName del padre, asi que cada
  // Tab.Screen declara si es el initial via la prop `initial` que el
  // AppNavigator real NO setea pero que el mock entiende para fijar el
  // focused correcto.
  Tab.Screen = ({
    name,
    options,
  }: {
    name: string;
    options: {
      tabBarIcon: (args: { focused: boolean }) => React.ReactNode;
    };
  }) => {
    // Determinamos el focused que el navigator real pasaria. En este
    // mock usamos la convencion: el screen cuyo name coincide con la
    // prop `initialRouteName` setteada arriba en el Navigator queda
    // focused. Para tests unitarios no necesitamos rigor de orden de
    // navegacion — basta con que "Inicio" arranque como focused porque
    // es el initialRouteName del AppNavigator real.
    // Truco: leemos el focused del contexto simulado. Como el mock del
    // Navigator no setea contexto, lo hacemos explicito con un flag.
    const focused = (Tab as unknown as { __focusedName?: string }).__focusedName === name;
    return React.createElement(
      View,
      { testID: `tab-screen-${name}` },
      options.tabBarIcon({ focused }),
    );
  };
  Tab.Navigator = Tab;
  return {
    createBottomTabNavigator: () => Tab,
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    // useIsFocused: el TabIcon real lo consume para arrancar el estado de
    // animacion. Mockeamos para devolver el focused que el screen provee,
    // lo que mantiene sincronizada la animacion con el navigator real.
    useIsFocused: () => {
      // No tenemos contexto; el mock devuelve true para que el primer
      // render muestre el tab como activo. Es suficiente para verificar
      // el contrato de accessibility sin enganar visualmente al test.
      return true;
    },
  };
});

jest.mock('../../src/navegacion/stacks/InicioStack', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/navegacion/stacks/LecturasStack', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/navegacion/stacks/SyncStack', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../src/navegacion/stacks/ConfigStack', () => ({
  __esModule: true,
  default: () => null,
}));

// ── SUT ────────────────────────────────────────────────────────────────────────

import AppNavigator from '../../src/navegacion/AppNavigator';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Setea el nombre del tab que el mock de Tab.Navigator considerara como
 * focused. Por defecto es "Inicio" (el initialRouteName del AppNavigator
 * real), pero un test puede pisarlo para verificar el estado selected
 * de otro tab.
 */
function setFocusedTab(nombre: 'Inicio' | 'Lecturas' | 'Sincronizacion' | 'Config'): void {
  const Tab = (
    jest.requireMock('@react-navigation/bottom-tabs') as {
      createBottomTabNavigator: () => unknown;
    }
  ).createBottomTabNavigator() as { __focusedName?: string };
  Tab.__focusedName = nombre;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AppNavigator — TabBar accessibility (WCAG 2.1 AA)', () => {
  beforeEach(() => {
    setFocusedTab('Inicio');
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-1: cada tab tiene accessibilityLabel que describe el destino
  //
  // El label NO es solo "Inicio" (que seria ambiguo — ¿la pantalla? ¿el
  // boton?) sino "Ir a Inicio" (verbo + objeto) para que el screen
  // reader anuncie una accion clara.
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-1 cada tab tiene accessibilityLabel que describe el destino', () => {
    const { getByLabelText } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    expect(getByLabelText('Ir a Inicio')).toBeTruthy();
    expect(getByLabelText('Ir a Lecturas')).toBeTruthy();
    expect(getByLabelText('Ir a Sincro')).toBeTruthy();
    expect(getByLabelText('Ir a Config')).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-2: cada tab tiene accessibilityRole="tab"
  //
  // El role "tab" agrupa los 4 elementos bajo un widget de tabs en el
  // accessibility tree. Sin esto, el screen reader anuncia 4 botones
  // sueltos y el operario pierde la nocion de "estoy navegando tabs".
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-2 cada tab tiene accessibilityRole="tab"', () => {
    const { getByRole } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    expect(getByRole('tab', { name: 'Ir a Inicio' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Ir a Lecturas' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Ir a Sincro' })).toBeTruthy();
    expect(getByRole('tab', { name: 'Ir a Config' })).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-3: el tab activo tiene accessibilityState.selected === true
  //
  // Caso: operario arranca la app, el tab Inicio es el active. El screen
  // reader anuncia "Ir a Inicio, tab, selected" — el usuario sabe DONDE
  // esta parado sin tener que explorar el arbol.
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-3 el tab activo (Inicio) tiene accessibilityState.selected === true', () => {
    setFocusedTab('Inicio');

    const { getByLabelText } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    const inicioTab = getByLabelText('Ir a Inicio');
    expect(inicioTab.props.accessibilityState.selected).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-4: el tab inactivo tiene accessibilityState.selected === false
  //
  // Caso opuesto: tab Inicio activo, el resto NO esta selected. Sin esta
  // prop, los 4 tabs se anunciarian como "selected" y el operario no
  // sabria cual esta en pantalla.
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-4 los tabs inactivos tienen accessibilityState.selected === false', () => {
    setFocusedTab('Inicio');

    const { getByLabelText } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    expect(getByLabelText('Ir a Lecturas').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Ir a Sincro').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Ir a Config').props.accessibilityState.selected).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-5: cuando el focused cambia, el accessibilityState.selected
  // del nuevo tab activo refleja el cambio
  //
  // Caso UX: operario navega a Config. El tab Config ahora es
  // accessibilityState.selected = true; Inicio pasa a false.
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-5 al cambiar el focused, el nuevo tab activo refleja selected=true', () => {
    setFocusedTab('Config');

    const { getByLabelText } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    expect(getByLabelText('Ir a Config').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Ir a Inicio').props.accessibilityState.selected).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-A11Y-T-6: el screen reader anunciaria el label + role combinados
  // ("Ir a Inicio, tab") — sanity check de la combinacion label + role
  // ─────────────────────────────────────────────────────────────────────
  it('T-A11Y-T-6 el tab "Inicio" es anunciable como "Ir a Inicio, tab"', () => {
    const { getByRole, getByLabelText } = render(
      <AppNavigator onLogoutRequested={() => undefined} />,
    );

    const tab = getByRole('tab', { name: 'Ir a Inicio' });
    expect(tab).toBeTruthy();
    // El label accesible es exactamente el texto que el screen reader
    // leeria antes del role.
    expect(getByLabelText('Ir a Inicio')).toBeTruthy();
  });
});
