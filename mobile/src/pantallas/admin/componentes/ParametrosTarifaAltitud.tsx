// mobile/src/pantallas/admin/componentes/ParametrosTarifaAltitud.tsx
//
// Subcomponente `ParametrosTarifaAltitud` — sección "Altitud y consumo
// basico" del screen admin ParametrosTarifa (Decompose Phase 2 task 2.4).
//
// Migración verbatim del bloque `<SeccionForm titulo="Altitud y consumo basico ...">`
// del screen original. TODOS los testIDs, helperTexts y el preview live
// con `limiteConsumoBasicoMensual` (Res CRA 750/2016 art. 3) se preservan
// para no romper los 4+ tests existentes.
//
// Inputs: altitud.
// Preview live: `<Text testID="param-altitud-preview">` con el formato
//               "Limite de consumo basico: {n} m3/mes (altitud {x} msnm)".
// testIDs: param-altitud, param-altitud-preview.

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '../../../componentes/FormField';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import { limiteConsumoBasicoMensual } from '../../../../dominio/motor-tarifario/consumo-basico';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

export interface ParametrosTarifaAltitudProps {
  /** Hook return — values, setters, errores, cargandoInputs. */
  readonly formState: UseParametrosFormStateReturn;
  /** True mientras `repo.guardar()` está en curso (UI: spinner). */
  readonly guardando: boolean;
}

/** Helper: parsea un string a number; NaN/empty → 0. */
function num(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Subcomponente presentational puro. Recibe el `formState` del hook +
 * el flag `guardando`. Renderiza la sección "Altitud y consumo basico"
 * del form, incluyendo el preview live del límite de consumo basico
 * (Res CRA 750/2016 art. 3).
 */
export function ParametrosTarifaAltitud({
  formState,
  guardando,
}: ParametrosTarifaAltitudProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;
  const altitudNum = num(formState.values.altitud);
  const limiteMensual = limiteConsumoBasicoMensual(altitudNum);

  return (
    <SeccionForm
      titulo="Altitud y consumo basico (Res CRA 750/2016)"
      icono="terrain"
      testID="seccion-card-altitud"
    >
      <Text style={estilos.nota}>
        Res CRA 750/2016 art. 3: el limite de consumo basico (m3/mes subsidiables) depende de la altitud del prestador.
        Altitud &gt; 2.000 msnm = 11 m3; 1.000-2.000 msnm = 13 m3; &le; 1.000 msnm = 16 m3.
      </Text>
      <View style={estilos.campo}>
        <FormField
          label="Altitud del prestador (msnm)"
          value={formState.values.altitud}
          onChangeText={formState.setters.setAltitud}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          helperText="Determina el limite de consumo basico (Res CRA 750/2016)"
          testID="param-altitud"
        />
      </View>
      <Text
        style={estilos.previewAltitud}
        testID="param-altitud-preview"
      >
        {`Limite de consumo basico: ${limiteMensual} m³/mes (altitud ${altitudNum} msnm)`}
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
  // Preview en vivo del limite de consumo basico (Res CRA 750/2016).
  // Visible debajo del input de altitud. Texto secundario, sin fondo,
  // con padding para alinearlo con el field.
  previewAltitud: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
});

export default ParametrosTarifaAltitud;
