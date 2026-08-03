// mobile/__tests__/hooks/useReducedMotion.test.ts
//
// Tests contractuales del hook useReducedMotion.
//
// Regla de impecable:
//   "Reduced motion is not optional. Every animation needs an alternative."
//
// El hook expone la preferencia del SO (iOS: Settings > Accessibility >
// Motion > Reduce Motion; Android: Settings > Accessibility > Remove
// animations). Devuelve `false` por defecto (motion completo) y `true`
// cuando el usuario activo la preferencia.
//
// Contrato:
//   - Inicial: `false` hasta que `AccessibilityInfo.isReduceMotionEnabled()`
//     resuelve (asincronico).
//   - Live: si el usuario cambia la preferencia en OS Settings mientras la
//     app corre, el listener `reduceMotionChanged` debe actualizar el valor.
//   - Cleanup: el listener debe desuscribirse en unmount (no leak).
//
// Estrategia de mock: NO reemplazamos `react-native` entero (romperia el
// preset `jest-expo` y dispararia TurboModuleRegistry por cargar el RN
// real). En su lugar, mutamos las propiedades del `AccessibilityInfo`
// que jest-expo ya provee — es un objeto plano con `isReduceMotionEnabled`
// y `addEventListener` como metodos. Restauramos los originales en
// `afterAll` para no contaminar otros test files.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../../src/hooks/useReducedMotion';

// ── Spies locales ─────────────────────────────────────────────────────────────
type ListenerCb = (enabled: boolean) => void;

const mockRemove = jest.fn();
const mockListenerCallbacks: ListenerCb[] = [];

const mockIsReduceMotionEnabled = jest.fn<Promise<boolean>, []>(
  () => new Promise<boolean>(() => {}), // default: pending
);

const mockAddEventListener = jest.fn<
  { remove: () => void },
  [string, ListenerCb]
>((_eventName: string, cb: ListenerCb) => {
  mockListenerCallbacks.push(cb);
  return { remove: mockRemove };
});

// Guardamos los originales para restaurar al final.
const originalIsReduceMotionEnabled = AccessibilityInfo.isReduceMotionEnabled;
const originalAddEventListener = AccessibilityInfo.addEventListener;

beforeAll(() => {
  (AccessibilityInfo as any).isReduceMotionEnabled = mockIsReduceMotionEnabled;
  (AccessibilityInfo as any).addEventListener = mockAddEventListener;
});

afterAll(() => {
  (AccessibilityInfo as any).isReduceMotionEnabled = originalIsReduceMotionEnabled;
  (AccessibilityInfo as any).addEventListener = originalAddEventListener;
});

describe('useReducedMotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListenerCallbacks.length = 0;
    // Reset al default (pending) — tests que necesiten resolucion lo
    // sobrescriben con mockResolvedValue.
    mockIsReduceMotionEnabled.mockImplementation(
      () => new Promise<boolean>(() => {}),
    );
    mockAddEventListener.mockImplementation((_e: string, cb: ListenerCb) => {
      mockListenerCallbacks.push(cb);
      return { remove: mockRemove };
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-RM-1 — Estado inicial: false mientras la promesa de RN no resuelve
  //
  // Aunque en la realidad la API resuelve rapido (<1 frame), el primer
  // render siempre debe devolver `false` para evitar parpadeos: si una
  // animacion arrancara antes de saber el valor, veriamos motion para
  // un usuario que lo desactivo. Por eso `useState(false)` y no
  // `useState<boolean | null>(null)`.
  // ─────────────────────────────────────────────────────────────────────
  it('T-RM-1 retorna false por defecto antes que isReduceMotionEnabled resuelva', () => {
    // mockIsReduceMotionEnabled ya devuelve una Promise pendiente.
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-RM-2 — Resolucion con `true` → el hook expone `true`
  //
  // Verifica que cuando el SO reporta "reduce motion on", el state
  // efectivamente pasa a `true`. Usamos `act()` para que React procese
  // la actualizacion del setState disparada por el `.then()`.
  // ─────────────────────────────────────────────────────────────────────
  it('T-RM-2 retorna true cuando AccessibilityInfo resuelve con true', async () => {
    mockIsReduceMotionEnabled.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useReducedMotion());

    // Efecto ya corrio (commit), promesa pendiente. Flush microtasks.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-RM-3 — Resolucion con `false` → el hook expone `false`
  //
  // Caso comun: usuario con motion completo. El hook debe terminar en
  // `false` (mismo valor que el inicial, pero la ruta es distinta:
  // pasa por el `.then(false)`). Coverage de la rama `setReduced(false)`
  // explicita dentro del `.then`.
  // ─────────────────────────────────────────────────────────────────────
  it('T-RM-3 retorna false cuando AccessibilityInfo resuelve con false', async () => {
    mockIsReduceMotionEnabled.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useReducedMotion());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-RM-4 — Listener live: cambios en OS Settings se reflejan en vivo
  //
  // Caso UX: operario activa Reduce Motion en OS Settings mientras la
  // app esta abierta. El hook debe actualizarse sin necesidad de
  // remontar. Capturamos el callback registrado y lo invocamos a mano.
  // ─────────────────────────────────────────────────────────────────────
  it('T-RM-4 actualiza el estado cuando reduceMotionChanged emite true', async () => {
    // La promesa inicial resuelve con false (motion normal).
    mockIsReduceMotionEnabled.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useReducedMotion());

    // Flush de la promesa inicial.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    // El hook ya registro el listener. Lo capturamos.
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'reduceMotionChanged',
      expect.any(Function),
    );
    const liveCallback = mockListenerCallbacks[0];
    expect(liveCallback).toBeDefined();

    // Simulamos que el OS emite el cambio a `true`.
    await act(async () => {
      liveCallback!(true);
    });

    expect(result.current).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────
  // T-RM-5 — Cleanup: el listener se desuscribe en unmount
  //
  // Memory leak prevention. Si el listener quedara registrado, cada
  // vez que el usuario navega entre pantallas que montan/desmontan
  // un icono animado se acumulan handlers zombies. RN no avisa con
  // un warning claro, pero en perfiles largos vemos CPU al 100%.
  // ─────────────────────────────────────────────────────────────────────
  it('T-RM-5 desuscribe el listener (sub.remove) al desmontar', () => {
    const { unmount } = renderHook(() => useReducedMotion());

    // El listener fue registrado durante el commit del efecto.
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    // Pero .remove() aun NO fue llamado.
    expect(mockRemove).not.toHaveBeenCalled();

    // Unmount → cleanup corre.
    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});