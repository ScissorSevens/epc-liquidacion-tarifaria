/**
 * RootNavigator — Stack raíz de la aplicación.
 *
 * Expone dos rutas:
 *   - Login: pantalla de ingreso (sin tabs, sin header)
 *   - Main:  AppNavigator con bottom tabs (post-autenticación)
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Login from '../pantallas/Login';
import type { RootStackParamList } from './types';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Main" component={AppNavigator} />
    </Stack.Navigator>
  );
}
