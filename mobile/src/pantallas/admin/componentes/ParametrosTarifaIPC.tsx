// mobile/src/pantallas/admin/componentes/ParametrosTarifaIPC.tsx
//
// Subcomponente `ParametrosTarifaIPC` — sección "Indexación IPC" del
// screen admin ParametrosTarifa (Decompose Phase 2 task 2.6).
//
// Migración verbatim del bloque `<SeccionForm titulo="Indexación IPC ...">`
// del screen original. TODOS los testIDs, helperTexts, comments y el
// preview live con `calcularFactorIpc` (Res CRA 825/2017 Art. 11) se
// preservan para no romper los 4+ tests existentes.
//
// Inputs: anioBase, anioDestino, factorIpc, ipufIndice.
// Errores inline: errores.anioBase, errores.anioDestino,
//                 errores.factorIpc, errores.ipufIndice.
// testIDs: param-anio-base-ipc, param-anio-destino, param-factor-ipc,
//          param-ipuf-indice, param-ipc-preview.

import * as React from 'react';
import type { RefObject } from 'react';
import { StyleSheet, Text, View, type View as RNView } from 'react-native';

import { FormField } from '../../../componentes/FormField';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import { calcularFactorIpc } from '../../../../dominio/parametros-tarifa/ipc';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

/**
 * Solo las keys de scroll-to-first-error que esta sección puede
 * gatillar. Narrowed del union `CampoConError` del screen.
 */
type CampoConErrorSeccion = 'anioBase' | 'anioDestino' | 'factorIpc' | 'ipufIndice';

export interface ParametrosTarifaIPCProps {
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

/** Helper: parsea un string a integer; NaN/empty → 0. */
function entero(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Subcomponente presentational puro. Recibe el `formState` del hook +
 * la `getRef` del screen + el flag `guardando`. Renderiza la sección
 * "Indexación IPC" del form, incluyendo el preview live del factor
 * calculado.
 */
export function ParametrosTarifaIPC({
  formState,
  guardando,
  getRef,
}: ParametrosTarifaIPCProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;
  const anioBaseNum = entero(formState.values.anioBase);
  const anioDestinoNum = entero(formState.values.anioDestino);
  const factorCalculado = calcularFactorIpc(anioBaseNum, anioDestinoNum);

  return (
    <SeccionForm
      titulo="Indexación IPC (Art. 11 Res CRA 825/2017)"
      icono="trending-up"
      testID="seccion-card-ipc"
    >
      <Text style={estilos.nota}>
        Factor de indexación IPC para actualizar precios sin re-emitir la metodología tarifaria. El admin puede
        tipear el factor manualmente o tomar el factor calculado automáticamente a partir de los años base y destino.
      </Text>
      <View style={estilos.campo}>
        <FormField
          label="Anio base IPC (Res CRA 825 Art. 7, default 2016)"
          value={formState.values.anioBase}
          onChangeText={formState.setters.setAnioBase}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Norma CRA 825: anio_base=2016 (default). Año de referencia para la tabla IPC del DANE."
          error={formState.errores.anioBase}
          ref={getRef('anioBase')}
          testID="param-anio-base-ipc"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Anio destino (indexación)"
          value={formState.values.anioDestino}
          onChangeText={formState.setters.setAnioDestino}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Año al que se quiere indexar. Default = periodo tarifario vigente."
          error={formState.errores.anioDestino}
          ref={getRef('anioDestino')}
          testID="param-anio-destino"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Factor de indexación IPC (override manual)"
          value={formState.values.factorIpc}
          onChangeText={formState.setters.setFactorIpc}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Default 1.0 (sin indexación). El admin puede override manual sobre el factor calculado."
          error={formState.errores.factorIpc}
          ref={getRef('factorIpc')}
          testID="param-factor-ipc"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="IPUF indice (multiplicador de precios)"
          value={formState.values.ipufIndice}
          onChangeText={formState.setters.setIpufIndice}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Multiplicador del IPUF (Res CRA 825 Art. 7). Default 1.0 (sin ajuste)."
          error={formState.errores.ipufIndice}
          ref={getRef('ipufIndice')}
          testID="param-ipuf-indice"
        />
      </View>
      {/* Preview live del factor IPC calculado. Se actualiza conforme
          el admin modifica anioBase y anioDestino. Estilo secondary
          (mismo patron que param-altitud-preview). */}
      <Text
        style={estilos.previewAltitud}
        testID="param-ipc-preview"
      >
        {`Factor IPC calculado: ${factorCalculado.toFixed(4)} (IPC ${anioDestinoNum} / IPC ${anioBaseNum})`}
      </Text>
    </SeccionForm>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: SPACING.xs },
  nota: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
    marginBottom: SPACING.xs,
  },
  // Preview en vivo del factor IPC calculado. Mismo estilo que
  // param-altitud-preview (texto secundario, sin fondo, con padding).
  previewAltitud: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
});

export default ParametrosTarifaIPC;
