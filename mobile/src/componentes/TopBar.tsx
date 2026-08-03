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

  // ── Variante raíz: fondo claro + border-bottom (coherente con
  // topBarDetalle y con el resto de los screens). El "rango" principal
  // es el tamaño del título: más grande y bold (headlineSm) que detail
  // (bodyLg regular). Sin flecha de back. ─────────────────────────────
  topBarRaiz: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },

  // ── Variante detalle: mismo fondo claro, mismo border, título más
  // pequeño. Con flecha de back. Distinción visual con raíz = tipografía
  // y el ícono de back, no el color de fondo (sin inconsistencias
  // visuales entre variantes). ─────────────────────────────────────────
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

  // ── Título raíz: grande, bold, brand (jerarquía principal) ─────────────
  // usa el token brand explicito (no primary generico) para hacer
  // visible la intención institucional — principio de color con
  // propósito semántico de impeccable. Modern feel via:
  //   - fontWeight 700 (sin bold en otros títulos)
  //   - letterSpacing -0.3 (tracking apretado, premium)
  tituloRaiz: {
    ...TYPOGRAPHY.headlineSm,
    fontWeight: '700' as const,
    color: COLORS.brandAzulOscuro,
    letterSpacing: -0.3,
  },

  // ── Título detalle: mediano, semibold, brand (jerarquía secundaria) ───
  tituloDetalle: {
    ...TYPOGRAPHY.bodyLg,
    fontWeight: '600' as const,
    color: COLORS.brandAzulOscuro,
    letterSpacing: -0.2,
  },

  // ── Subtítulo: tonalidad media, tracking sutil (modern / refined) ─────
  subtitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.2,
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
