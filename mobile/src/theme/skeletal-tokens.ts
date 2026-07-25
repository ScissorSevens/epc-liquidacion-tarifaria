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
  // === COLORES INSTITUCIONALES EPC (fuente de verdad: identidad visual) ===
  // 4 colores principales: azul oscuro (identidad), azul claro (complementario),
  // amarillo y rojo.
  // 3 complementarios: verde, azul digital y gris claro.
  brandAzulOscuro: '#093C5D',     // color principal de la identidad
  brandAzulClaro: '#359CC8',     // complementario
  brandAmarillo: '#FFDC26',
  brandRojo: '#D5212A',
  brandVerde: '#76B718',
  brandAzulDigital: '#0092FF',
  brandGrisClaro: '#DADADA',

  // Capa de fondo — el lienzo "papel".
  background: '#F8F9FF',
  // Superficies elevadas (cards, inputs activos en hover).
  surfaceLight: '#EFF4FF',
  // Superficie ligera para footers metadata.
  surfaceMuted: '#E5EEFF',
  surfaceMuted2: '#E4E4E7',
  // Tinta primaria — bordes, texto principal, botones primarios.
  // Mapeado al brandAzulOscuro institucional.
  primary: '#093C5D',
  onPrimary: '#FFFFFF',
  // Contenedor primario y sobre contenedor primario.
  primaryContainer: '#1A2B48',
  onPrimaryContainer: '#B3C5D8',
  // Color secundario — mapeado al brandAzulDigital institucional.
  secondary: '#0092FF',
  secondaryContainer: '#00CCF9',
  onSecondaryContainer: '#005266',
  // Superficies de contenedor.
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#EFF4FF',   // equivalente a surfaceLight, alias para M3
  surfaceContainerHigh: '#DCE9FF',
  surface: '#F8F9FF',
  // Sobre superficie.
  onSurface: '#0B1C30',
  onSurfaceVariant: '#44474D',
  // Texto secundario / iconografía secundaria.
  textSecondary: '#44474D',
  textTertiary: '#808080',
  // Bordes.
  outline: '#75777E',
  outlineVariant: '#C5C6CE',
  // Divisores internos en cards (zinc-300).
  divider: '#D4D4D8',
  // Placeholder en inputs (zinc-300/400).
  placeholder: '#D4D4D8',
  // Colores de superficie adicionales.
  onBackground: '#0B1C30',
  surfaceContainer: '#E5EEFF',
  surfaceVariant: '#D3E4FE',
  surfaceDim: '#CBDBF5',
  inverseSurface: '#213145',
  inverseOnSurface: '#EAF1FF',
  // Advertencia.
  warning: '#EF6C00',
  warningContainer: '#FFEDD5',
  onWarningContainer: '#5A3500',
  // Estados de error — mapeado al brandRojo institucional.
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  error: '#D5212A',
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
  xxl: 48,
  margin: 20,
} as const;

/**
 * Radios. El sistema permite 8–12 para cards/botones; 0 para inputs (rectos).
 * `none` lo agregamos para ser explícitos en componentes que NO redondean.
 */
export const RADIUS = {
  none: 0,
  sm: 4,
  default: 12,
  card: 16,
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
  displayLg: {
    fontFamily: undefined,
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 44,
    letterSpacing: -1.5,
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
  focused: { borderWidth: 2, borderColor: COLORS.secondary },
  error: { borderWidth: 2, borderColor: COLORS.error },
} as const;

/**
 * Sombras para elevación FUNCIONAL. `float` es para FABs, bottom-bars y
 * popovers que necesitan sombra para separarse del contenido scrolleable.
 *
 * Antes existia `card` (elevation: 2, shadowRadius: 4) pensado como
 * decoracion de cards normales. Pero combinada con `borderWidth: 1`
 * producia el patron "ghost-card" que veta impecable v1. Cards de
 * contenido usan solo borderWidth + borderColor; la sombra se reserva
 * para superficies REALMENTE elevadas del scroll.
 */
export const SHADOWS = {
  float: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
} as const;
