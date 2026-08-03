import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AltaSuscriptor from '../../pantallas/AltaSuscriptor';
import CapturarFoto from '../../pantallas/CapturarFoto';
import CapturarLectura from '../../pantallas/CapturarLectura';
import DetalleSuscriptor from '../../pantallas/DetalleSuscriptor';
import EditarSuscriptor from '../../pantallas/EditarSuscriptor';
import FacturaPreviewScreenPlaceholder from '../../pantallas/FacturaPreviewScreenPlaceholder';
import Historial from '../../pantallas/Historial';
import ImportarCsv from '../../pantallas/ImportarCsv';
import ListaSuscriptores from '../../pantallas/ListaSuscriptores';
import ResultadoCalculo from '../../pantallas/ResultadoCalculo';
import SeleccionarImpresoraPlaceholder from '../../pantallas/SeleccionarImpresoraPlaceholder';
import type { LecturasStackParamList } from '../types';

const Stack = createNativeStackNavigator<LecturasStackParamList>();

export default function LecturasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ListaSuscriptores" component={ListaSuscriptores} />
      <Stack.Screen name="DetalleSuscriptor" component={DetalleSuscriptor} />
      <Stack.Screen name="Historial" component={Historial} />
      <Stack.Screen name="CapturarLectura" component={CapturarLectura} />
      <Stack.Screen name="CapturarFoto" component={CapturarFoto} />
      <Stack.Screen name="ResultadoCalculo" component={ResultadoCalculo} />
      <Stack.Screen
        name="FacturaPreview"
        component={FacturaPreviewScreenPlaceholder}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SeleccionarImpresora"
        component={SeleccionarImpresoraPlaceholder}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="AltaSuscriptor" component={AltaSuscriptor} />
      <Stack.Screen name="ImportarCsv" component={ImportarCsv} />
      <Stack.Screen name="EditarSuscriptor" component={EditarSuscriptor} />
    </Stack.Navigator>
  );
}
