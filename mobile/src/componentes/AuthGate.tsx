import { useCallback, useEffect, useState } from 'react';
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

type Decision = 'loading' | 'sin_setup' | 'sin_sesion' | 'con_sesion';

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

  useEffect(() => {
    // La deteccion arranca INMEDIATAMENTE al montar (empty deps).
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

        // 1. ¿Hay prestadores en la DB local?
        //    Si NO hay, estamos en sin_setup — el operario debe pasar
        //    por el wizard de SetupInicial antes de poder loguearse.
        const prestadores = await bootstrap.prestadorRepo.listar();
        if (cancelado) return;

        if (prestadores.length === 0) {
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
      } catch (err) {
        // Falla inesperada del bootstrap o carga de sesion: caemos
        // conservadoramente a sin_sesion para que el operario al menos
        // vea el Login y pueda re-intentar.
        logger.warn('AuthGate', 'error en deteccion de estado', { error: String(err) });
        if (!cancelado) {
          setDecision('sin_sesion');
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

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

  if (decision === 'loading') {
    return (
      <SplashAnimado
        onAnimationEnd={() => setSplashComplete(true)}
        logo={require('../../assets/logo-epc.png')}
      />
    );
  }

  if (decision === 'sin_setup') {
    // Wizard de 2 pasos: paso 1 (datos del prestador) → paso 2 (datos del
    // primer operario + consent). Al finalizar, bootstrapCompleto() crea
    // prestador + acuerdo + parametros + operario atomicamente, persiste
    // la sesion, sincroniza useWorkspace, y llama onComplete.
    return <SetupInicial onComplete={handleSetupComplete} />;
  }

  if (decision === 'sin_sesion') {
    // PUNTO C: pasamos mensajeInicial para que Login muestre el banner
    // amarillo "Tu sesion anterior vencio" arriba del form cuando el
    // estado clasificado fue 'vencida'. En cold-boot limpio o 'invalida',
    // mensajeInicial queda undefined y Login rendea sin banner.
    return <Login onLoginSuccess={handleLoginSuccess} mensajeInicial={mensajeInicial} />;
  }

  return (
    <NavigationContainer>
      <RootNavigator onLogoutRequested={handleLogoutRequested} />
    </NavigationContainer>
  );
}