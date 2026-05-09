import { StyleSheet, Text, View } from 'react-native';

import type { ConfigStackScreenProps } from '../navegacion/types';
import { COLORS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type Props = ConfigStackScreenProps<'Configuracion'>;

/**
 * Pantalla de configuración — stub mínimo.
 * Sin lógica ni formularios funcionales.
 * Punto de extensión para funcionalidades futuras de configuración.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Configuracion(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>CONFIGURACIÓN</Text>
      <Text style={[TYPOGRAPHY.bodyMd, styles.placeholder]}>Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.margin,
  },
  titulo: {
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  placeholder: {
    color: COLORS.textSecondary,
  },
});
