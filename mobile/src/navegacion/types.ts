/**
 * Tipos centralizados de navegación para AquaRuta.
 *
 * Un único archivo con todos los ParamLists y helpers de screen props
 * evita import cycles entre stacks y es el único lugar donde cambiar rutas.
 */

import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { Lectura } from '@dominio/captura-lecturas/types';
import type {
  Estrato,
  ParametrosTarifa,
  ResultadoCalculo as ResultadoCalculoTipo,
} from '@dominio/motor-tarifario/types';

// ── Stacks ────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<TabParamList>;
};

export type InicioStackParamList = {
  RutaDeHoy: undefined;
};

export type LecturasStackParamList = {
  ListaSuscriptores: undefined;
  DetalleSuscriptor: { id_suscriptor: number };
  CapturarLectura: { id_medidor: number; id_suscriptor: number };
  CapturarFoto: { id_medidor: number; id_periodo: string; id_suscriptor: number };
  ResultadoCalculo: {
    lectura: Lectura;
    resultado: ResultadoCalculoTipo;
    parametros: ParametrosTarifa;
    estrato: Estrato;
    id_suscriptor: number;
  };
};

export type SyncStackParamList = {
  Sincronizacion: undefined;
};

export type ConfigStackParamList = {
  Configuracion: undefined;
  AltaSuscriptor: undefined;
  ImportarCsv: undefined;
  MiPerfil: undefined;
};

// ── Tab raíz ──────────────────────────────────────────────────────────────────

export type TabParamList = {
  Inicio: NavigatorScreenParams<InicioStackParamList>;
  Lecturas: NavigatorScreenParams<LecturasStackParamList>;
  Sincronizacion: NavigatorScreenParams<SyncStackParamList>;
  Config: NavigatorScreenParams<ConfigStackParamList>;
};

// ── Screen Props helpers ──────────────────────────────────────────────────────

/**
 * Props para RutaDeHoy — usa CompositeScreenProps porque navega ENTRE stacks
 * (navega a LecturasStack → DetalleSuscriptor desde el tab Inicio).
 */
export type InicioStackScreenProps<T extends keyof InicioStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<InicioStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

/**
 * Props simples para pantallas dentro de LecturasStack.
 * Usa CompositeScreenProps porque ListaSuscriptores navega cross-tab a
 * ConfigStack → AltaSuscriptor para crear un nuevo suscriptor.
 */
export type LecturasStackScreenProps<T extends keyof LecturasStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<LecturasStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

/** Props para pantallas dentro de SyncStack. */
export type SyncStackScreenProps<T extends keyof SyncStackParamList> =
  NativeStackScreenProps<SyncStackParamList, T>;

/**
 * Props para pantallas dentro de ConfigStack.
 * Usa CompositeScreenProps porque AltaSuscriptor navega cross-tab a
 * LecturasStack → DetalleSuscriptor después de crear un suscriptor.
 */
export type ConfigStackScreenProps<T extends keyof ConfigStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ConfigStackParamList, T>,
    BottomTabScreenProps<TabParamList>
  >;

/** Props para pantallas dentro del RootStack (Login, etc.). */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
