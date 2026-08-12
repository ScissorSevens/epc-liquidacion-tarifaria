// mobile/src/pantallas/admin/componentes/ParametrosTarifaPeriodo.tsx
//
// Subcomponente `ParametrosTarifaPeriodo` — sección "Periodo y vigencia"
// del screen admin ParametrosTarifa (Decompose Phase 2 task 2.1).
//
// Migración verbatim del bloque `<SeccionForm titulo="Periodo y vigencia">`
// del screen original. TODOS los testIDs, comments B/B/B, helperTexts y
// prop accessibilityHint se preservan para no romper los 9+ tests
// existentes que dependen de estos contratos.
//
// Inputs: periodo, anioBase, vigenteDesde, vigenteHasta.
// Errores inline: errores.anioBase, errores.vigenteHasta.
// testIDs: param-periodo, param-anio-base, param-vigente-desde,
//          param-vigente-hasta.
//
// DECISION B/B/B:
//   - `formState` (tipo del hook) se pasa por prop para evitar 18 props
//     sueltas. Mantiene data flow explicito y cohesión: el subcomponente
//     solo lee lo que necesita del hook.
//   - `getRef` se narrow-ea a las keys que esta sección usa
//     (`'vigenteHasta'`) — type-safe via variance de TypeScript.
//   - El testID `param-anio-base` ya NO se renderiza en esta sección
//     (cleanup C-1/A-2 de `param-tarifa-residuales-cra-825` verify-report):
//     el input de Año se elimino del bloque "Periodo y vigencia" porque
//     estaba duplicado con el de "Indexación IPC". Se preserva el
//     testID en la sección IPC para no romper 50+ tests. Acá el
//     placeholder queda con un `<View>` vacío equivalente a no render.

import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import type { RefObject, View as RNView } from 'react-native';

import { FormField } from '../../../componentes/FormField';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { SPACING } from '../../../theme/skeletal-tokens';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

/**
 * Solo las keys de scroll-to-first-error que esta sección puede
 * gatillar. Narrowed del union `CampoConError` del screen.
 */
type CampoConErrorSeccion = 'vigenteHasta';

export interface ParametrosTarifaPeriodoProps {
  /** Hook return — values, setters, errores, cargandoInputs. */
  readonly formState: UseParametrosFormStateReturn;
  /** True mientras `repo.guardar()` está en curso (UI: spinner). */
  readonly guardando: boolean;
  /**
   * Map de refs para scroll-to-first-error. Narrowed a las keys que
   * esta sección puede exhibir como error inline.
   */
  readonly getRef: (key: CampoConErrorSeccion) => RefObject<RNView | null>;
}

/**
 * Subcomponente presentational puro. Recibe el `formState` del hook +
 * la `getRef` del screen + el flag `guardando`. Renderiza la sección
 * "Periodo y vigencia" del form.
 *
 * No tiene state interno — todo viene por props. El subcomponente es
 * un "dumb component" en el sentido de Smart/Dumb (Martin Fowler):
 * el hook maneja state, el subcomponente solo formatea.
 */
export function ParametrosTarifaPeriodo({
  formState,
  guardando,
  getRef,
}: ParametrosTarifaPeriodoProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;

  return (
    <SeccionForm titulo="Periodo y vigencia" icono="event" testID="seccion-card-periodo">
      <View style={estilos.campo}>
        <FormField
          label="Periodo (año tarifario, 5 años)"
          required
          value={formState.values.periodo}
          onChangeText={formState.setters.setPeriodo}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          testID="param-periodo"
        />
      </View>
      {/* Cleanup C-1/A-2 (verify-report `param-tarifa-residuales-cra-825`):
          El input `anio_base` estaba duplicado en dos FormFields (uno
          en "Periodo y vigencia" + otro en "Indexación IPC") bindeando
          el mismo state. UX confusa: editar uno actualizaba el otro y
          el error inline solo aparecía en el segundo. Decisión B/B/B:
          mantener el de la sección IPC por agrupación conceptual
          (anio_base + anio_destino + factor + ipuf_indice viven juntos).
          El input de "Periodo y vigencia" se elimina. El label del
          sobreviviente ya aclara "Año de referencia para la tabla IPC
          del DANE", coherente con la sección. */}
      <View style={estilos.campo}>
        <FormField
          label="Vigente desde (YYYY-MM-DD)"
          value={formState.values.vigenteDesde}
          onChangeText={formState.setters.setVigenteDesde}
          editable={editable}
          selectable
          tabularNums
          accessibilityHint="Fecha de inicio de vigencia del periodo tarifario"
          testID="param-vigente-desde"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Vigente hasta (YYYY-MM-DD)"
          value={formState.values.vigenteHasta}
          onChangeText={formState.setters.setVigenteHasta}
          editable={editable}
          selectable
          tabularNums
          accessibilityHint="Fecha de fin de vigencia del periodo tarifario"
          error={formState.errores.vigenteHasta}
          ref={getRef('vigenteHasta')}
          testID="param-vigente-hasta"
        />
      </View>
    </SeccionForm>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: SPACING.xs },
});

export default ParametrosTarifaPeriodo;
