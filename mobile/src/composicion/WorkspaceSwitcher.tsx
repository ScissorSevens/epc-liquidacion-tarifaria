/**
 * Componente selector de prestador activo.
 *
 * Se muestra en el header de navegación. Solo visible si hay más de un
 * prestador disponible (operario multi-prestador).
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';
import { useWorkspace } from './useWorkspace';
import type { Prestador } from '../dominio/prestadores/types';

interface Props {
  readonly onCambiar: (id: number) => Promise<void>;
}

export function WorkspaceSwitcher({ onCambiar }: Props) {
  const { prestadores_disponibles, id_prestador_activo, prestador } = useWorkspace();
  const [abierto, setAbierto] = useState(false);

  // Oculto si solo hay un prestador
  if (prestadores_disponibles.length <= 1) {
    return null;
  }

  const prestadorActual: Prestador | undefined = prestadores_disponibles.find(
    (p) => p.id_prestador === id_prestador_activo,
  );

  return (
    <View style={estilos.wrapper}>
      <Pressable
        style={estilos.boton}
        onPress={() => setAbierto(!abierto)}
        accessibilityRole="button"
      >
        <MaterialIcons name="business" size={18} color={COLORS.onPrimary} />
        <Text style={estilos.label} numberOfLines={1}>
          {prestadorActual?.nombre ?? `Prestador #${id_prestador_activo}`}
        </Text>
        <MaterialIcons
          name={abierto ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color={COLORS.onPrimary}
        />
      </Pressable>
      {abierto && (
        <ScrollView style={estilos.dropdown} contentContainerStyle={estilos.dropdownContent}>
          {prestadores_disponibles.map((p) => (
            <Pressable
              key={p.id_prestador}
              style={[
                estilos.opcion,
                p.id_prestador === id_prestador_activo && estilos.opcionActiva,
              ]}
              onPress={async () => {
                setAbierto(false);
                await onCambiar(p.id_prestador);
              }}
            >
              <Text style={estilos.opcionLabel}>{p.nombre}</Text>
              <Text style={estilos.opcionSub}>{p.municipio} · {p.codigo}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
    maxWidth: 240,
  },
  label: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    flexShrink: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    maxHeight: 320,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownContent: {
    padding: SPACING.xs,
  },
  opcion: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  opcionActiva: {
    backgroundColor: COLORS.primaryContainer,
  },
  opcionLabel: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
  },
  opcionSub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
});
