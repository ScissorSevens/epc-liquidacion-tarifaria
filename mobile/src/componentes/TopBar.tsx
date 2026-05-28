import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS, RADIUS, SPACING } from '../theme/skeletal-tokens';

export const TOPBAR_HEIGHT = 64;

interface TopBarProps {
  titulo: string;
  onBack?: () => void;          // si se pasa → muestra flecha atrás
  accionDerecha?: ReactNode;    // slot libre para iconos derecha
}

export function TopBar({ titulo, onBack, accionDerecha }: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.izq}>
        {onBack && (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            onPress={onBack}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
          </Pressable>
        )}
        <Text style={styles.titulo} numberOfLines={1}>{titulo}</Text>
      </View>
      {accionDerecha && (
        <View style={styles.der}>{accionDerecha}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: TOPBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  izq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
    flex: 1,
  },
  der: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: COLORS.primary,
    flex: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(3,22,50,0.08)',
  },
});
