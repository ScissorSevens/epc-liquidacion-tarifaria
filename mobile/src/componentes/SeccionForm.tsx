// mobile/src/componentes/SeccionForm.tsx
//
// SeccionForm — wrapper reusable de secciones de formulario del sistema
// EPC. Encapsula el patron "card de seccion" (listaCard / grupo de
// campos relacionados) con titulo + icono opcional + body children.
//
// Decisiones de craft (impeccable v1):
//   - Border + radio + fondo con tokens del theme. NO shadow (anti-pattern
//     ghost-card de impecable: border + shadow combo).
//   - Padding consistente con SPACING.md y gap interno con SPACING.sm.
//   - Titulo en TYPOGRAPHY.headlineSm con color COLORS.primary (identidad
//     institucional explicita).
//   - Icono opcional a la izquierda del titulo, en COLORS.primary.
//   - Touch targets NO aplican aqui (componente de solo lectura / wrapper).
//     Los FormField internos mantienen su minHeight >= 48px.
//   - testID opcional se propaga al contenedor exterior.
//
// Consumidores:
//   - ParametrosTarifa (4 secciones: periodo, costos, agua, minimo vital).
//   - AcuerdoMunicipal (4 secciones: subsidios, contribuciones E, otros, vigencia).
//   - OtrosValoresFactura + ListaOtrosValores (1-2 secciones).
//
// Migraciones:
//   Antes, las pantallas admin usaban `<Text style={estilos.seccion}>` con
//   patron duplicado. Este componente consolida el patron y abre la puerta
//   a estandarizar los 4+ screens que repiten el mismo wrapper.

import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type NombreIconoMaterial = ComponentProps<typeof MaterialIcons>['name'];

export interface SeccionFormProps {
  /** Titulo del card. Visible en el header, en headlineSm + COLORS.primary. */
  readonly titulo: string;
  /** Icono Material a la izquierda del titulo (opcional). */
  readonly icono?: NombreIconoMaterial;
  /** Body del card: cualquier ReactNode (FormField, TextInput, etc.). */
  readonly children: ReactNode;
  /** testID para tests. Se propaga al contenedor exterior. */
  readonly testID?: string;
}

/**
 * SeccionForm — card con titulo + icono + body children.
 *
 * Contrato:
 *   - El `titulo` es REQUIRED (siempre debe haber un header visible).
 *   - El `icono` es opcional (cero secciones sin icono estan OK, ej:
 *     "Vigencia" no necesita icono forzado).
 *   - El `testID` es opcional y se propaga al View exterior. Sin testID,
 *     no se setea la prop testID en el View (zero-cost para callsites
 *     que no la necesitan).
 */
export function SeccionForm({
  titulo,
  icono,
  children,
  testID,
}: SeccionFormProps): React.ReactElement {
  return (
    <View
      testID={testID}
      style={estilos.contenedor}
      accessibilityRole="summary"
    >
      {/* Header: row con icono (opcional) + titulo. */}
      <View style={estilos.header}>
        {icono !== undefined && (
          <MaterialIcons
            name={icono}
            size={20}
            color={COLORS.primary}
            style={estilos.icono}
            testID="seccion-form-icono"
            accessibilityElementsHidden
          />
        )}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>

      {/* Body: gap SPACING.sm entre children. */}
      <View style={estilos.body}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  icono: {
    // Sin margin extra: el gap del row lo separa del titulo.
  },
  titulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    flexShrink: 1,
  },
  body: {
    gap: SPACING.sm,
  },
});