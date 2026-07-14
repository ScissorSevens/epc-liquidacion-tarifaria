import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';

import { SplashAnimado } from './SplashAnimado';
import Login from '../pantallas/Login';
import RootNavigator from '../navegacion/RootNavigator';
import { cargarSesion, limpiarSesion, type Sesion } from '../composition/constantes';
import { getBootstrap } from '../composition/get-bootstrap';
import { useWorkspace } from '../composicion/useWorkspace';
import { logger } from '../composicion/logger';

type Decision = 'loading' | 'sin_setup' | 'sin_sesion' | 'con_sesion';

/**
 * Componente raiz de autenticacion.
 *
 * Decide que mostrar en el cold-boot segun dos senales independientes:
 *   1. Bootstrap: hay al menos un prestador en la DB local?
 *      - NO  -> sin_setup (placeholder de SetupInicial, implementado en 5.1)
 *      - SI  -> continuar
 *   2. Sesion: hay una sesion persistida valida en AsyncStorage?
 *      - NO / vencida -> sin_sesion (Login)
 *      - SI           -> con_sesion (RootNavigator + sync useWorkspace)
 *
 * Estados renderizados:
 *   - loading:    SplashAnimado mientras decide
 *   - sin_setup:  Placeholder textual "Setup inicial pendiente" (5.1)
 *   - sin_sesion: Login (stub en 4.2.3, real en 5.2)
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
        // 1. ¿Hay prestadores en la DB local?
        //    Si NO hay, estamos en sin_setup — el operario debe pasar
        //    por el wizard de SetupInicial antes de poder loguearse.
        const { prestadorRepo } = await getBootstrap();
        const prestadores = await prestadorRepo.listar();
        if (cancelado) return;

        if (prestadores.length === 0) {
          setDecision('sin_setup');
          return;
        }

        // 2. ¿Hay sesion persistida valida?
        const sesion = await cargarSesion();
        if (cancelado) return;

        if (sesion === null) {
          setDecision('sin_sesion');
          return;
        }

        // 3. Sync del workspace con la sesion resuelta y decision final.
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
    // Placeholder temporal — la pantalla SetupInicial completa se
    // implementa en Fase 5 Tarea 5.1. Mostramos texto plano para que el
    // orquestador pueda verificar el estado sin_setup sin tener que
    // implementar el wizard todavia.
    return (
      <Text testID="placeholder-setup-inicial">
        Setup inicial pendiente — se implementa en 5.1
      </Text>
    );
  }

  if (decision === 'sin_sesion') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <RootNavigator onLogoutRequested={handleLogoutRequested} />
    </NavigationContainer>
  );
}