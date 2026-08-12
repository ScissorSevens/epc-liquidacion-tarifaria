// mobile/src/pantallas/admin/componentes/ParametrosTarifaCostos.tsx
//
// Subcomponente `ParametrosTarifaCostos` — sección "Costos medios" del
// screen admin ParametrosTarifa (Decompose Phase 2 task 2.2).
//
// Migración verbatim del bloque `<SeccionForm titulo="Costos medios ...">`
// del screen original. TODOS los testIDs, comments B/B/B, helperTexts y
// styles de SwitchFila (D6) se preservan para no romper los 12+ tests
// existentes.
//
// Inputs: cma, cmo, cmi, cmt, cmviaa, cmaa, aplicaCmviaa, aplicaCmaa.
// Errores inline: errores.cma, errores.cmo.
// testIDs: param-cma, param-cmo, param-cmi, param-cmt, param-cmviaa,
//          param-cmaa, switch-cmviaa, switch-cmaa, resumen-cargos.
//
// DECISION B/B/B:
//   - `ResumenCargos` se mantiene INLINE en este subcomponente (no se
//     extrae a su propio archivo). Solo se usa en esta sección. Costo
//     de extracción (otro archivo + test) > beneficio.
//   - `Switch aplicaCmaa` también vive dentro de este componente (no
//     subcomponente aparte). Está agrupado visualmente con los otros
//     Costos medios y comparte el form layout. Coherencia con el
//     patrón existente de `aplicaCmviaa`.
//   - `aplicaCmaa=false` deshabilita el input CMAA (defensa UX — no
//     se puede tipear un monto si el opt-in conceptual está apagado).
//     Mismo patrón que el switch CMVIAA.

import * as React from 'react';
import type { RefObject } from 'react';
import { Platform, StyleSheet, Switch, Text, View, type View as RNView } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';

import { FormField } from '../../../componentes/FormField';
import { ResumenCargos } from '../../../componentes/ResumenCargos';
import { SeccionForm } from '../../../componentes/SeccionForm';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import type { CargosResultantes } from '../../../../dominio/parametros-tarifa/calcular';
import type { UseParametrosFormStateReturn } from '../hooks/useParametrosFormState';

/**
 * Solo las keys de scroll-to-first-error que esta sección puede
 * gatillar. Narrowed del union `CampoConError` del screen.
 */
type CampoConErrorSeccion = 'cma' | 'cmo';

export interface ParametrosTarifaCostosProps {
  /** Hook return — values, setters, errores, cargandoInputs. */
  readonly formState: UseParametrosFormStateReturn;
  /** True mientras `repo.guardar()` está en curso (UI: spinner). */
  readonly guardando: boolean;
  /**
   * Map de refs para scroll-to-first-error. Narrowed a las keys que
   * esta sección puede exhibir como error inline.
   */
  readonly getRef: (key: CampoConErrorSeccion) => RefObject<RNView | null>;
  /**
   * Cargos resultantes del `useMemo` del screen principal. Si es null,
   * se muestra el placeholder "Ingrese valores validos" en el card.
   */
  readonly resumen: CargosResultantes | null;
}

/**
 * Wrapper compartido para los rows de switch (CMVIAA + CMAA).
 * Mantiene el patrón D6 (SwitchFila inline con icono MaterialIcons
 * izq + hit-area >= 48). No se extrae a `componentes/` (D6): solo se
 * usa 2 veces en este archivo.
 */
function CampoSwitch({
  icono,
  label,
  testID,
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  readonly icono: string;
  readonly label: string;
  readonly testID: string;
  readonly value: boolean;
  readonly onValueChange: (v: boolean) => void;
  readonly disabled: boolean;
  readonly accessibilityLabel: string;
}): React.ReactElement {
  return (
    <View style={estilos.campoFila}>
      <MaterialIcons
        name={icono as 'eco'}
        size={24}
        color={COLORS.primary}
        style={estilos.switchFilaIcono}
        accessibilityElementsHidden
      />
      <View style={estilos.switchFilaText}>
        <Text style={estilos.switchFilaLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          // D5 (Commit 4): Haptics.selectionAsync en onValueChange de
          // switches (feedback sutil para iOS + Android).
          if (Platform.OS !== 'web') {
            void Haptics.selectionAsync();
          }
          onValueChange(v);
        }}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    </View>
  );
}

/**
 * Subcomponente presentational puro. Recibe el `formState` del hook +
 * la `getRef` del screen + el flag `guardando` + el `resumen` del
 * `useMemo` del screen. Renderiza la sección "Costos medios" del form,
 * incluyendo los 2 switches (CMVIAA + CMAA) y el ResumenCargos inline.
 */
export function ParametrosTarifaCostos({
  formState,
  guardando,
  getRef,
  resumen,
}: ParametrosTarifaCostosProps): React.ReactElement {
  const editable = !guardando && !formState.cargandoInputs;

  return (
    <SeccionForm
      titulo="Costos medios (estudio de costos del prestador)"
      icono="calculate"
      testID="seccion-card-cma"
    >
      <Text style={estilos.nota}>
        Estos son los insumos de la fórmula normativa. El motor NO acepta inputs planos.
      </Text>
      <View style={estilos.campo}>
        <FormField
          label="CMA · Costo Medio Administración ($/año, art. 9)"
          value={formState.values.cma}
          onChangeText={formState.setters.setCma}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          error={formState.errores.cma}
          ref={getRef('cma')}
          testID="param-cma"
        />
      </View>
      {/* El warning inline `param-cma-warning` se elimino en Commit 3.
          Ahora el error de CMA bajo el minimo normativo aparece
          inline en el FormField via `error={formState.errores.cma}` (FormField
          propaga su `error` a un TextInput con border rojo y texto
          debajo del campo). Migrar este test si rompe: T-DESIGN-3 o
          tests viejos que busquen `param-cma-warning` ya no aplican. */}
      <View style={estilos.campo}>
        <FormField
          label="CMO · Costo Medio Operación ($/m³)"
          value={formState.values.cmo}
          onChangeText={formState.setters.setCmo}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          error={formState.errores.cmo}
          ref={getRef('cmo')}
          testID="param-cmo"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="CMI · Costo Medio Inversión ($/m³)"
          value={formState.values.cmi}
          onChangeText={formState.setters.setCmi}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          testID="param-cmi"
        />
      </View>
      <View style={estilos.campo}>
        <FormField
          label="CMT · Costo Medio Tasas Ambientales ($/m³)"
          value={formState.values.cmt}
          onChangeText={formState.setters.setCmt}
          keyboardType="numeric"
          editable={editable}
          selectable
          tabularNums
          testID="param-cmt"
        />
      </View>

      <CampoSwitch
        icono="eco"
        label="Activar CMVIAA (art. 14 Res 907/2019)"
        testID="switch-cmviaa"
        value={formState.values.aplicaCmviaa}
        onValueChange={formState.setters.setAplicaCmviaa}
        disabled={guardando || formState.cargandoInputs}
        accessibilityLabel="Aplicar costo medio variable de inversión ambiental"
      />
      {formState.values.aplicaCmviaa && (
        <View style={estilos.campo}>
          <FormField
            label="CMVIAA · Costo Medio Variable Inv. Ambientales Adicionales ($/m³)"
            value={formState.values.cmviaa}
            onChangeText={formState.setters.setCmviaa}
            keyboardType="numeric"
            editable={editable}
            selectable
            tabularNums
            testID="param-cmviaa"
          />
        </View>
      )}

      {/* CMAA · Costo Medio de Administración por Inversiones Ambientales
          Adicionales (Res CRA 907/2019 art. 13 mod. Res CRA 825/2017 art. 9).
          SOLO aplica al servicio de ACUEDUCTO. Para alcantarillado el CF
          es solo CMA (sin CMAA). Fase 2 (task 4.5).

          Phase 2 task 2.4 (GREEN): flag explicito `aplicaCmaa` que
          MANDA sobre el valor numerico. Si el admin NO toggle, el
          input CMAA se renderiza deshabilitado (defensa UX: no se
          puede tipear un monto si el opt-in conceptual esta apagado).
          Mismo patron que el switch CMVIAA de arriba. */}
      <CampoSwitch
        icono="eco"
        label="Aplicar CMAA (Res 907/2019 art. 13)"
        testID="switch-cmaa"
        value={formState.values.aplicaCmaa}
        onValueChange={formState.setters.setAplicaCmaa}
        disabled={guardando || formState.cargandoInputs}
        accessibilityLabel="Aplicar CMAA (Res 907/2019 art. 13)"
      />
      <View style={estilos.campo}>
        <FormField
          label="CMAA · Costo Medio Admin. Inversiones Ambientales Adic. ($/suscriptor/mes)"
          value={formState.values.cmaa}
          onChangeText={formState.setters.setCmaa}
          keyboardType="numeric"
          // Phase 2 task 2.4: input deshabilitado si flag apagado.
          // Si flag ON, el input se habilita pero sigue sujeto a
          // !guardando && !cargandoInputs como el resto del form.
          editable={editable && formState.values.aplicaCmaa}
          selectable={formState.values.aplicaCmaa}
          tabularNums
          helperText="Solo aplica a servicio de ACUEDUCTO. Res CRA 907/2019 art. 14 (mod. art. 9 Res CRA 825/2017). El flag de arriba debe estar activo."
          testID="param-cmaa"
        />
      </View>

      {/* D2/D3 (Commit 2): ResumenCargos live preview. */}
      <ResumenCargos cargos={resumen} testID="resumen-cargos" />
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
  // Fila del Switch: el Switch mide 24 px nativo. Sin minHeight explicito,
  // el hit-area efectivo cae a ~36 px y rompe WCAG 2.5.5 (≥ 44 px).
  // minHeight: 48 da margen suficiente sobre el switch.
  campoFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  // D6 (Commit 2): SwitchFila inline con icono MaterialIcons izq + hit-area >= 48.
  // SwitchFila NO se extrae a `componentes/` (D6): solo se usa 2 veces.
  switchFilaIcono: {
    marginRight: SPACING.xs,
  },
  switchFilaText: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  switchFilaLabel: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
  },
});

export default ParametrosTarifaCostos;
