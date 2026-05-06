import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import type { EvidenciaFoto, Lectura } from '@dominio/captura-lecturas/types';
import type {
  Estrato,
  ParametrosTarifa,
  ResultadoCalculo as ResultadoCalculoTipo,
} from '@dominio/motor-tarifario/types';

import AltaSuscriptor from '../pantallas/AltaSuscriptor';
import CapturarLectura from '../pantallas/CapturarLectura';
import DetalleSuscriptor from '../pantallas/DetalleSuscriptor';
import HolaMediApp from '../pantallas/HolaMediApp';
import Home from '../pantallas/Home';
import ImportarCsv from '../pantallas/ImportarCsv';
import ListaSuscriptores from '../pantallas/ListaSuscriptores';
import ResultadoCalculo from '../pantallas/ResultadoCalculo';

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
    /**
     * Param de retorno desde `CapturarFoto`. Cuando esa pantalla termina
     * la captura, navega de vuelta a `CapturarLectura` con este campo
     * poblado para que el form lo asocie al `EntradaLectura`.
     */
    evidenciaFoto?: EvidenciaFoto;
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
      <Stack.Screen name="ResultadoCalculo" component={ResultadoCalculo} />
    </Stack.Navigator>
  );
}
