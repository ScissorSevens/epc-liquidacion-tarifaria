import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

/**
 * TarjetaMetrica — card de display de un numero destacado + etiqueta + icono.
 *
 * Caso de uso: resumenes y grids de stats (Sincronizacion, MiPerfil).
 * NO es interactiva — es solo display. Si se necesita accion, envolver
 * en un Pressable exterior o usar BotonPrimario.
 *
 * Tres variantes segun semantica (impeccable: color con proposito):
 *   - 'normal' → estado neutro o informativo (pendientes, totales).
 *                Icono + valor + etiqueta en COLORS.brandAzulOscuro.
 *   - 'exito'  → resultado positivo (exitosos, lecturas completadas).
 *                Icono COLORS.brandVerde; valor y etiqueta en
 *                COLORS.brandAzulOscuro (alta legibilidad WCAG AA).
 *   - 'error'  → resultado fallido o sensible (errores, fallidos).
 *                Icono + valor + etiqueta en COLORS.error.
 *
 * Nota de contraste (WCAG AA):
 *   El VALOR destacado siempre usa COLORS.brandAzulOscuro (contraste
 *   ~11.4:1 sobre blanco) o COLORS.error (~5.2:1 sobre blanco). Esto
 *   garantiza 4.5:1 incluso en texto no-bold. brandVerde (#76B718)
 *   sobre blanco da solo 2.45:1 — insuficiente para texto pequeño.
 *   Por eso brandVerde se reserva al ICONO de la variante exito,
 *   nunca al valor textual.
 *
 * Decisiones de craft (impeccable v1, register product):
 *   - Border radius RADIUS.card (16). NUNCA RADIUS.xl (24): el
 *     sobre-redondeo en cards es codex defect explicito (32px+ banned).
 *   - borderWidth + borderColor SOLO. Sin shadow. Las cards de contenido
 *     usan solo border para separarse del fondo (ver nota en
 *     skeletal-tokens.ts sobre la eliminacion del shadow "card").
 *   - Sin textTransform: 'uppercase' (ALL CAPS ban).
 *   - Token explicito brand* (no COLORS.primary generico): la identidad
 *     institucional queda visible en el source aunque resuelva al mismo hex.
 *   - Etiqueta corta en TYPOGRAPHY.labelSm, valor destacado en
 *     TYPOGRAPHY.headlineSm: jerarquia visual clara numero > label.
 *
 * Migraciones:
 *   Antes existian 2 copias locales de este patron:
 *     - Sincronizacion.tsx statCard: RADIUS.xl (24) — codex defect.
 *     - MiPerfil.tsx gridCard: RADIUS.xl (24) — mismo problema.
 *   Este componente consolida ambas con RADIUS.card y variantes semanticas.
 */
type NombreIconoMaterial = ComponentProps<typeof MaterialIcons>['name'];
type VarianteMetrica = 'normal' | 'exito' | 'error';

interface TarjetaMetricaProps {
  /** Icono Material arriba del valor. */
  readonly icono: NombreIconoMaterial;
  /** Etiqueta visible (label pequeno arriba del valor). */
  readonly etiqueta: string;
  /** Valor destacado (numero o string). */
  readonly valor: string | number;
  /**
   * Variante semantica.
   * Default: 'normal'.
   */
  readonly variante?: VarianteMetrica;
  /** testID para tests. */
  readonly testID?: string;
  /** Accessibility label completo (default = `${etiqueta}: ${valor}`). */
  readonly accessibilityLabel?: string;
}

export function TarjetaMetrica({
  icono,
  etiqueta,
  valor,
  variante = 'normal',
  testID,
  accessibilityLabel,
}: TarjetaMetricaProps) {
  // Seleccion de colores segun variante.
  //
  // Icono: usa el token semantico completo (brandVerde para exito,
  // COLORS.error para error). El icono es un elemento grafico, no texto,
  // asi que NO esta sujeto al umbral 4.5:1 de WCAG (3:1 alcanza para
  // elementos graficos esenciales).
  //
  // Valor: COLORS.brandAzulOscuro (todas las variantes) o COLORS.error
  // (variante error). Esto garantiza contraste >= 4.5:1 sobre el fondo
  // surfaceContainerLowest (#FFFFFF), requisito del PRODUCT.md.
  //
  // Etiqueta: COLORS.onSurfaceVariant para normal/exito (contraste OK
  // sobre surfaceContainerLowest), COLORS.error para variant error para
  // reforzar el tono semantico.
  const colorIcono =
    variante === 'exito'
      ? COLORS.brandVerde
      : variante === 'error'
      ? COLORS.error
      : COLORS.brandAzulOscuro;

  const colorValor =
    variante === 'error' ? COLORS.error : COLORS.brandAzulOscuro;

  const colorEtiqueta =
    variante === 'error' ? COLORS.error : COLORS.onSurfaceVariant;

  return (
    <View
      style={styles.contenedor}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${etiqueta}: ${valor}`}
      testID={testID}
    >
      <MaterialIcons
        name={icono}
        size={22}
        color={colorIcono}
        testID={testID !== undefined ? `${testID}-icon` : undefined}
      />
      <Text
        style={[styles.etiqueta, { color: colorEtiqueta }]}
        numberOfLines={1}
      >
        {etiqueta}
      </Text>
      <Text
        style={[styles.valor, { color: colorValor }]}
        numberOfLines={1}
        testID={testID !== undefined ? `${testID}-valor` : undefined}
      >
        {String(valor)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.card,
    // Border SOLO — sin shadow. Las cards de contenido se separan del
    // fondo solo con borde, no con sombra (ver nota en
    // skeletal-tokens.ts sobre la eliminacion del shadow "card").
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  // Etiqueta pequena — TYPOGRAPHY.labelSm = 10px, peso medio.
  // Para que el VALOR destaque como elemento principal.
  etiqueta: {
    ...TYPOGRAPHY.labelSm,
    textAlign: 'center',
  },
  // Valor destacado — TYPOGRAPHY.headlineSm = 20px, peso 600.
  // Jerarquia visual clara: numero > etiqueta.
  valor: {
    ...TYPOGRAPHY.headlineSm,
    textAlign: 'center',
  },
});