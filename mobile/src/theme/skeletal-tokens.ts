/**
 * Tokens del Skeletal Wireframe System (Stitch) — variante Modern Brutalism.
 *
 * Fuente de verdad: `stitch_mediapp_rural_water_wireframes/skeletal_wireframe_system/DESIGN.md`.
 *
 * Decisión: usamos StyleSheet vanilla con estos tokens como constantes JS
 * en vez de NativeWind/Tailwind/twrnc. Razones:
 *   - Cero dependencias nuevas (riesgo cero para el APK de la Tarea 11).
 *   - Control total sobre el look skeletal sin pelearse con `react-native-paper`
 *     que sigue vivo en las otras 5 pantallas.
 *   - Solo `CapturarLectura` y `ResultadoCalculo` consumen estos tokens hoy.
 *
 * Sobre la fuente Inter:
 *   El design system pide `Inter`. NO instalamos `expo-google-fonts/inter`
 *   en este ciclo (sin nuevas deps por mandato del plan). Dejamos
 *   `fontFamily: undefined` para que el sistema use la default — en Android
 *   queda Roboto, en iOS San Francisco. Aceptable para esta versión.
 */

export const COLORS = {
  // Capa de fondo — el lienzo "papel".
  background: '#FFFFFF',
  // Superficies elevadas (cards, inputs activos en hover).
  surfaceLight: '#F2F2F2',
  // Superficie ligera para footers metadata (zinc-100/200 del Tailwind ref).
  surfaceMuted: '#F4F4F5',
  surfaceMuted2: '#E4E4E7',
  // Tinta primaria — bordes, texto principal, botones primarios.
  primary: '#000000',
  onPrimary: '#FFFFFF',
  // Texto secundario / iconografía secundaria.
  textSecondary: '#5d5f5f',
  textTertiary: '#808080',
  // Borde estándar — siempre 1px black.
  outline: '#000000',
  // Divisores internos en cards (zinc-300).
  divider: '#D4D4D8',
  // Placeholder en inputs (zinc-300/400).
  placeholder: '#D4D4D8',
  // Estados de error (heredados del DESIGN.md).
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  error: '#ba1a1a',
} as const;

/**
 * Spacing en una grilla de 8px. `margin` (20px) es el outer margin de pantalla.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  base: 8,
  gutter: 12,
  md: 16,
  lg: 24,
  xl: 32,
  margin: 20,
} as const;

/**
 * Radios. El sistema permite 8–12 para cards/botones; 0 para inputs (rectos).
 * `none` lo agregamos para ser explícitos en componentes que NO redondean.
 */
export const RADIUS = {
  none: 0,
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Tipografía. `fontFamily: undefined` deja que RN use la fuente del sistema —
 * ver nota al inicio del archivo sobre Inter.
 */
export const TYPOGRAPHY = {
  headlineLg: {
    fontFamily: undefined,
    fontSize: 30,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  headlineMd: {
    fontFamily: undefined,
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  headlineSm: {
    fontFamily: undefined,
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  bodyLg: {
    fontFamily: undefined,
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: undefined,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySm: {
    fontFamily: undefined,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  labelLg: {
    fontFamily: undefined,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  labelMd: {
    fontFamily: undefined,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  labelSm: {
    fontFamily: undefined,
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
} as const;

/**
 * Bordes preconfigurados. Sobre `dashed` en Android RN:
 *   `borderStyle: 'dashed'` solo funciona si `borderRadius === 0`. Cuando
 *   se aplica con radius > 0 cae a `solid` silenciosamente en Android.
 *   Para evitarlo: envolver el elemento en un `View` con borde dashed sin
 *   radius y otro View interno con el radius — o aceptar el fallback a solid.
 *   Nuestra implementación usa `dashed` en el botón de cámara y acepta
 *   el fallback a solid en Android (degradación grácil).
 */
export const BORDERS = {
  thin: { borderWidth: 1, borderColor: COLORS.outline },
  thick: { borderWidth: 2, borderColor: COLORS.outline },
  dashed: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderStyle: 'dashed' as const,
  },
} as const;
