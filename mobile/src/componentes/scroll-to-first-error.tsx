// mobile/src/componentes/scroll-to-first-error.tsx
//
// Helper para hacer scroll al primer FormField con error tras submit.
// Patron: tras tocar "Guardar", validamos todo, marcamos errores en
// state, y si hay errores scrolleamos al primero para que el operario
// vea el problema sin scrollear manualmente.
//
// Uso:
//   const scrollRef = useRef<ScrollView>(null);
//   const { getRef } = useFormFieldRefs<keyof FormState>();
//   // ... en el submit:
//   if (!validarTodo()) {
//     scrollToFirstError(scrollRef, errores, getRef);
//     return;
//   }
//
// Esto se usa en AltaSuscriptor y EditarSuscriptor despues de la
// migracion a FormField (Commit 7 — impeccable craft).

import { useRef } from 'react';
import type { RefObject } from 'react';
import {
  findNodeHandle,
  ScrollView,
  UIManager,
  type View,
} from 'react-native';

/**
 * Tipo generico de errores: Record<string, string | undefined>.
 * Cada screen define su propio tipo narrowed (e.g. ErroresAltaSuscriptor).
 */
export type FormErrors = Record<string, string | undefined>;

/**
 * Map de refs por nombre de campo. Cada FormField expone su `testID`
 * como `testID-field` para que el callsite pueda buscar el View nativo
 * via findNodeHandle.
 */
export type FormFieldRefs<K extends string> = Partial<Record<K, RefObject<View | null>>>;

/**
 * Hook que crea un map de refs por nombre de campo. El callsite hace:
 *   const { getRef } = useFormFieldRefs<keyof FormState>();
 *   <FormField {...register('nombre')} />
 * donde `register` retorna:
 *   { testID: `field-${key}`, ref: getRef(key) }
 */
export function useFormFieldRefs<K extends string>(): {
  refs: FormFieldRefs<K>;
  getRef: (key: K) => RefObject<View | null>;
} {
  // Usamos un solo Map mutable para evitar recrear N refs en cada render.
  // Cada callsite que use este hook debe pasar SIEMPRE las mismas keys.
  const refs = useRef<FormFieldRefs<K>>({}).current;

  const getRef = (key: K): RefObject<View | null> => {
    if (refs[key] === undefined) {
      refs[key] = { current: null };
    }
    return refs[key] as RefObject<View | null>;
  };

  return { refs, getRef };
}

/**
 * Scrollea el ScrollView al primer FormField que tenga error en el map
 * `errors`. Si no hay errores, no hace nada.
 *
 * Algoritmo:
 *   1. Itera las keys de `errors` en orden de declaracion.
 *   2. Para la primera key con error no-vacio, busca el View nativo via
 *      findNodeHandle(ref).
 *   3. Llama UIManager.measure para obtener la posicion absoluta.
 *   4. Calcula el offset relativo al ScrollView.
 *   5. Llama scrollView.scrollTo({ y, animated: true }).
 *
 * Por que UIManager.measure y no scrollTo con offset hardcoded:
 *   - Los FormField viven en distintos secciones con marginTop/bottom
 *     variables. Hardcodear offsets seria fragil ante cualquier cambio.
 *   - UIManager.measure da la posicion REAL en pantalla al momento del
 *     submit, lo cual es robusto.
 */
export function scrollToFirstError<K extends string>(
  scrollRef: RefObject<ScrollView | null>,
  errors: FormErrors,
  refs: FormFieldRefs<K>,
): void {
  if (scrollRef.current === null) return;

  // Iteramos las keys en orden (Object.keys preserva orden de insercion
  // en ES2015+ para string keys no-numericas, que es nuestro caso).
  const keys = Object.keys(errors) as K[];
  for (const key of keys) {
    const error = errors[key];
    if (error === undefined || error === '') continue;

    const ref = refs[key];
    if (ref === undefined || ref.current === null) continue;

    const node = findNodeHandle(ref.current);
    if (node === null || node === undefined) continue;

    // Medimos la posicion absoluta del View con error.
    UIManager.measure(
      node,
      (_xAbs, _yAbs, _width, _height, _pageX, pageY) => {
        // pageY es la Y absoluta en pantalla. Necesitamos la Y dentro
        // del ScrollView. La diferencia: restamos el Y del scrollView
        // contenedor.
        const scrollNode = findNodeHandle(scrollRef.current);
        if (scrollNode === null || scrollNode === undefined) return;

        UIManager.measure(
          scrollNode,
          (_sx, _sy, _sw, _sh, _spx, spy) => {
            // Offset objetivo: la Y absoluta del campo con error menos
            // la Y del scrollView, menos un margen para que el campo no
            // quede pegado al borde superior.
            const targetY = Math.max(0, pageY - spy - 24);

            scrollRef.current?.scrollTo({
              y: targetY,
              animated: true,
            });
          },
        );
      },
    );

    // Salimos del loop tras el primer error; UIManager.measure es async.
    return;
  }
}