import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = ConfigStackScreenProps<'Configuracion'>;

/**
 * Pantalla de configuración — menú de acciones directas.
 */
export default function Configuracion({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>CONFIGURACIÓN</Text>
      </View>

      {/* Sección: Gestión de suscriptores */}
      <Text style={[TYPOGRAPHY.labelLg, styles.seccionLabel]}>
        GESTIÓN DE SUSCRIPTORES
      </Text>

      <View style={styles.seccion}>
        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => navigation.navigate('AltaSuscriptor')}
        >
          <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Agregar suscriptor</Text>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </Pressable>

        <View style={styles.separador} />

        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => navigation.navigate('ImportarCsv')}
        >
          <MaterialIcons name="upload-file" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Importar desde CSV</Text>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Sección: Sistema */}
      <Text style={[TYPOGRAPHY.labelLg, styles.seccionLabel]}>SISTEMA</Text>

      <View style={styles.seccion}>
        <View style={styles.item}>
          <MaterialIcons name="info" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Versión de la app</Text>
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemValor]}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  header: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  titulo: {
    color: COLORS.primary,
  },
  seccionLabel: {
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  seccion: {
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.lg,
    ...BORDERS.thin,
    borderRadius: 0,
    backgroundColor: COLORS.background,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.margin,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  itemPressed: {
    backgroundColor: COLORS.surfaceLight,
  },
  itemText: {
    flex: 1,
    color: COLORS.primary,
  },
  itemValor: {
    color: COLORS.textSecondary,
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.margin,
  },
});
