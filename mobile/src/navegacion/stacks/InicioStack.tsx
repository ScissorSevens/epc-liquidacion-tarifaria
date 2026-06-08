import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CapturarFoto from '../../pantallas/CapturarFoto';
import CapturarLectura from '../../pantallas/CapturarLectura';
import DetalleSuscriptor from '../../pantallas/DetalleSuscriptor';
import ResultadoCalculo from '../../pantallas/ResultadoCalculo';
import RutaDeHoy from '../../pantallas/RutaDeHoy';
import type { InicioStackParamList } from '../types';

const Stack = createNativeStackNavigator<InicioStackParamList>();

export default function InicioStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RutaDeHoy" component={RutaDeHoy} />
      <Stack.Screen name="DetalleSuscriptor" component={DetalleSuscriptor} />
      <Stack.Screen name="CapturarLectura" component={CapturarLectura} />
      <Stack.Screen name="CapturarFoto" component={CapturarFoto} />
      <Stack.Screen name="ResultadoCalculo" component={ResultadoCalculo} />
    </Stack.Navigator>
  );
}
