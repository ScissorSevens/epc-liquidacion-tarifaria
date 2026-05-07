import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import type { Lectura } from '@dominio/captura-lecturas/types';
import type {
  Estrato,
  ParametrosTarifa,
  ResultadoCalculo as ResultadoCalculoTipo,
} from '@dominio/motor-tarifario/types';

import AltaSuscriptor from '../pantallas/AltaSuscriptor';
import CapturarFoto from '../pantallas/CapturarFoto';
import CapturarLectura from '../pantallas/CapturarLectura';
import DetalleSuscriptor from '../pantallas/DetalleSuscriptor';
import HolaMediApp from '../pantallas/HolaMediApp';
import Home from '../pantallas/Home';
import ImportarCsv from '../pantallas/ImportarCsv';
import ListaSuscriptores from '../pantallas/ListaSuscriptores';
import ResultadoCalculo from '../pantallas/ResultadoCalculo';
import Sincronizacion from '../pantallas/Sincronizacion';

/**
 * Mapa de rutas del stack raíz.
 * `DetalleSuscriptor` recibe `id_suscriptor: number` (PK autoincremental
 * de la tabla suscriptores — ver `src/suscriptores/types.ts`).
 *
 * `CapturarLectura` recibe el `id_medidor` sobre el que se va a leer y
 * el `id_suscriptor` solo para mostrar contexto en el header.
 *
 * `ResultadoCalculo` recibe el desglose completo del calculo + el
 * `id_suscriptor` y `id_medidor` para poder ofrecer "Capturar otra"
 * sobre el mismo medidor.
 */
export type RootStackParamList = {
  Home: undefined;
  ListaSuscriptores: undefined;
  AltaSuscriptor: undefined;
  ImportarCsv: undefined;
  HolaMediApp: undefined;
  DetalleSuscriptor: { id_suscriptor: number };
  CapturarLectura: {
    id_medidor: number;
    id_suscriptor: number;
  };
  CapturarFoto: {
    id_medidor: number;
    id_periodo: string;
    id_suscriptor: number;
  };
  ResultadoCalculo: {
    lectura: Lectura;
    resultado: ResultadoCalculoTipo;
    parametros: ParametrosTarifa;
    estrato: Estrato;
    id_suscriptor: number;
  };
  Sincronizacion: undefined;
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
      <Stack.Screen name="CapturarLectura" component={CapturarLectura} />
      <Stack.Screen name="CapturarFoto" component={CapturarFoto} />
      <Stack.Screen name="ResultadoCalculo" component={ResultadoCalculo} />
      <Stack.Screen name="Sincronizacion" component={Sincronizacion} />
    </Stack.Navigator>
  );
}
