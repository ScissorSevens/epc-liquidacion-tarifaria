import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AltaSuscriptor from '../../pantallas/AltaSuscriptor';
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

/**
 * ConfigStack — entry-point del tab "Perfil".
 *
 * mi-perfil-unification-and-param-persistence — el screen "MiPerfil" es
 * la ruta inicial de este stack (antes lo era "Configuracion", que fue
 * absorbido en MiPerfil y eliminado).
 */
export default function ConfigStack({ onLogoutRequested }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MiPerfil">
        {(props) => (
          <MiPerfil
            {...props}
            onLogoutRequested={onLogoutRequested}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AltaSuscriptor" component={AltaSuscriptor} />
      <Stack.Screen name="ImportarCsv" component={ImportarCsv} />
      <Stack.Screen name="Admin" component={Admin} />
      <Stack.Screen name="GestionPrestadores" component={GestionPrestadores} />
      <Stack.Screen name="AcuerdoMunicipal" component={AcuerdoMunicipal} />
      <Stack.Screen name="ParametrosTarifa" component={ParametrosTarifa} />
      <Stack.Screen name="ImportarPrestadores" component={ImportarPrestadores} />
    </Stack.Navigator>
  );
}