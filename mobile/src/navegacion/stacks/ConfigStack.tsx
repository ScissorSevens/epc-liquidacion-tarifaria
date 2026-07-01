import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AltaSuscriptor from '../../pantallas/AltaSuscriptor';
import Configuracion from '../../pantallas/Configuracion';
import ImportarCsv from '../../pantallas/ImportarCsv';
import MiPerfil from '../../pantallas/MiPerfil';
import Admin from '../../pantallas/admin/Admin';
import GestionPrestadores from '../../pantallas/admin/GestionPrestadores';
import AcuerdoMunicipal from '../../pantallas/admin/AcuerdoMunicipal';
import ParametrosTarifa from '../../pantallas/admin/ParametrosTarifa';
import ImportarPrestadores from '../../pantallas/admin/ImportarPrestadores';
import type { ConfigStackParamList } from '../types';

const Stack = createNativeStackNavigator<ConfigStackParamList>();

interface Props {
  readonly onLogoutRequested: () => void;
}

export default function ConfigStack({ onLogoutRequested }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Configuracion" component={Configuracion} />
      <Stack.Screen name="AltaSuscriptor" component={AltaSuscriptor} />
      <Stack.Screen name="ImportarCsv" component={ImportarCsv} />
      <Stack.Screen name="MiPerfil">
        {() => <MiPerfil onLogoutRequested={onLogoutRequested} />}
      </Stack.Screen>
      <Stack.Screen name="Admin" component={Admin} />
      <Stack.Screen name="GestionPrestadores" component={GestionPrestadores} />
      <Stack.Screen name="AcuerdoMunicipal" component={AcuerdoMunicipal} />
      <Stack.Screen name="ParametrosTarifa" component={ParametrosTarifa} />
      <Stack.Screen name="ImportarPrestadores" component={ImportarPrestadores} />
    </Stack.Navigator>
  );
}
