/**
 * Hook que detecta si el sistema operativo tiene "Reduce Motion" activado
 * en las preferencias de accesibilidad.
 *
 * Por defecto retorna `false` (motion completo). Si el usuario tiene
 * "Reduce Motion" activado en OS Settings (iOS: Settings > Accessibility >
 * Motion > Reduce Motion; Android: Settings > Accessibility > Remove
 * animations), retorna `true`.
 *
 * Regla de impecable: "Reduced motion is not optional. Every animation
 * needs an alternative." Toda animacion en la app que use este hook debe
 * tener una rama para cuando retorna `true` (tipicamente un crossfade
 * instantaneo o saltarse la transicion por completo).
 *
 * Implementacion:
 *   1. Estado inicial `false` (no `null`) para que el primer render nunca
 *      dispare animacion — evita parpadeo en usuarios con Reduce Motion.
 *   2. `useEffect` consulta `AccessibilityInfo.isReduceMotionEnabled()` en
 *      mount y se suscribe al evento `reduceMotionChanged` para reaccionar
 *      a cambios en vivo (ej: operario activa Reduce Motion en OS Settings
 *      mientras la app esta abierta).
 *   3. Cleanup desuscribe el listener (`sub.remove()`) para evitar leaks
 *      cuando el componente se desmonta.
 *
 * NOTA sobre el flag `cancelled`: aunque el listener se desuscribe en
 * cleanup, existe una ventana entre el `addEventListener` y el eventual
 * flush del `.then()` de `isReduceMotionEnabled()`. Si el usuario
 * remonta el componente dentro de esa ventana, queremos descartar la
 * resolucion tardia para no aplicar un valor obsoleto.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Resolucion asincronica del estado inicial.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduced(enabled);
      })
      .catch(() => {
        // En plataformas que no soportan la API (ej: web muy vieja),
        // default a false (motion completo). El usuario no vera
        // animacion reducida por error.
      });

    // Suscripcion a cambios en vivo. `addEventListener` retorna un
    // objeto con `.remove()` para limpieza explicita (RN 0.65+).
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduced(enabled),
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}