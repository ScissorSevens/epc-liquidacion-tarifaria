/**
 * RootNavigator — Stack raiz de la aplicacion post-autenticacion.
 *
 * Solo expone la ruta `Main` (AppNavigator con bottom tabs).
 * El control de Login/Splash ahora vive en `AuthGate`, que monta este
 * stack dentro de su propio NavigationContainer cuando la sesion es valida.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  readonly onLogoutRequested: () => void;
}

export default function RootNavigator({ onLogoutRequested }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">
        {() => <AppNavigator onLogoutRequested={onLogoutRequested} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}