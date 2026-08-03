import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

/**
 * Altura base del área de contenido (sin contar el inset del sistema).
 * Las pantallas que necesiten compensar el espacio del TopBar usan
 * TOPBAR_HEIGHT + insets.top — o simplemente dejan flex:1 en el contenido.
 */
export const TOPBAR_HEIGHT = 56;

interface TopBarProps {
  titulo: string;
  subtitulo?: string;           // línea secundaria bajo el título (pantallas de detalle)
  onBack?: () => void;          // si se pasa → modo "detalle": título más pequeño + flecha
  accionDerecha?: ReactNode;    // slot libre para iconos derecha
}

export function TopBar({ titulo, subtitulo, onBack, accionDerecha }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const esDetalle = Boolean(onBack);

  return (
    <View
      style={[
        styles.topBar,
        esDetalle ? styles.topBarDetalle : styles.topBarRaiz,
        { paddingTop: insets.top + SPACING.sm },
      ]}
    >
      <View style={styles.izq}>
        {onBack && (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            onPress={onBack}
            hitSlop={12}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={esDetalle ? COLORS.brandAzulOscuro : COLORS.onPrimary}
            />
          </Pressable>
        )}
        <View style={styles.titulos}>
          <Text
            style={[esDetalle ? styles.tituloDetalle : styles.tituloRaiz]}
            numberOfLines={1}
          >
            {titulo}
          </Text>
          {subtitulo !== undefined && subtitulo !== '' && (
            <Text style={styles.subtitulo} numberOfLines={1}>{subtitulo}</Text>
          )}
        </View>
      </View>

      {accionDerecha && (
        <View style={styles.der}>{accionDerecha}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.sm + 4,
  },

  // ── Variante raíz: fondo brandAzulOscuro, título blanco, sin flecha ──────
  // Usamos COLORS.brandAzulOscuro (identidad institucional explicita) en vez
  // de COLORS.primary (semantico generico). Ambos resuelven al mismo #093C5D
  // pero el token brand hace visible la intencion institucional — principio
  // de color con proposito semantico de impecable.
  topBarRaiz: {
    backgroundColor: COLORS.brandAzulOscuro,
  },

  // ── Variante detalle: fondo claro, título oscuro, con flecha ─────────────
  topBarDetalle: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },

  // ── Contenido ─────────────────────────────────────────────────────────────
  izq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  der: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingBottom: 2,
  },
  titulos: {
    flex: 1,
    gap: 1,
  },

  // ── Título raíz: grande, blanco ───────────────────────────────────────────
  tituloRaiz: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.onPrimary,
    letterSpacing: -0.3,
  },

  // ── Título detalle: mediano, oscuro ───────────────────────────────────────
  tituloDetalle: {
    ...TYPOGRAPHY.bodyLg,
    fontWeight: '600' as const,
    color: COLORS.brandAzulOscuro,
    letterSpacing: -0.2,
  },

  subtitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
  },

  // ── Boton de icono: WCAG 2.5.5 touch target >= 44x44 ────────────────────
  // Antes era 36x36 → fallaba auditoria a11y y el PRODUCT.md non-negotiable.
  // hitSlop=12 expande hit area total a 68x68, holgura amplia para dedos.
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
