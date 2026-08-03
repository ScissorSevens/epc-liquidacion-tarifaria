import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { Suscriptor } from '@dominio/suscriptores/types';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type PropsFila = {
  item: Suscriptor;
  onVerFicha: (id: number) => void;
  onCapturarLectura: (item: Suscriptor) => void;
};

/**
 * Fila memoizada de la lista de suscriptores.
 *
 * Separada de ListaSuscriptores para que React.memo evite re-renders
 * de filas no afectadas cuando el estado del padre cambia.
 */
export const FilaSuscriptor = React.memo(function FilaSuscriptor({
  item,
  onVerFicha,
  onCapturarLectura,
}: PropsFila) {
  return (
    <View style={styles.card}>
      {/* Código + Nombre */}
      <Text style={styles.cardCodigo}>#{item.codigo}</Text>
      <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]} numberOfLines={1}>
        {item.nombre_apellidos}
      </Text>

      {/* Dirección */}
      {item.direccion !== '' && (
        <View style={styles.cardDireccionRow}>
          <MaterialIcons name="location-on" size={14} color={COLORS.onSurfaceVariant} />
          <Text style={[TYPOGRAPHY.labelMd, styles.cardDireccion]} numberOfLines={1}>
            {item.direccion}
          </Text>
        </View>
      )}

      {/* Acciones: Ficha (ghost) + Tomar lectura (pill) */}
      <View style={styles.cardAcciones}>
        <Pressable
          style={({ pressed }) => [styles.btnFicha, pressed && styles.presionado]}
          onPress={() => onVerFicha(item.id_suscriptor)}
        >
          <MaterialIcons name="info-outline" size={14} color={COLORS.secondary} />
          <Text style={[TYPOGRAPHY.labelMd, styles.btnFichaTexto]}>Ver ficha</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnTomarLectura, pressed && styles.presionado]}
          onPress={() => { void onCapturarLectura(item); }}
        >
          <MaterialIcons name="add-a-photo" size={14} color={COLORS.onPrimary} />
          <Text style={[TYPOGRAPHY.labelLg, styles.btnTomarLecturaTexto]}>TOMAR LECTURA</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm + 4,
    gap: SPACING.xs,
  },
  cardCodigo: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  cardNombre: {
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  cardDireccionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  cardDireccion: {
    color: COLORS.onSurfaceVariant,
    flex: 1,
  },
  cardAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs + 2,
  },
  btnFicha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  btnFichaTexto: {
    color: COLORS.secondary,
  },
  btnTomarLectura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  btnTomarLecturaTexto: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  presionado: {
    opacity: 0.7,
  },
});
