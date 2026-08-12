// mobile/src/pantallas/admin/componentes/ParametrosTarifaSoporte.tsx
//
// Subcomponente `ParametrosTarifaSoporte` — sección "Soporte documental"
// del screen admin ParametrosTarifa (Decompose Phase 2 task 2.5).
//
// Migración verbatim del bloque `<SeccionForm titulo="Soporte documental ...">`
// del screen original. TODOS los testIDs, helperTexts y accessibilityHints
// se preservan para no romper los 4+ tests existentes.
//
// Inputs: actoAdopcion, estudioCostosId, documentoSoporteUrl.
// Errores inline: errores.actoAdopcion, errores.documentoSoporteUrl.
// testIDs: param-acto-adopcion, param-estudio-costos-id,
//          param-documento-soporte-url.

import * as React from 'react';
import type { RefObject } from 'react';
import { StyleSheet, Text, View, type View as RNView } from 'react-native';

import { FormField } from '../../../componentes/FormField';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

/**
 * Solo las keys de scroll-to-first-error que esta sección puede
 * gatillar. Narrowed del union `CampoConError` del screen.
 */
type CampoConErrorSeccion = 'actoAdopcion' | 'documentoSoporteUrl';

export interface ParametrosTarifaSoporteProps {
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
 * "Soporte documental" del form.
 */
export function ParametrosTarifaSoporte({
  formState,
  guardando,
  getRef,
}: ParametrosTarifaSoporteProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;

  return (
    <SeccionForm
      titulo="Soporte documental (Res CRA 825/2017 + 907/2019)"
      icono="description"
      testID="seccion-card-soporte-documental"
    >
      <Text style={estilos.nota}>
        Documentos opcionales que respaldan la metodologia tarifaria aplicada. Si los completa, las URLs deben ser publicas (http/https).
      </Text>
      <View style={estilos.campo}>
        <FormField
          label="Acto administrativo de adopcion (URL, decreto/resolucion)"
          value={formState.values.actoAdopcion}
          onChangeText={formState.setters.setActoAdopcion}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          keyboardType="url"
          placeholder="https://..."
          error={formState.errores.actoAdopcion}
          ref={getRef('actoAdopcion')}
          accessibilityHint="URL del acto administrativo que adopta la metodologia tarifaria"
          testID="param-acto-adopcion"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="ID estudio de costos (referencia externa, ej: SUI)"
          value={formState.values.estudioCostosId}
          onChangeText={formState.setters.setEstudioCostosId}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          helperText="Identificador del estudio de costos en el sistema externo (SUI o similar). String libre."
          testID="param-estudio-costos-id"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="Documento soporte del estudio (URL, PDF u otro)"
          value={formState.values.documentoSoporteUrl}
          onChangeText={formState.setters.setDocumentoSoporteUrl}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          keyboardType="url"
          placeholder="https://..."
          error={formState.errores.documentoSoporteUrl}
          ref={getRef('documentoSoporteUrl')}
          accessibilityHint="URL del documento soporte del estudio de costos"
          testID="param-documento-soporte-url"
        />
      </View>
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
});

export default ParametrosTarifaSoporte;
