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

import { StyleSheet, Text } from 'react-native';

import type { ConceptoOtroValor } from '@dominio/concepto-otro-valor';
import type { OtroValor } from '@dominio/factura';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../theme/skeletal-tokens';
import { SeccionForm } from '../../../componentes/SeccionForm';
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
    <SeccionForm titulo="Conceptos aplicados">
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
    </SeccionForm>
  );
}

const styles = StyleSheet.create({
  empty: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, fontStyle: 'italic' },
});
