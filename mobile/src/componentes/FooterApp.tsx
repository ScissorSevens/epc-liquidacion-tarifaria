import { StyleSheet, Text, View } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

/**
 * FooterApp — Pie de página de la aplicación.
 *
 * Muestra la versión de la app centrada al fondo de cada pantalla.
 * Insertar al final del ScrollView/View raíz de cada pantalla.
 */
export function FooterApp() {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.texto}>AQUASERVICES V0.1.0</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    width: '100%',
    backgroundColor: COLORS.surfaceMuted,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textTertiary,
  },
});
