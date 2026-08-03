import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps, ReactNode } from 'react';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

/**
 * BotonPrimario — CTAs institucionales del sistema EPC.
 *
 * Tres tonos disponibles segun proposito semantico (impeccable:
 * color con proposito, no decoracion):
 *   - 'azul'     → CTAs principales de flujo (Sincronizar, Ver historial,
 *                  Capturar, Guardar). brandAzulOscuro sobre blanco.
 *   - 'amarillo' → CTA destacado de entrada al sistema (Ingresar, Finalizar
 *                  setup). brandAmarillo de fondo con texto brandAzulOscuro.
 *   - 'rojo'     → CTAs destructivos / sensibles (Cerrar sesion). brandRojo
 *                  con texto blanco.
 *
 * Decisiones de craft (impeccable v1, register product):
 *   - Altura 56px (tamano 'normal') o 48px (tamano 'compacto'): SIEMPRE
 *     >= 44px para cumplir WCAG 2.5.5 y el PRODUCT.md non-negotiable.
 *   - borderRadius RADIUS.md (12px). Nunca RADIUS.xl (24): el sobre-redondeo
 *     en botones es codex tell. La pill no funciona aqui.
 *   - Solo shadow. NUNCA border + shadow combo (ghost-card ban).
 *   - Sin textTransform: 'uppercase' (ALL CAPS ban). La etiqueta llega
 *     en Title Case desde el callsite — es contrato del componente.
 *   - Token explicito brand* (no COLORS.primary generico): la identidad
 *     institucional queda visible en el source aunque resuelva al mismo hex.
 *   - Texto en Title Case / verb+object (callsite contract):
 *     "Sincronizar ahora", "Ver historial", "Cerrar sesion".
 *
 * Migraciones:
 *   Antes existia una copia local de este patron en cada pantalla con
 *   pequenas variaciones (height 48 vs 56, radius 12 vs 24, color primary
 *   vs brandAmarillo). Este componente consolida todas las variantes.
 */
type NombreIconoMaterial = ComponentProps<typeof MaterialIcons>['name'];
type TonoBoton = 'azul' | 'amarillo' | 'rojo';
type TamanoBoton = 'normal' | 'compacto';

interface BotonPrimarioProps {
  /** Etiqueta visible. Verb + object (Title Case). */
  readonly texto: string;
  /** Callback al presionar. */
  readonly onPress: () => void;
  /** Icono Material a la izquierda (opcional). */
  readonly icono?: NombreIconoMaterial;
  /**
   * iconoComponente — override completo del icono izquierdo.
   *
   * Use case: integracion expo-native-ui donde iOS usa un SF Symbol
   * (`<Image source="sf:..." />` de expo-image) y Android usa
   * MaterialIcons. Pasar este prop tiene prioridad sobre `icono`.
   *
   * Default: `undefined` (usa `icono` + MaterialIcons como antes).
   */
  readonly iconoComponente?: ReactNode;
  /**
   * Tono semantico del fondo.
   * Default: 'azul' (CTAs de flujo principal).
   */
  readonly tono?: TonoBoton;
  /**
   * Tamano de la altura.
   * Default: 'normal' (56px). 'compacto' = 48px (chips / dialogs).
   */
  readonly tamano?: TamanoBoton;
  /** Deshabilitado: opaca el fondo, ignora onPress. */
  readonly disabled?: boolean;
  /** Carga: muestra ActivityIndicator + textoCargando, ignora onPress. */
  readonly cargando?: boolean;
  /** Texto a mostrar mientras cargando. Default: 'Procesando…'. */
  readonly textoCargando?: string;
  /** testID para tests. */
  readonly testID?: string;
  /** Accessibility label override (default = texto). */
  readonly accessibilityLabel?: string;
}

export function BotonPrimario({
  texto,
  onPress,
  icono,
  iconoComponente,
  tono = 'azul',
  tamano = 'normal',
  disabled = false,
  cargando = false,
  textoCargando = 'Procesando…',
  testID,
  accessibilityLabel,
}: BotonPrimarioProps) {
  const inactivo = disabled || cargando;

  const estiloTono =
    tono === 'amarillo'
      ? styles.tonoAmarillo
      : tono === 'rojo'
      ? styles.tonoRojo
      : styles.tonoAzul;

  const estiloTamano =
    tamano === 'compacto' ? styles.tamanoCompacto : styles.tamanoNormal;

  // Color de texto segun tono:
  // - amarillo: brandAzulOscuro (gran contraste sobre el amarillo institucional)
  // - azul / rojo: COLORS.onPrimary (blanco, contraste >= 4.5:1 sobre ambos)
  const colorTexto = tono === 'amarillo' ? COLORS.brandAzulOscuro : COLORS.onPrimary;
  const colorIcono = colorTexto;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.base,
        estiloTamano,
        estiloTono,
        pressed && !inactivo && styles.pressed,
        inactivo && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? texto}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      testID={testID}
    >
      {cargando ? (
        <View style={styles.contenido}>
          <ActivityIndicator size="small" color={colorTexto} />
          {textoCargando !== '' && (
            <Text style={[styles.texto, { color: colorTexto }]} testID={`${testID ?? 'btn'}-loading-text`}>
              {textoCargando}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.contenido}>
          {iconoComponente !== undefined ? (
            iconoComponente
          ) : (
            icono !== undefined && (
              <MaterialIcons
                name={icono}
                size={20}
                color={colorIcono}
                testID={testID !== undefined ? `${testID}-icon` : undefined}
              />
            )
          )}
          <Text style={[styles.texto, { color: colorTexto }]}>{texto}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    // Shadow SOLO (sin borderWidth) — evita ghost-card anti-pattern.
    // shadowRadius 2 + opacity 0.12 mantiene el shadow discreto; el boton
    // se eleva visualmente sin gritar "card".
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },

  // ── Tamano ──────────────────────────────────────────────────────────────
  // WCAG 2.5.5 + PRODUCT.md: ambos >= 44px touch target.
  tamanoNormal: {
    height: 56,
    paddingHorizontal: SPACING.lg,
  },
  tamanoCompacto: {
    height: 48,
    paddingHorizontal: SPACING.md,
  },

  // ── Tonos (color con proposito semantico) ────────────────────────────────
  // azul: identidad institucional explicita. Aunque COLORS.primary resuelve
  // al mismo #093C5D, usamos brandAzulOscuro para hacer visible la intencion
  // institucional en el source — principio de token explicito de impeccable.
  tonoAzul: {
    backgroundColor: COLORS.brandAzulOscuro,
  },
  tonoAmarillo: {
    backgroundColor: COLORS.brandAmarillo,
  },
  tonoRojo: {
    backgroundColor: COLORS.brandRojo,
  },

  // ── Estados ─────────────────────────────────────────────────────────────
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },

  // ── Texto ───────────────────────────────────────────────────────────────
  // Sin textTransform: uppercase (ALL CAPS ban).
  texto: {
    ...TYPOGRAPHY.labelLg,
  },
});