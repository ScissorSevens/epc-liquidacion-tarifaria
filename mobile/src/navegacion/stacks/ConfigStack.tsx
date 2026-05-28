import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AltaSuscriptor from '../../pantallas/AltaSuscriptor';
import Configuracion from '../../pantallas/Configuracion';
import ImportarCsv from '../../pantallas/ImportarCsv';
import MiPerfil from '../../pantallas/MiPerfil';
import type { ConfigStackParamList } from '../types';

const Stack = createNativeStackNavigator<ConfigStackParamList>();

export default function ConfigStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Configuracion" component={Configuracion} />
      <Stack.Screen name="AltaSuscriptor" component={AltaSuscriptor} />
      <Stack.Screen name="ImportarCsv" component={ImportarCsv} />
      <Stack.Screen name="MiPerfil" component={MiPerfil} />
    </Stack.Navigator>
  );
}
