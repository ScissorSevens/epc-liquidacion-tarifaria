import { render, waitFor, act } from '@testing-library/react-native';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

let mockSplashAnimadoDebeLlamarOnAnimationEnd = true;
let mockSplashAnimadoCallback: (() => void) | null = null;

jest.mock('../../src/componentes/SplashAnimado', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    SplashAnimado: ({ onAnimationEnd }: { onAnimationEnd: () => void }) => {
      React.useEffect(() => {
        mockSplashAnimadoCallback = onAnimationEnd;
        if (mockSplashAnimadoDebeLlamarOnAnimationEnd) {
          onAnimationEnd();
        }
      }, [onAnimationEnd]);
      return React.createElement(Text, null, 'splash-animado-mock');
    },
  };
});

jest.mock('../../src/pantallas/Login', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onLoginSuccess }: { onLoginSuccess: () => void }) =>
      React.createElement(Text, { onPress: onLoginSuccess }, 'login-mock'),
  };
});

jest.mock('../../src/navegacion/RootNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onLogoutRequested }: { onLogoutRequested: () => void }) =>
      React.createElement(
        Text,
        { onPress: onLogoutRequested },
        'root-navigator-mock',
      ),
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import { AuthGate } from '../../src/componentes/AuthGate';

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSplashAnimadoDebeLlamarOnAnimationEnd = true;
    mockSplashAnimadoCallback = null;
  });

  it('muestra Login cuando no hay sesion persistida', async () => {
    mockedGetItem.mockResolvedValueOnce(null);

    const { findByText, queryByText } = render(<AuthGate />);

    await findByText('login-mock');
    expect(queryByText('root-navigator-mock')).toBeNull();
  });

  it('muestra RootNavigator cuando hay sesion persistida', async () => {
    mockedGetItem.mockResolvedValueOnce(JSON.stringify({ cedula: '123456' }));

    const { findByText, queryByText } = render(<AuthGate />);

    await findByText('root-navigator-mock');
    expect(queryByText('login-mock')).toBeNull();
  });

  it('invoca SplashScreen.hideAsync cuando splash + sesion estan listos', async () => {
    mockedGetItem.mockResolvedValueOnce(null);

    render(<AuthGate />);

    await waitFor(() => {
      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('no invoca hideAsync hasta que splash termina aunque sesion este resuelta', async () => {
    mockSplashAnimadoDebeLlamarOnAnimationEnd = false;
    mockedGetItem.mockResolvedValueOnce(JSON.stringify({ cedula: '999' }));

    const { findByText } = render(<AuthGate />);

    await findByText('root-navigator-mock');
    expect(mockedHideAsync).not.toHaveBeenCalled();

    await act(async () => {
      mockSplashAnimadoCallback?.();
    });

    await waitFor(() => {
      expect(mockedHideAsync).toHaveBeenCalledTimes(1);
    });
  });
});