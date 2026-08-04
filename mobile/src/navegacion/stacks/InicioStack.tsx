import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CapturarFoto from '../../pantallas/CapturarFoto';
import CapturarLectura from '../../pantallas/CapturarLectura';
import EditarSuscriptor from '../../pantallas/EditarSuscriptor';
import FacturaPreviewScreen from '../../pantallas/FacturaPreviewScreen';
import ResultadoCalculo from '../../pantallas/ResultadoCalculo';
import RutaDeHoy from '../../pantallas/RutaDeHoy';
import SeleccionarImpresora from '../../pantallas/SeleccionarImpresora';
import type { InicioStackParamList } from '../types';

const Stack = createNativeStackNavigator<InicioStackParamList>();

export default function InicioStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RutaDeHoy" component={RutaDeHoy} />
      <Stack.Screen name="CapturarLectura" component={CapturarLectura} />
      <Stack.Screen name="CapturarFoto" component={CapturarFoto} />
      <Stack.Screen name="ResultadoCalculo" component={ResultadoCalculo} />
      <Stack.Screen
        name="FacturaPreview"
        component={FacturaPreviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SeleccionarImpresora"
        component={SeleccionarImpresora}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="EditarSuscriptor" component={EditarSuscriptor} />
    </Stack.Navigator>
  );
}
