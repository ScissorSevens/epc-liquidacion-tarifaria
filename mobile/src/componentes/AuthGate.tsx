import { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';

import { SplashAnimado } from './SplashAnimado';
import Login from '../pantallas/Login';
import RootNavigator from '../navegacion/RootNavigator';
import { cargarSesion, limpiarSesion } from '../composition/constantes';

type Decision = 'loading' | 'sin_sesion' | 'con_sesion';

/**
 * Componente raiz de autenticacion.
 *
 * Decide que mostrar en el cold-boot segun la sesion persistida en AsyncStorage:
 *   - loading: renderiza SplashAnimado mientras decide.
 *   - sin_sesion: renderiza Login.
 *   - con_sesion: renderiza NavigationContainer(RootNavigator).
 *
 * Dual-flag anti-flicker: solo invoca `SplashScreen.hideAsync()` cuando
 * AMBAS condiciones son verdaderas:
 *   - `splashNaturalComplete` (SplashAnimado reporto onAnimationEnd).
 *   - `decision !== 'loading'` (AuthGate resolvio login o main).
 * Esto evita parpadeo en cualquier orden de resolucion.
 */
export function AuthGate() {
  const [decision, setDecision] = useState<Decision>('loading');
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void cargarSesion().then((sesion) => {
      if (cancelado) return;
      setDecision(sesion ? 'con_sesion' : 'sin_sesion');
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setDecision('con_sesion');
  }, []);

  const handleLogoutRequested = useCallback(async () => {
    await limpiarSesion();
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

  if (decision === 'sin_sesion') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer>
      <RootNavigator onLogoutRequested={handleLogoutRequested} />
    </NavigationContainer>
  );
}