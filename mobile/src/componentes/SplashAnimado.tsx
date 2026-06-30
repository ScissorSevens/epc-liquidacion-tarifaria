import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Color de marca del splash — inline por scope cerrado del change.
 * NO mover a skeletal-tokens.ts. Es identidad visual del splash,
 * no parte del sistema de diseño reusable.
 */
const COLOR_FONDO_SPLASH = '#3596C8';

const FASE_1_DURACION_MS = 500;
const FASE_2_DURACION_MS = 700;
const FASE_3_DURACION_MS = 400;

/** Easing expo-out del material spec (curva de deceleracion fuerte). */
const EASING_EXPO_OUT = Easing.bezier(0.16, 1, 0.3, 1);

interface Props {
  readonly onAnimationEnd: () => void;
  readonly logo: ImageSourcePropType;
}

/**
 * Overlay de splash animado. Tres fases encadenadas:
 *   1. (0-500ms)   reveal: opacity 0->1, scale 0.92->1, easing expo-out.
 *   2. (500-1200ms) micro-pulse: scale 1 -> 1.02 -> 1, easing lineal.
 *   3. (1200-1600ms) fade-out: opacity 1->0, easing expo-out.
 * Sin rotacion, sin translateY.
 *
 * Invoca `onAnimationEnd` cuando la fase 3 termina.
 */
export function SplashAnimado({ onAnimationEnd, logo }: Props) {
  const opacidad = useSharedValue(0);
  const escala = useSharedValue(0.92);
  const callbackRef = useRef(onAnimationEnd);
  callbackRef.current = onAnimationEnd;

  useEffect(() => {
    opacidad.value = withTiming(1, {
      duration: FASE_1_DURACION_MS,
      easing: EASING_EXPO_OUT,
    });
    escala.value = withTiming(
      1,
      { duration: FASE_1_DURACION_MS, easing: EASING_EXPO_OUT },
      (finFase1) => {
        if (!finFase1) return;
        escala.value = withTiming(
          1.02,
          { duration: FASE_2_DURACION_MS / 2, easing: Easing.linear },
          (finFase2a) => {
            if (!finFase2a) return;
            escala.value = withTiming(
              1,
              { duration: FASE_2_DURACION_MS / 2, easing: Easing.linear },
              (finFase2b) => {
                if (!finFase2b) return;
                opacidad.value = withTiming(
                  0,
                  { duration: FASE_3_DURACION_MS, easing: EASING_EXPO_OUT },
                  (finFase3) => {
                    if (finFase3) {
                      runOnJS(callbackRef.current)();
                    }
                  },
                );
              },
            );
          },
        );
      },
    );

    // Cleanup: cancelar worklets y animaciones pendientes en unmount.
    // Sin esto, hot reload puede dejar referencias activas que disparan
    // setState sobre componentes desmontados (React warning). Ver scenario
    // 1.8 del spec splash-logo-animado.
    return () => {
      cancelAnimation(opacidad);
      cancelAnimation(escala);
    };
  }, []);

  const estiloAnimado = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ scale: escala.value }],
  }));

  return (
    <View style={estilos.overlay}>
      <Animated.View style={[estilos.contenedor, estiloAnimado]}>
        <Image source={logo} style={estilos.imagen} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLOR_FONDO_SPLASH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  contenedor: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagen: {
    width: '100%',
    height: '100%',
  },
});