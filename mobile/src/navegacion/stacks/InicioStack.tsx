import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RutaDeHoy from '../../pantallas/RutaDeHoy';
import type { InicioStackParamList } from '../types';

const Stack = createNativeStackNavigator<InicioStackParamList>();

export default function InicioStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RutaDeHoy" component={RutaDeHoy} />
    </Stack.Navigator>
  );
}
