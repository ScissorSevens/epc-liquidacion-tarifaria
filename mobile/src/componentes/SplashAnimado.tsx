import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

/**
 * Color de marca del splash — inline por scope cerrado del change.
 * NO mover a skeletal-tokens.ts. Es identidad visual del splash,
 * no parte del sistema de diseño reusable.
 */
const COLOR_FONDO_SPLASH = '#3596C8';

const FASE_1_DURACION_MS = 500;
const FASE_2_DURACION_MS = 700;
const FASE_3_DURACION_MS = 400;

interface Props {
  readonly onAnimationEnd: () => void;
  readonly logo: ImageSourcePropType;
}

/**
 * Overlay de splash animado. Tres fases encadenadas, 100% JS puro (sin
 * reanimated/worklets) para no depender de native bindings que rompen
 * Expo Go cuando se actualiza el bundle:
 *   1. (0-500ms)   reveal: opacity 0->1, scale 0.92->1.
 *   2. (500-1200ms) micro-pulse: scale 1 -> 1.02 -> 1.
 *   3. (1200-1600ms) fade-out: opacity 1->0.
 *
 * Invoca `onAnimationEnd` cuando la fase 3 termina. Tambien tiene un
 * fallback de 2500ms (max) por si alguna transicion se cuelga.
 *
 * AUTO-OCULTAMIENTO: cuando la animacion termina (`terminoAnimacion=true`),
 * el componente NO se desmonta — sigue montado pero invisible (`display:none`).
 * Esto evita que el React cleanup del useEffect cancele los setTimeouts
 * antes de tiempo si el padre decide desmontar el splash por otra razon.
 */
export function SplashAnimado({ onAnimationEnd, logo }: Props) {
  const [opacidad, setOpacidad] = useState(0);
  const [escala, setEscala] = useState(0.92);
  const [terminoAnimacion, setTerminoAnimacion] = useState(false);
  const callbackRef = useRef(onAnimationEnd);
  callbackRef.current = onAnimationEnd;
  const disparadoRef = useRef(false);

  useEffect(() => {
    function dispararFin() {
      if (disparadoRef.current) return;
      disparadoRef.current = true;
      setTerminoAnimacion(true);
      callbackRef.current();
    }

    // FASE 1: reveal (opacity 0->1, scale 0.92->1) en 500ms
    const t1 = setTimeout(() => setOpacidad(1), 16);
    const t2 = setTimeout(() => setEscala(1), 16);

    // FASE 2: micro-pulse en 700ms (350ms up, 350ms down)
    const t3 = setTimeout(() => setEscala(1.02), FASE_1_DURACION_MS);
    const t4 = setTimeout(() => setEscala(1), FASE_1_DURACION_MS + FASE_2_DURACION_MS / 2);

    // FASE 3: fade-out en 400ms
    const t5 = setTimeout(() => setOpacidad(0), FASE_1_DURACION_MS + FASE_2_DURACION_MS);

    // Disparar fin de splash cuando termina la fase 3
    const tFin = setTimeout(
      dispararFin,
      FASE_1_DURACION_MS + FASE_2_DURACION_MS + FASE_3_DURACION_MS,
    );

    // Fallback duro por si algo se cuelga
    const tSafety = setTimeout(dispararFin, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(tFin);
      clearTimeout(tSafety);
    };
  }, []);

  return (
    <View
      style={[estilos.overlay, terminoAnimacion && { display: 'none' }]}
      pointerEvents={terminoAnimacion ? 'none' : 'auto'}
    >
      <View
        style={[
          estilos.contenedor,
          {
            opacity: opacidad,
            transform: [{ scale: escala }],
          },
        ]}
      >
        <Image source={logo} style={estilos.imagen} resizeMode="contain" />
      </View>
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
