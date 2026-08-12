// mobile/src/pantallas/admin/componentes/ParametrosTarifaAgua.tsx
//
// Subcomponente `ParametrosTarifaAgua` — sección "Agua y suscriptores"
// del screen admin ParametrosTarifa (Decompose Phase 2 task 2.3).
//
// Migración verbatim del bloque `<SeccionForm titulo="Agua y suscriptores ...">`
// del screen original. TODOS los testIDs, comments y helperTexts se preservan
// para no romper los 4+ tests existentes que dependen de estos contratos.
//
// Inputs: aguaSuministrada, ipuf, suscriptoresPromedio.
// Errores inline: errores.suscriptores.
// testIDs: param-agua, param-ipuf, param-suscriptores.

import * as React from 'react';
import type { RefObject } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';

import { FormField } from '../../../componentes/FormField';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { SPACING } from '../../../theme/skeletal-tokens';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

/**
 * Solo las keys de scroll-to-first-error que esta sección puede
 * gatillar. Narrowed del union `CampoConError` del screen.
 */
type CampoConErrorSeccion = 'suscriptores';

export interface ParametrosTarifaAguaProps {
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
 * "Agua y suscriptores" del form.
 */
export function ParametrosTarifaAgua({
  formState,
  guardando,
  getRef,
}: ParametrosTarifaAguaProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;

  return (
    <SeccionForm
      titulo="Agua y suscriptores (insumo ASP = AS - IPUF×12×N)"
      icono="water-drop"
      testID="seccion-card-agua"
    >
      <View style={estilos.campo}>
        <FormField
          label="Agua Suministrada año base (m³/año)"
          value={formState.values.aguaSuministrada}
          onChangeText={formState.setters.setAguaSuministrada}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          testID="param-agua"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="IPUF (m³/suscriptor/mes, art. 5, estándar 6)"
          value={formState.values.ipuf}
          onChangeText={formState.setters.setIpuf}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Estándar CRA: 6 m³/suscriptor/mes"
          testID="param-ipuf"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Suscriptores promedio (N) — divisor de CF = CMA/N"
          value={formState.values.suscriptoresPromedio}
          onChangeText={formState.setters.setSuscriptoresPromedio}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          error={formState.errores.suscriptores}
          ref={getRef('suscriptores')}
          testID="param-suscriptores"
        />
      </View>
    </SeccionForm>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: SPACING.xs },
});

export default ParametrosTarifaAgua;
