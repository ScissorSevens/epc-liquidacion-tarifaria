/**
 * Tipos centralizados de navegación para AquaServices.
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
import type { Prestador } from '@dominio/prestadores';
import type { Suscriptor } from '@dominio/suscriptores/types';
import type { OtroValor } from '@dominio/factura/types';

// ── Stacks ────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
};

export type InicioStackParamList = {
  RutaDeHoy: undefined;
  DetalleSuscriptor: { id_suscriptor: number };
  CapturarLectura: { id_medidor: number; id_suscriptor: number };
  CapturarFoto: { id_medidor: number; id_periodo: string; id_suscriptor: number };
  ResultadoCalculo: {
    lectura: Lectura;
    resultado: ResultadoCalculoTipo;
    parametros: ParametrosTarifa;
    estrato: Estrato;
    id_suscriptor: number;
    nombre_suscriptor: string;
    prestador: Prestador;
    /**
     * `factura-preview-print-bluetooth` R8: el total normativo mostrado
     * en esta pantalla es `liquidacion.total + sum(otros_valores) +
     * saldo_anterior`. Si la pantalla que invoca ResultadoCalculo los
     * conoce (post-emision), los pasa aca. Si no, default a `[]` y `0`
     * respectivamente — caso legacy pre-emision movi.
     */
    otros_valores?: readonly OtroValor[];
    saldo_anterior?: number;
  };
  /**
   * `factura-preview-print-bluetooth` D9: pantalla de preview del
   * tiquete de factura, post-emision. Recibe el id de la Factura
   * persistida y carga la entidad via `bootstrap.facturaRepo.buscarPorId`.
   */
  FacturaPreview: { id_factura: string };
  /**
   * Pantalla de seleccion/cambio de impresora Bluetooth (BLE + SPP).
   * `modo`: 'inicial' = primera vez; 'cambio' = re-seleccion
   * persistida.
   */
  SeleccionarImpresora: {
    id_factura: string;
    modo: 'inicial' | 'cambio';
  };
  EditarSuscriptor: { suscriptor: Suscriptor };
};

export type LecturasStackParamList = {
  ListaSuscriptores: undefined;
  DetalleSuscriptor: { id_suscriptor: number };
  Historial: { id_suscriptor: number; nombre: string };
  CapturarLectura: { id_medidor: number; id_suscriptor: number };
  CapturarFoto: { id_medidor: number; id_periodo: string; id_suscriptor: number };
  ResultadoCalculo: {
    lectura: Lectura;
    resultado: ResultadoCalculoTipo;
    parametros: ParametrosTarifa;
    estrato: Estrato;
    id_suscriptor: number;
    nombre_suscriptor: string;
    prestador: Prestador;
    /**
     * `factura-preview-print-bluetooth` R8: total normativo. Ver
     * InicioStack.ResultadoCalculo para semantica completa.
     */
    otros_valores?: readonly OtroValor[];
    saldo_anterior?: number;
  };
  /**
   * `factura-preview-print-bluetooth` D9: registrado en ambos stacks
   * para soportar `Inicio → CapturarLectura → ResultadoCalculo →
   * FacturaPreview` y `ListaSuscriptores → CapturarLectura →
   * ResultadoCalculo → FacturaPreview`.
   */
  FacturaPreview: { id_factura: string };
  SeleccionarImpresora: {
    id_factura: string;
    modo: 'inicial' | 'cambio';
  };
  AltaSuscriptor: undefined;
  ImportarCsv: undefined;
  EditarSuscriptor: { suscriptor: Suscriptor };
};

export type SyncStackParamList = {
  Sincronizacion: undefined;
};

export type ConfigStackParamList = {
  /**
   * mi-perfil-unification-and-param-persistence — "MiPerfil" es ahora
   * el entry-point del tab "Perfil". Antes el initial route era
   * "Configuracion" (eliminado). La Pantalla MiPerfil absorbe toda la
   * info del operario + Gestión (AltaSuscriptor, ImportarCsv, Versión,
   * Cerrar sesión con Alert.alert).
   */
  MiPerfil: undefined;
  AltaSuscriptor: undefined;
  ImportarCsv: undefined;
  Admin: undefined;
  GestionPrestadores: undefined;
  AcuerdoMunicipal: { id_prestador: number };
  ParametrosTarifa: { id_prestador: number };
  ImportarPrestadores: undefined;
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

/** Props para pantallas dentro del RootStack (Main). */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
