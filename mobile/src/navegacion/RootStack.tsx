import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import AltaSuscriptor from '../pantallas/AltaSuscriptor';
import DetalleSuscriptor from '../pantallas/DetalleSuscriptor';
import HolaMediApp from '../pantallas/HolaMediApp';
import Home from '../pantallas/Home';
import ImportarCsv from '../pantallas/ImportarCsv';
import ListaSuscriptores from '../pantallas/ListaSuscriptores';

/**
 * Mapa de rutas del stack raíz.
 * `DetalleSuscriptor` recibe `id_suscriptor: number` (PK autoincremental
 * de la tabla suscriptores — ver `src/suscriptores/types.ts`).
 */
export type RootStackParamList = {
  Home: undefined;
  ListaSuscriptores: undefined;
  AltaSuscriptor: undefined;
  ImportarCsv: undefined;
  HolaMediApp: undefined;
  DetalleSuscriptor: { id_suscriptor: number };
};

/**
 * Helper genérico para tipar las props de cada pantalla.
 * Uso: `type Props = RootStackScreenProps<'Home'>`.
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="ListaSuscriptores" component={ListaSuscriptores} />
      <Stack.Screen name="AltaSuscriptor" component={AltaSuscriptor} />
      <Stack.Screen name="ImportarCsv" component={ImportarCsv} />
      <Stack.Screen name="HolaMediApp" component={HolaMediApp} />
      <Stack.Screen name="DetalleSuscriptor" component={DetalleSuscriptor} />
    </Stack.Navigator>
  );
}
