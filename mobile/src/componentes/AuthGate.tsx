import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';

import { SplashAnimado } from './SplashAnimado';
import Login from '../pantallas/Login';
import SetupInicial from '../pantallas/SetupInicial';
import RootNavigator from '../navegacion/RootNavigator';
import {
  cargarSesion,
  estadoSesionPersistida,
  limpiarSesion,
} from '../composition/constantes';
import { getBootstrap } from '../composition/get-bootstrap';
import { limpiarDatosLegacyBypass } from '../composition/migracion-datos-legacy';
import { crearOperarioRepositoryExpoSqlite } from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import { useWorkspace } from '../composicion/useWorkspace';
import { logger } from '../composicion/logger';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type Decision = 'loading' | 'sin_setup' | 'sin_sesion' | 'con_sesion' | 'error_db';

/**
 * Mensaje que se muestra arriba del Login cuando el operario tuvo una
 * sesion persistida que vencio. Es un copy estatico del lado UX: no se
 * compone dinamicamente porque la causa es siempre la misma (token
 * expirado por las 24h del contrato).
 */
const MENSAJE_SESION_VENCIDA =
  'Tu sesión anterior venció. Volvé a ingresar tu cédula y contraseña.';

/**
 * Componente raiz de autenticacion.
 *
 * Decide que mostrar en el cold-boot segun dos senales independientes:
 *   1. Bootstrap: hay al menos un prestador en la DB local?
 *      - NO  -> sin_setup (placeholder de SetupInicial, implementado en 5.1)
 *      - SI  -> continuar
 *   2. Sesion: hay una sesion persistida valida en AsyncStorage?
 *      - NO / vencida / invalida -> sin_sesion (Login; con banner si vencio)
 *      - SI                     -> con_sesion (RootNavigator + sync useWorkspace)
 *
 * PUNTO C — Detalle de sesion (PUNTO C):
 *   Antes, `cargarSesion()` colapsaba todo a `Sesion|null` y perdiamos
 *   el POR QUE del null. Ahora consultamos `estadoSesionPersistida()`
 *   ANTES de pedir la sesion para distinguir tres casos:
 *     - 'no_existe' (cold-boot limpio) -> Login silencioso.
 *     - 'invalida'  (storage con basura) -> Login silencioso (cleanup
 *       ya lo hizo estadoSesionPersistida).
 *     - 'vencida'   (token expirado, storage preservado) -> Login con
 *       banner arriba del form (mensajeInicial). El operario sabe
 *       exactamente por que lo vemos de nuevo en el Login.
 *
 * Estados renderizados:
 *   - loading:    SplashAnimado mientras decide
 *   - sin_setup:  SetupInicial (wizard 2 pasos)
 *   - sin_sesion: Login (con mensajeInicial si vencio)
 *   - con_sesion: NavigationContainer(RootNavigator)
 *   - error_db:   Error accionable con reintento e instrucciones de reinstalacion
 *
 * Dual-flag anti-flicker: solo invoca `SplashScreen.hideAsync()` cuando
 * AMBAS condiciones son verdaderas:
 *   - `splashNaturalComplete` (SplashAnimado reporto onAnimationEnd).
 *   - `decision !== 'loading'` (AuthGate resolvio login/setup/main).
 * Esto evita parpadeo en cualquier orden de resolucion.
 *
 * Cuando se detecta `con_sesion`, sincroniza `useWorkspace.id_prestador_activo`
 * con `sesion.idPrestador` via `useWorkspace.setSesionCompleta(sesion)`.
 */
export function AuthGate() {
  const [decision, setDecision] = useState<Decision>('loading');
  const [splashComplete, setSplashComplete] = useState(false);
  /**
   * Mensaje que se pasa a Login cuando el operario tuvo sesion expirada.
   * Si esta vacio, Login rendea sin banner (cold-boot limpio o sesion
   * corrupta). Si esta set, Login muestra el banner amarillo arriba del
   * form. AuthGate setea esto segun `estadoSesionPersistida()`; Login
   * puede dismissar el banner via su propio state interno (el prop es
   * solo el "semilla" inicial, despias el operario lo cierra con la X).
   */
  const [mensajeInicial, setMensajeInicial] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState('');
  const [intentoDeteccion, setIntentoDeteccion] = useState(0);

  useEffect(() => {
    // La deteccion arranca INMEDIATAMENTE al montar y vuelve a correr
    // cuando el operario solicita un reintento desde error_db.
    // NO esperamos al splash: el splash es puramente visual y la
    // deteccion corre en paralelo. El anti-flicker se logra con el
    // gating de hideAsync (efecto de abajo) que requiere AMBOS:
    //   splashComplete === true Y decision !== 'loading'.
    // Asi, si la sesion resuelve antes que termine el splash, vemos el
    // RootNavigator renderizado PERO el splash nativo sigue cubriendo
    // la pantalla hasta que su animacion termine.
    let cancelado = false;
    void (async () => {
      try {
        // 0. Limpieza defensiva de datos legacy (Fase 4.3.2).
        //    El bypass viejo de Configuracion.tsx (eliminado en 4.3.1)
        //    pudo haber dejado operarios fantasma con id_operario=0 o
        //    cedula='placeholder'. Si los dejamos, la deteccion de
        //    con_sesion podria activarlos por error. El helper es
        //    idempotente y defensivo (no propaga errores). Debe correr
        //    ANTES de prestadorRepo.listar() para que la DB quede limpia
        //    antes de decidir el estado.
        const bootstrap = await getBootstrap();
        const operarioRepo = crearOperarioRepositoryExpoSqlite(bootstrap.db);
        await limpiarDatosLegacyBypass(operarioRepo);
        if (cancelado) return;

        // 1. ¿Hay prestadores REALES en la DB local?
        //    Si NO hay, estamos en sin_setup — el operario debe pasar
        //    por el wizard de SetupInicial antes de poder loguearse.
        //
        //    IMPORTANTE: la migration 009 siembra siempre un prestador
        //    placeholder `EPC-LEGACY` (id=0) para mantener compat de FKs
        //    legacy de datos pre-multi-tenant. Ese seed NO cuenta como
        //    "prestador configurado" — es solo compat. Filtramos:
        //    - si id=0 → legacy placeholder
        //    - si codigo='EPC-LEGACY' → legacy placeholder (defensa extra)
        //    - si estado='suspendido' → no es un prestador válido para login
        const todosPrestadores = await bootstrap.repos.prestadorRepo.listar();
        if (cancelado) return;

        const prestadoresReales = todosPrestadores.filter(
          (p) =>
            p.id_prestador !== 0 &&
            p.codigo !== 'EPC-LEGACY' &&
            p.estado === 'activo',
        );

        if (prestadoresReales.length === 0) {
          setDecision('sin_setup');
          return;
        }

        // 1b. FASE POST-REINSTALL — deteccion de DB parcial.
        //
        //     Por que este check existe: cuando el usuario desinstala y
        //     reinstala Expo Go, AsyncStorage se wipea PERO el archivo
        //     SQLite `mediapp.db` puede persistir en disco (politica del
        //     OS + el sub-path de Expo Go). Resultado: una DB con el
        //     prestador del setup previo pero potencialmente SIN
        //     operarios (rollback transaccional, eliminacion manual, o
        //     simplemente porque el setup nunca llego a crear uno).
        //
        //     Si dejamos el flujo actual "hay prestador -> Login", el
        //     usuario ve Login, mete credenciales, loginLocal tira
        //     OPERARIO_NO_ENCONTRADO (porque no hay contra que validar)
        //     y termina en un dead-end UX. Ademas, si la sesion estaba
        //     'valida' pero apunta a un operario que ya no existe, el
        //     RootNavigator crashearia al primer query contra la tabla
        //     vacia.
        //
        //     Regla nueva: si hay prestadores reales pero la tabla
        //     `operarios` esta vacia, enrutar a sin_setup para que el
        //     usuario re-corra el wizard de setup. El wizard es
        //     idempotente: si el prestador ya existe, `bootstrapCompleto`
        //     crea uno nuevo con codigo correlativo (siguienteCodigoPrestador).
        //     Aplica INCLUSO si hay sesion persistida, porque una sesion
        //     apuntando a un operario inexistente es un estado roto y
        //     no podemos recuperarnos sin re-setup.
        //
        //     Cubierto por A8.1 (redirige a SetupInicial) y A8.2
        //     (regression guard del happy path con operarios).
        let operariosExistentes;
        try {
          operariosExistentes = await bootstrap.repos.operarioRepo.listar();
        } catch (error) {
          // DB corruption o SQLite nativo fail. NO ir a Login: reproduciria
          // el dead-end original al no poder consultar los operarios.
          console.error('[AuthGate] operarioRepo.listar() failed:', error);
          if (!cancelado) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'Error desconocido al consultar operarios',
            );
            setDecision('error_db');
          }
          return;
        }
        if (cancelado) return;
        if (operariosExistentes.length === 0) {
          setDecision('sin_setup');
          return;
        }

        // 2. PUNTO C: clasificamos la sesion persistida ANTES de pedirla.
        //    Asi podemos mostrar el banner "Tu sesion anterior vencio"
        //    solo cuando aplique (estado === 'vencida'), no en cold-boot
        //    limpio ('no_existe') ni cuando hay basura en storage
        //    ('invalida'). La sesion vencida NO se borra de AsyncStorage
        //    en este punto — el cleanup defensivo solo se hace en 'invalida'.
        const estadoSesion = await estadoSesionPersistida();
        if (cancelado) return;

        if (estadoSesion === 'vencida') {
          setMensajeInicial(MENSAJE_SESION_VENCIDA);
        }

        // 3. Cargamos la sesion tipada (cargarSesion ya es wrapper de
        //    estadoSesionPersistida, asi que hace el read + parse final
        //    cuando estado === 'valida').
        const sesion = await cargarSesion();
        if (cancelado) return;

        if (sesion === null) {
          setDecision('sin_sesion');
          return;
        }

        // 4. Sync del workspace con la sesion resuelta y decision final.
        await useWorkspace.getState().setSesionCompleta(sesion);
        if (cancelado) return;
        setDecision('con_sesion');
      } catch (error) {
        // Falla inesperada del bootstrap, prestadorRepo.listar(), operarioRepo.listar(),
        // estadoSesionPersistida(), cargarSesion(), setSesionCompleta(), o cualquier
        // otra operacion durante la deteccion. NO ir a sin_sesion (Login dead-end
        // cuando no hay contra que validar) ni a sin_setup (no sabemos si hay
        // prestador). Ir a error_db para mostrar UI accionable con retry +
        // instrucciones de reinstalacion.
        //
        // El usuario en primera vez post-reinstall que reciba este error ve
        // el error_db UI con la opcion "Limpiar y continuar" que muestra
        // Alert pidiendo reinstalar Expo Go (que es exactamente el caso
        // donde el bug original `near NOT` se manifiesta).
        logger.warn('AuthGate', 'error en deteccion de estado', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelado) {
          setErrorMessage(
            error instanceof Error
              ? `Error al inicializar la app: ${error.message}`
              : 'Error desconocido al inicializar la app',
          );
          setDecision('error_db');
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [intentoDeteccion]);

  const handleLoginSuccess = useCallback(() => {
    setDecision('con_sesion');
  }, []);

  const handleSetupComplete = useCallback(() => {
    // SetupInicial ya invoco guardarSesion + useWorkspace.setSesionCompleta.
    // Solo necesitamos cambiar el decision para que AuthGate renderice el
    // RootNavigator en lugar de la pantalla de setup.
    setDecision('con_sesion');
  }, []);

  const handleLogoutRequested = useCallback(async () => {
    await limpiarSesion();
    useWorkspace.getState().limpiarWorkspace();
    setDecision('sin_sesion');
  }, []);

  const listo = splashComplete && decision !== 'loading';

  useEffect(() => {
    if (listo) {
      SplashScreen.hideAsync().catch(() => {
        // Silencioso: hideAsync puede fallar si ya fue llamado.
      });
    }
  }, [listo]);

  // El splash nativo de Expo (App.tsx) esta activo hasta que llamemos
  // SplashScreen.hideAsync() desde el useEffect con [listo].
  //
  // Arquitectura correcta: SIEMPRE renderizar la pantalla real + el splash
  // animado como overlay encima (position:absolute, zIndex alto). El splash
  // se mantiene SIEMPRE MONTADO — cuando la animacion termina, NO se
  // desmonta; se auto-oculta via `display:none`. Esto evita que el React
  // cleanup cancele los setTimeouts de la animacion si el padre decide
  // desmontar el splash por otra razon. Asi:
  //   - decision='loading' → splash a pantalla completa (splashCompleto=false,
  //     la animacion esta corriendo debajo, el splash cubre todo)
  //   - decision cambia → app se renderiza DEBAJO del splash mientras la
  //     animacion termina
  //   - animacion termina → setSplashComplete(true), useEffect [listo]
  //     dispara SplashScreen.hideAsync() del splash nativo

  let contenido: React.ReactNode;
  if (decision === 'error_db') {
    contenido = (
      <View style={estilos.contenedor} testID="auth-gate-error-db">
        <Text style={estilos.errorTitulo}>No pudimos verificar tu sesión</Text>
        <Text style={estilos.errorMensaje}>{errorMessage}</Text>
        <Pressable
          style={estilos.botonReintentar}
          onPress={() => {
            setDecision('loading');
            setErrorMessage('');
            setIntentoDeteccion((intentoActual) => intentoActual + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Reintentar verificación de sesión"
          accessibilityHint="Vuelve a consultar los datos locales del operario"
          testID="auth-gate-error-retry"
        >
          <Text style={estilos.botonReintentarTexto}>Reintentar</Text>
        </Pressable>
        <Pressable
          style={estilos.botonClear}
          onPress={() => {
            // TODO: clear AsyncStorage + pedir al user que reinstale.
            // Por ahora, navegar a Login con warning.
            Alert.alert(
              'Datos corruptos',
              'Si el problema persiste, desinstala Expo Go y vuelve a instalar.',
              [{ text: 'OK', onPress: () => setDecision('sin_sesion') }],
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Limpiar y continuar"
          accessibilityHint="Muestra instrucciones de reinstalación y permite continuar al Login"
          testID="auth-gate-error-clear"
        >
          <Text style={estilos.botonClearTexto}>Limpiar y continuar</Text>
        </Pressable>
      </View>
    );
  } else if (decision === 'sin_setup') {
    contenido = <SetupInicial onComplete={handleSetupComplete} />;
  } else if (decision === 'sin_sesion') {
    contenido = (
      <Login
        onLoginSuccess={handleLoginSuccess}
        mensajeInicial={mensajeInicial}
      />
    );
  } else if (decision === 'con_sesion') {
    contenido = (
      <NavigationContainer>
        <RootNavigator onLogoutRequested={handleLogoutRequested} />
      </NavigationContainer>
    );
  } else {
    // decision === 'loading' → cold boot puro (no decision aun). El splash
    // se muestra a pantalla completa via el overlay que sigue montado.
    contenido = null;
  }

  return (
    <View style={{ flex: 1 }}>
      {contenido}
      <SplashAnimado
        onAnimationEnd={() => setSplashComplete(true)}
        logo={require('../../assets/logo-epc.png')}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.xl,
  },
  errorTitulo: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  errorMensaje: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 480,
    marginBottom: SPACING.xl,
  },
  botonReintentar: {
    width: '100%',
    maxWidth: 360,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  botonReintentarTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
  },
  botonClear: {
    width: '100%',
    maxWidth: 360,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  botonClearTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
});
