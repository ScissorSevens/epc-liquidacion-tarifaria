import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Sincronizacion from '../../pantallas/Sincronizacion';
import type { SyncStackParamList } from '../types';

const Stack = createNativeStackNavigator<SyncStackParamList>();

export default function SyncStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Sincronizacion" component={Sincronizacion} />
    </Stack.Navigator>
  );
}
