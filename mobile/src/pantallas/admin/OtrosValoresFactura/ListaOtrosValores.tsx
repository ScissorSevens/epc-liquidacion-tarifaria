/**
 * `ListaOtrosValores` — sub-componente de `OtrosValoresFactura`.
 *
 * Renderiza la seccion "Conceptos aplicados": el titulo, el empty state
 * y el map de items via `OtroValorItem`. Componente puro / controlado:
 * el padre pasa la lista y los callbacks de edicion/eliminacion.
 *
 * Comportamiento preservado 1:1 con la version previa embebida en
 * `OtrosValoresFactura.tsx` antes del refactor.
 *
 * @see `OtroValorItem.tsx` — render de cada item individual.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { ConceptoOtroValor } from '@dominio/concepto-otro-valor';
import type { OtroValor } from '@dominio/factura';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import OtroValorItem from './OtroValorItem';

export interface ListaOtrosValoresProps {
  readonly otrosValores: readonly OtroValor[];
  readonly catalogo: readonly ConceptoOtroValor[];
  readonly onEliminar: (concepto: string) => void;
  readonly onEditarValor: (concepto: string, texto: string) => void;
  readonly onEditarGlosa: (concepto: string, texto: string) => void;
}

export default function ListaOtrosValores({
  otrosValores,
  catalogo,
  onEliminar,
  onEditarValor,
  onEditarGlosa,
}: ListaOtrosValoresProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitulo}>Conceptos aplicados</Text>
      {otrosValores.length === 0 ? (
        <Text style={styles.empty}>No hay conceptos aplicados.</Text>
      ) : (
        otrosValores.map((ov) => (
          <OtroValorItem
            key={ov.concepto}
            ov={ov}
            catalogo={catalogo}
            onEliminar={() => onEliminar(ov.concepto)}
            onEditarValor={(texto) => onEditarValor(ov.concepto, texto)}
            onEditarGlosa={(texto) => onEditarGlosa(ov.concepto, texto)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  sectionTitulo: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  empty: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, fontStyle: 'italic' },
});
