/**
 * `OtroValorItem` — sub-componente de `OtrosValoresFactura`.
 *
 * Renderiza UNA fila de la lista de "Conceptos aplicados" (un `OtroValor`):
 *  - Header con codigo + boton eliminar.
 *  - Descripcion desde el catalogo (si esta cargado).
 *  - Input de valor (COP) numerico.
 *  - Input de glosa (si el concepto requiere_glosa).
 *
 * Componente puro / controlado: el padre (`OtrosValoresFactura`)
 * mantiene el estado y pasa callbacks `onEliminar`, `onEditarValor`,
 * `onEditarGlosa` para que el item reporte cambios.
 *
 * Touch targets ≥ 44px (WCAG 2.5.5) en el boton eliminar.
 *
 * @see `ListaOtrosValores.tsx` — wrapper que mapea una lista de items.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { ConceptoOtroValor } from '@dominio/concepto-otro-valor';
import type { OtroValor } from '@dominio/factura';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';

export interface OtroValorItemProps {
  /** El OtroValor a renderizar. */
  readonly ov: OtroValor;
  /** Catalogo cargado (puede estar en `listo` o cualquier otro estado).
   *  Si esta en `listo`, se muestra la descripcion del catalogo. */
  readonly catalogo: readonly ConceptoOtroValor[];
  /** Callback cuando el usuario toca el boton X. */
  readonly onEliminar: () => void;
  /** Callback cuando el usuario edita el valor numerico. */
  readonly onEditarValor: (texto: string) => void;
  /** Callback cuando el usuario edita la glosa. */
  readonly onEditarGlosa: (texto: string) => void;
}

const TOUCH_TARGET = 44; // ≥ 44px (WCAG 2.5.5)

export default function OtroValorItem({
  ov,
  catalogo,
  onEliminar,
  onEditarValor,
  onEditarGlosa,
}: OtroValorItemProps): React.ReactElement {
  const meta = catalogo.find((c) => c.codigo === ov.concepto);
  return (
    <View style={styles.itemCard} testID={`item-${ov.concepto}`}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemConcepto}>{ov.concepto}</Text>
        <Pressable
          testID={`eliminar-${ov.concepto}`}
          onPress={onEliminar}
          style={({ pressed }) => [
            styles.btnEliminar,
            pressed && styles.btnEliminarPressed,
          ]}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={18} color={COLORS.error} />
        </Pressable>
      </View>
      {meta !== undefined && <Text style={styles.itemDesc}>{meta.descripcion}</Text>}
      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Valor (COP)</Text>
        <TextInput
          testID={`valor-${ov.concepto}`}
          value={String(ov.valor)}
          onChangeText={onEditarValor}
          keyboardType="numeric"
          style={styles.inputValor}
        />
      </View>
      {meta?.requiereGlosa && (
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Glosa</Text>
          <TextInput
            testID={`glosa-${ov.concepto}`}
            value={ov.glosa ?? ''}
            onChangeText={onEditarGlosa}
            style={styles.inputGlosa}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemConcepto: { ...TYPOGRAPHY.bodyMd, color: COLORS.primary, fontWeight: '700' },
  itemDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemLabel: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1 },
  inputValor: {
    minWidth: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    textAlign: 'right',
  },
  inputGlosa: {
    flex: 2,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  btnEliminar: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  btnEliminarPressed: { backgroundColor: COLORS.errorContainer },
});
