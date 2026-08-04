/**
 * Pantalla Mi Perfil — datos reales del operario + prestador activo.
 *
 * mi-perfil-unification-and-param-persistence — esta pantalla absorbe
 * la funcionalidad de `Configuracion.tsx` (eliminado) y consolida:
 *   1. Datos del operario desde Sesion (AsyncStorage via `cargarSesion()`).
 *   2. Datos del prestador activo desde `useWorkspace.prestador`.
 *   3. Tarjeta de descubrimiento "Parámetros tarifarios" (navega a
 *      admin/ParametrosTarifa.tsx — el hogar canónico de edición).
 *   4. Sección "Gestión" con 4 items: Agregar suscriptor (AltaSuscriptor),
 *      Importar desde CSV (ImportarCsv), Versión (1.0.0), Cerrar sesión.
 *   5. Cerrar sesión con Alert.alert de confirmación (destructive button).
 *
 * La tarjeta "Última sincronización" fue eliminada en este change — no
 * aporta información accionable para el operario (solo repite el último
 * sync decorativo).
 *
 * Fuentes de datos:
 *   - Sesion (AsyncStorage via `cargarSesion()`): cedula, nombre,
 *     idOperario. La sesión NO trae email ni teléfono — esos campos se
 *     muestran como "—" hasta que se agregue un flujo de edición de
 *     perfil del operario.
 *   - useWorkspace.prestador: nombre, municipio, codigo del prestador
 *     activo. Se popula vía WorkspaceSwitcher / cambiarPrestadorYCargarContexto.
 */
import { useEffect, useState, type ReactElement } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import { limpiarSesion, cargarSesion, type Sesion } from '../composition/constantes';
import { useWorkspace } from '../composicion/useWorkspace';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  BORDERS,
} from '../theme/skeletal-tokens';
import type { ConfigStackScreenProps } from '../navegacion/types';

type Props = ConfigStackScreenProps<'MiPerfil'> & {
  readonly onLogoutRequested: () => void;
};

/** Placeholder honesto cuando no hay dato real cargado todavía. */
const PLACEHOLDER = '—';

/**
 * Wrapper silencioso de Haptics. La API de expo-haptics puede tirar
 * en simuladores / devices sin motor haptico; en esos casos queremos
 * fallar silenciosamente y NO romper el flujo del usuario.
 */
async function safeHaptic(kind: 'selection' | 'warning'): Promise<void> {
  try {
    if (kind === 'selection') {
      await Haptics.selectionAsync();
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // silent - haptics son best-effort
  }
}

/** Iniciales (hasta 2 letras) derivadas del nombre. Vacío si no hay nombre. */
function obtenerIniciales(nombre: string | undefined): string {
  if (nombre === undefined || nombre.trim() === '') return '';
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function MiPerfil({ navigation, onLogoutRequested }: Props) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  // F-1 (responsive-text REQ-2): H1 clamp reactivo. Rango [32, 52] px.
  const { width: windowWidth } = useWindowDimensions();
  const nombreFontSize = Math.min(
    Math.max(32, windowWidth * 0.05),
    52,
  );

  // PER-05: selectores específicos. Solo nos interesa prestador.
  // Cambios en prestadores_disponibles / cargando / acuerdo_vigente /
  // parametros_vigentes NO causan re-render — el panel de parámetros
  // ya no vive en esta pantalla (ver admin/ParametrosTarifa.tsx).
  const id_prestador_activo = useWorkspace((s) => s.id_prestador_activo);
  const prestador = useWorkspace((s) => s.prestador);

  // Cargar sesión al mount. La sesión vive en AsyncStorage bajo
  // `@sistema_epc:sesion` y `cargarSesion()` ya valida vigencia + shape.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const s = await cargarSesion();
      if (!cancelado) setSesion(s);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Confirma el cierre de sesión con Alert.alert destructivo.
   *
   * mi-perfil-unification-and-param-persistence — antes esta lógica vivía
   * en `Configuracion.tsx` (eliminado). Ahora vive acá, integrada con el
   * resto del flujo de MiPerfil.
   *
   * Flujo:
   *   1. Alert.alert con dos botones: Cancelar (cancel) y Cerrar sesión
   *      (destructive).
   *   2. Al confirmar: `limpiarSesion()` borra la sesión en AsyncStorage.
   *   3. `useWorkspace.getState().limpiarWorkspace()` limpia contexto
   *      multi-tenant.
   *   4. `onLogoutRequested()` delega al caller (AppNavigator) la
   *      transición al stack de Login.
   */
  function handleCerrarSesion(): void {
    // F-3 (haptics REQ-2): warning haptic en acción destructiva.
    void safeHaptic('warning');
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que querés cerrar sesión? Vas a tener que volver a ingresar tu cédula y contraseña.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await limpiarSesion();
            // useWorkspace expone limpiarWorkspace en getState() — tipado
            // estructural directo sin cast inseguro (la interface expone
            // el método y zustand tipa getState() automáticamente).
            try {
              useWorkspace.getState().limpiarWorkspace();
            } catch {
              // Workspace cleanup es best-effort — la sesión ya se limpió.
            }
            await onLogoutRequested();
          },
        },
      ],
    );
  }

  // ── Valores derivados ─────────────────────────────────────────────────────

  const nombre = sesion?.nombre ?? PLACEHOLDER;
  const idOperarioNum = sesion?.idOperario;
  const cedula = sesion?.cedula ?? PLACEHOLDER;
  const idOperarioStr =
    idOperarioNum !== undefined && idOperarioNum > 0
      ? `#${idOperarioNum}`
      : PLACEHOLDER;
  const inicialesCalc = obtenerIniciales(sesion?.nombre);
  // Sin sesion caemos al placeholder legacy "OP" (Operario) — backward
  // compatible con tests MP-2 que verifican que el avatar muestra "OP"
  // en el estado "sin sesión".
  const iniciales = inicialesCalc === '' ? 'OP' : inicialesCalc;
  // Rol: la Sesion no trae rol explícito; mostramos "Operario" cuando
  // hay sesion activa. "—" en el fallback para no mentir con un literal
  // hardcoded (el viejo "Operario rural · EPC" era engañoso).
  const rol = sesion !== null ? 'Operario' : PLACEHOLDER;
  const prestadorNombre = prestador?.nombre ?? PLACEHOLDER;
  const prestadorMunicipio = prestador?.municipio ?? '';
  const prestadorCodigo = prestador?.codigo ?? '';

  return (
    <View style={estilos.raiz}>
      {/* Top App Bar */}
      <TopBar
        titulo="Mi Perfil"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        testID="scroll-perfil"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={estilos.scroll}
      >
        {/* Avatar — reducido de 120 → 80 px para tono más sobrio y coherente
            con el resto de los screens (impeccable: el avatar es anchor
            emocional, no un elemento dominante). */}
        <View style={estilos.avatarSeccion}>
          <View style={estilos.avatarWrapper}>
            <View style={[estilos.avatar, estilos.avatarShadow]} testID="avatar">
              <Text style={estilos.avatarTexto}>{iniciales}</Text>
            </View>
            {sesion !== null && (
              <View style={estilos.avatarStatusDot} testID="avatar-status-dot" />
            )}
          </View>
          <Text style={[estilos.nombre, { fontSize: nombreFontSize }]} testID="perfil-nombre">{nombre}</Text>
          <Text style={estilos.rol} testID="perfil-rol">{rol}</Text>
        </View>

        {/* Información Personal — eliminada sección "Actividad reciente"
            que mostraba "—" sin información accionable. */}
        <Text style={estilos.seccionTitulo}>Información personal</Text>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="Cédula"
            valor={cedula}
            testID="fila-cedula"
            selectable
            borde
          />
          <FilaInfo
            etiqueta="ID Operario"
            valor={idOperarioStr}
            testID="fila-id-operario"
            selectable
            borde
          />
          <FilaInfo
            etiqueta="Teléfono"
            valor={PLACEHOLDER}
            testID="fila-telefono"
            borde
          />
          <FilaInfo
            etiqueta="Correo"
            valor={PLACEHOLDER}
            testID="fila-correo"
          />
        </View>

        {/* Prestador actual */}
        <Text style={estilos.seccionTitulo}>Prestador actual</Text>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="Nombre"
            valor={prestadorNombre}
            testID="fila-prestador-nombre"
            borde
          />
          <FilaInfo
            etiqueta="Municipio"
            valor={prestadorMunicipio === '' ? PLACEHOLDER : prestadorMunicipio}
            testID="fila-prestador-municipio"
            borde
          />
          <FilaInfo
            etiqueta="Código"
            valor={prestadorCodigo === '' ? PLACEHOLDER : prestadorCodigo}
            testID="fila-prestador-codigo"
            selectable
          />
        </View>

        {/* Gestión — incluye Parámetros tarifarios (movido de la sección
            Configuración, que se eliminó por tener un solo item huerfano).
            "Cerrar sesión" vive al fondo por convención Apple HIG. */}
        <Text style={estilos.seccionTitulo}>Gestión</Text>
        <View style={estilos.listaCard}>
          <ItemGestion
            icono="person-add"
            etiqueta="Agregar suscriptor"
            onPress={() => navigation.navigate('AltaSuscriptor')}
            testID="item-alta-suscriptor"
            accessibilityHint="Abre el formulario para registrar un nuevo suscriptor."
            destructive={false}
          />
          <View style={estilos.filaConfigDivisor} />
          <ItemGestion
            icono="upload-file"
            etiqueta="Importar desde CSV"
            onPress={() => navigation.navigate('ImportarCsv')}
            testID="item-importar-csv"
            accessibilityHint="Abre el importador desde archivo CSV."
            destructive={false}
          />
          <View style={estilos.filaConfigDivisor} />
          <ItemGestion
            icono="info"
            etiqueta="Versión"
            valor="1.0.0"
            testID="item-version"
            destructive={false}
          />
          <View style={estilos.filaConfigDivisor} />
          <ItemGestion
            icono="tune"
            etiqueta="Parámetros tarifarios"
            onPress={() => navigation.navigate('Config', { screen: 'ParametrosTarifa', params: { id_prestador: id_prestador_activo } })}
            testID="item-parametros-tarifarios"
            accessibilityHint="Abre la pantalla de parámetros tarifarios."
            destructive={false}
          />
          <View style={estilos.filaConfigDivisor} />
          <ItemGestion
            icono="logout"
            etiqueta="Cerrar sesión"
            onPress={handleCerrarSesion}
            testID="item-cerrar-sesion"
            accessibilityHint="Confirma y cierra la sesión actual."
            destructive
          />
        </View>

        <FooterApp />
      </ScrollView>
    </View>
  );
}

function FilaInfo({
  etiqueta,
  valor,
  borde,
  selectable = false,
  testID,
}: {
  etiqueta: string;
  valor: string;
  borde?: boolean;
  /**
   * Habilita seleccion nativa de texto en el valor (copy en long-press).
   * Default false (D1 design: conservador opt-in) — solo cedula,
   * idOperario y codigo del prestador son copiables.
   */
  selectable?: boolean;
  testID?: string;
}) {
  return (
    <View style={[estilos.fila, borde && estilos.filaBorde]} testID={testID}>
      <Text style={estilos.filaEtiqueta}>{etiqueta}</Text>
      <Text
        style={estilos.filaValor}
        selectable={selectable}
        testID={testID !== undefined ? `${testID}-valor` : undefined}
      >
        {valor}
      </Text>
    </View>
  );
}

/**
 * ItemGestion — fila tappable de la sección Gestión (mi-perfil-unification).
 *
 * Estructura:
 *   [icono] etiqueta ............ [valor?] [chevron?]
 *
 * Variantes:
 *   - onPress + sin valor → fila navegable (chevron-right al final).
 *   - valor definido → fila informativa (sin chevron).
 *   - destructive → texto en COLORS.error (icono + texto).
 *
 * Hit-area: 56 px (WCAG 2.5.5 ≥ 44 px) — ver `estilos.itemGestion`.
 */
function ItemGestion({
  icono,
  etiqueta,
  valor,
  onPress,
  testID,
  destructive = false,
  accessibilityHint,
}: {
  icono: 'person-add' | 'upload-file' | 'info' | 'logout' | 'tune';
  etiqueta: string;
  valor?: string;
  onPress?: () => void;
  testID?: string;
  destructive?: boolean;
  accessibilityHint?: string;
}): ReactElement {
  const color = destructive ? COLORS.error : COLORS.primary;
  const contenido = (
    <View style={estilos.itemGestion}>
      <View style={estilos.itemGestionIzq}>
        <MaterialIcons name={icono} size={22} color={color} />
        <Text
          style={[
            estilos.itemGestionTexto,
            destructive ? estilos.itemGestionTextoDestructivo : null,
          ]}
        >
          {etiqueta}
        </Text>
      </View>
      {valor !== undefined ? (
        <Text style={estilos.itemGestionValor}>{valor}</Text>
      ) : onPress !== undefined ? (
        <MaterialIcons name="chevron-right" size={22} color={COLORS.outline} />
      ) : null}
    </View>
  );

  if (onPress === undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={etiqueta}>
        {contenido}
      </View>
    );
  }

  // F-3 (haptics REQ-1): selection haptic en items navegables. La
  // operacion de haptics corre en paralelo al onPress original via
  // Promise.allSettled (no bloqueamos el feedback visual del tap).
  const handlePress = (): void => {
    void safeHaptic('selection');
    onPress();
  };

  // F-6 (press-feedback REQ-1): pressed state visual con rgba.
  // F-14 (a11y hints): hint opcional en items navegables.
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        estilos.itemGestion,
        pressed && estilos.itemGestionPressed,
      ]}
    >
      {contenido}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: SPACING.xxl,
  },
  avatarSeccion: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.margin,
  },
  // F-7a (D8 design): wrapper relativo para anclar el status dot
  // absoluto sin escapar del contexto del avatar.
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    // 80 px — tono sobrio coherente con el resto de los screens
    // (impeccable: el avatar es anchor emocional, no elemento dominante).
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandAzulOscuro,
    borderWidth: 1,
    borderColor: COLORS.brandAzulOscuro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  // F-7a (D8 design): shadow sutil cross-platform + elevation Android.
  avatarShadow: {
    shadowColor: COLORS.brandAzulOscuro,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  // F-7b (D9 design): status dot verde en bottom-right, condicional
  // a sesion !== null. Borde blanco para separacion visual del avatar.
  avatarStatusDot: {
    position: 'absolute',
    right: 0,
    bottom: SPACING.md,
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.surfaceContainerLowest,
  },
  avatarTexto: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.onPrimary,
  },
  nombre: {
    // H1 clamp: rango efectivo [32, 52] px — simula el clamp(2rem, 5vw,
    // 3.25rem) de web. el `...TYPOGRAPHY.headlineLg` aporta fontWeight
    // y lineHeight; el fontSize se sobreescribe inline en el JSX con
    // la clamp reactiva (`nombreFontSize`).
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  rol: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  seccionTitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
    // F-12 (Apple HIG tracking): letterSpacing 0.5 para que el
    // uppercase-tracked labelMd se lea con ritmo, no gritando.
    letterSpacing: 0.5,
  },
  gridFila: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginHorizontal: SPACING.margin,
  },
  listaCard: {
    marginHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    // F-8 (anti-ghost-card): 16px en lugar de 24 (RADIUS.xl) para
    // tono sobrio coherente con el resto de los screens.
    borderRadius: RADIUS.lg,
    ...BORDERS.thin,
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  filaBorde: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  filaEtiqueta: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  filaValor: {
    ...TYPOGRAPHY.bodyMd,
    fontWeight: '700',
    color: COLORS.primary,
    // F-5: tabular-nums para alinear cifras en columnas (cedula,
    // idOperario, codigo prestador).
    fontVariant: ['tabular-nums'],
  },
  filaConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    // WCAG 2.5.5: touch target >= 44px en toda la fila (no solo el icono).
    minHeight: 44,
  },
  // F-6 (press-feedback REQ-1): pressed state en filaConfig. Mismo
  // rgba que filaConfigPressed de ItemGestion.
  filaConfigPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  filaConfigIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    // F-13 (token discipline): usa SPACING.gutter (12) en vez del
    // magic-number SPACING.sm + 4 (legacy).
    gap: SPACING.gutter,
    // WCAG 2.5.5: touch target >= 44px. La fila entera (icon + texto)
    // debe ser tappable, no solo el icono. Sin esto, el Pressable
    // colapsa al alto del contenido (~36px) y falla el criterio.
    minHeight: 44,
  },
  filaConfigTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },
  // Divisor de 1px entre filas de la listaCard de Configuración.
  // Color con baja opacidad para legibilidad sin gritar "soy borde".
  filaConfigDivisor: {
    height: 1,
    backgroundColor: COLORS.outlineVariant,
    opacity: 0.5,
    marginHorizontal: SPACING.md,
  },
  toggleOff: {
    width: 44,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceDim,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  // Wrapper del toggle visual: lo eleva a 44px touch target aunque
  // el switch en sí mide 24px (WCAG 2.5.5). Sin esto, el toggle es
  // técnicamente tappable pero su hit-area es de ~24px.
  toggleWrapper: {
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  // mi-perfil-unification — estilos de ItemGestion.
  itemGestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    // WCAG 2.5.5: touch target >= 44px. 56 da margen sobre el icono + label.
    minHeight: 56,
  },
  // F-6 (press-feedback REQ-1): pressed state para ItemGestion.
  itemGestionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  itemGestionIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexShrink: 1,
  },
  itemGestionTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },
  itemGestionTextoDestructivo: {
    color: COLORS.error,
  },
  itemGestionValor: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
  },
});