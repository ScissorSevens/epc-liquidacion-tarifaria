// mobile/src/componentes/ResumenCargos.tsx
//
// Componente `ResumenCargos` — card que muestra el cargo fijo y el cargo
// consumo resultantes del calculo tarifario (Res CRA 825/2017 + 907/2019).
//
// Parametros-tarifa-impeccable-v2 Commit 2 — D2 + D3 del design.
//
//   - Recibe `cargos: CargosResultantes | null` del padre via prop.
//   - Si `cargos === null` → muestra placeholder "Ingrese valores validos
//     para ver el resumen" (caso: division por cero, valores negativos, etc.).
//   - Render: titulo + 2 lineas (CF + CC) con `formatCOP`.
//   - Tokens del theme. Sin shadow (border-only, sin ghost-cards).
//
// El padre (`ParametrosTarifa.tsx`) calcula `cargos` via `useMemo` con
// deps acotadas a los inputs relevantes (cma, cmo, cmi, cmt, cmviaa,
// aplica_cmviaa, suscriptores_promedio). Live preview del resultado
// ANTES de guardar.

import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';
import { formatCOP } from '../utils/formatCOP';
import type { CargosResultantes } from '../../dominio/parametros-tarifa/calcular';

export interface ResumenCargosProps {
  /** Cargos resultantes del calculo. `null` = inputs invalidos. */
  readonly cargos: CargosResultantes | null;
  /** testID opcional para tests. */
  readonly testID?: string;
}

/**
 * ResumenCargos — card con cargo fijo y cargo consumo formateados en COP.
 *
 * Si `cargos` es null, renderiza un placeholder que indica al operario
 * que los valores aun no producen un calculo valido (ej: division por
 * cero, campos vacios).
 */
export function ResumenCargos({
  cargos,
  testID,
}: ResumenCargosProps): React.ReactElement {
  if (cargos === null) {
    return (
      <View testID={testID} style={[estilos.card, estilos.placeholder]}>
        <Text style={estilos.placeholderTexto}>
          Ingrese valores validos para ver el resumen.
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={estilos.card}>
      <View style={estilos.fila}>
        <Text style={estilos.etiqueta}>Cargo fijo</Text>
        <Text style={estilos.valor}>{formatCOP(cargos.cargo_fijo)}</Text>
        <Text style={estilos.unidad}>/suscriptor/mes</Text>
      </View>
      <View style={estilos.fila}>
        <Text style={estilos.etiqueta}>Cargo consumo</Text>
        <Text style={estilos.valor}>{formatCOP(cargos.cargo_consumo)}</Text>
        <Text style={estilos.unidad}>/m³</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  placeholder: {
    backgroundColor: COLORS.surfaceContainerLow,
  },
  placeholderTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  etiqueta: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    flexShrink: 1,
  },
  valor: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    fontVariant: ['tabular-nums'] as const,
  },
  unidad: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
  },
});