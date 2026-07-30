/**
 * Pantalla Mi Perfil — datos reales del operario + prestador activo.
 *
 * mi-perfil-redesign Task 3 — la sección "Parámetros tarifarios" y su
 * modal de edición fueron REMOVIDOS de esta pantalla. El hogar canónico
 * para gestionar parámetros tarifarios del prestador activo es
 * `mobile/src/pantallas/admin/ParametrosTarifa.tsx` (fuera de scope de
 * este change). Tener dos flujos de edición distintos para la misma
 * entidad generaba confusión sobre cuál era el camino válido para el
 * operario.
 *
 * Fuentes de datos:
 *   - Sesion (AsyncStorage via `cargarSesion()`): cedula, nombre,
 *     idOperario. La sesión NO trae email ni teléfono — esos campos se
 *     muestran como "—" hasta que se agregue un flujo de edición de
 *     perfil del operario. (Operario.email existe en dominio pero requiere
 *     fetch via operarioRepo, fuera de scope.)
 *   - useWorkspace.prestador: nombre, municipio, codigo del prestador
 *     activo. Se popula vía WorkspaceSwitcher / cambiarPrestadorYCargarContexto.
 */
import { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BotonPrimario } from '../componentes/BotonPrimario';
import { FooterApp } from '../componentes/FooterApp';
import { TarjetaMetrica } from '../componentes/TarjetaMetrica';
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
 * H1 clamp del nombre del operario.
 *
 * Simula `clamp(2rem, 5vw, 3.25rem)` de CSS en runtime React Native.
 * Rango efectivo: 32 px (2rem) a 52 px (3.25rem). El preferred 5vw se
 * computa contra el ancho de pantalla — al envoltorio de tests con
 * `frame.width: 320` y al frame default de RN 0x0 en jest, el clamp
 * cae en el piso (32 px) sin overflow.
 *
 * mi-perfil-redesign Task 1 — impeccable craft typography.
 */
const NOMBRE_FONT_SIZE_CLAMP = ((): number => {
  const { width } = Dimensions.get('window');
  const minimo = 32; // 2rem
  const maximo = 52; // 3.25rem
  const preferido = width * 0.05; // 5vw
  return Math.min(Math.max(minimo, preferido), maximo);
})();

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
  const [toastVisible, setToastVisible] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);

  // PER-05: selectores específicos. Solo nos interesa prestador.
  // Cambios en prestadores_disponibles / cargando / acuerdo_vigente /
  // parametros_vigentes NO causan re-render — el panel de parámetros
  // ya no vive en esta pantalla (ver admin/ParametrosTarifa.tsx).
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

  function mostrarToast() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
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

      <ScrollView contentContainerStyle={estilos.scroll}>
        {/* Avatar */}
        <View style={estilos.avatarSeccion}>
          <View style={estilos.avatar} testID="avatar">
            <Text style={estilos.avatarTexto}>{iniciales}</Text>
          </View>
          <Text style={estilos.nombre} testID="perfil-nombre">{nombre}</Text>
          <Text style={estilos.rol} testID="perfil-rol">{rol}</Text>
        </View>

        {/* Actividad Reciente */}
        <Text style={estilos.seccionTitulo}>Actividad reciente</Text>
        <View style={estilos.gridFila}>
          <TarjetaMetrica
            icono="edit-note"
            etiqueta="Lecturas"
            valor={PLACEHOLDER}
            variante="normal"
            testID="tarjeta-lecturas"
          />
          <TarjetaMetrica
            icono="sync"
            etiqueta="Última sincronización"
            valor={PLACEHOLDER}
            variante="normal"
            testID="tarjeta-ultima-sincro"
          />
        </View>

        {/* Información Personal */}
        <Text style={estilos.seccionTitulo}>Información personal</Text>
        <View style={estilos.listaCard}>
          <FilaInfo
            etiqueta="Cédula"
            valor={cedula}
            testID="fila-cedula"
            borde
          />
          <FilaInfo
            etiqueta="ID Operario"
            valor={idOperarioStr}
            testID="fila-id-operario"
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
          />
        </View>

        {/* Configuración */}
        <Text style={estilos.seccionTitulo}>Configuración</Text>
        <View style={estilos.listaCard}>
          <View style={estilos.filaConfig}>
            <Pressable style={estilos.filaConfigIzq} onPress={mostrarToast} accessibilityLabel="Notificaciones — próximamente">
              <MaterialIcons name="notifications" size={20} color={COLORS.primary} />
              <Text style={estilos.filaConfigTexto}>Notificaciones</Text>
            </Pressable>
            {/* Toggle visual estático — funcionalidad futura.
                hit-area ≥ 44px (WCAG 2.5.5) vía wrapper. */}
            <Pressable
              onPress={mostrarToast}
              accessibilityLabel="Activar notificaciones"
              style={estilos.toggleWrapper}
            >
              <View style={estilos.toggleOff}>
                <View style={estilos.toggleThumb} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Cerrar sesión */}
        <BotonPrimario
          texto="Cerrar sesión"
          tono="rojo"
          icono="logout"
          onPress={async () => {
            await limpiarSesion();
            onLogoutRequested();
          }}
          testID="boton-cerrar-sesion"
        />

        <FooterApp />
      </ScrollView>

      {toastVisible && (
        <View style={estilos.toast}>
          <Text style={estilos.toastTexto}>Próximamente disponible</Text>
        </View>
      )}
    </View>
  );
}

function FilaInfo({
  etiqueta,
  valor,
  borde,
  testID,
}: {
  etiqueta: string;
  valor: string;
  borde?: boolean;
  testID?: string;
}) {
  return (
    <View style={[estilos.fila, borde && estilos.filaBorde]} testID={testID}>
      <Text style={estilos.filaEtiqueta}>{etiqueta}</Text>
      <Text
        style={estilos.filaValor}
        testID={testID !== undefined ? `${testID}-valor` : undefined}
      >
        {valor}
      </Text>
    </View>
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
  avatar: {
    // mi-perfil-redesign Task 1: 96 → 120 px para mejorar jerarquía
    // visual y presencia del operario (impeccable: el avatar es el
    // anchor emocional de la pantalla).
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandAzulOscuro,
    borderWidth: 1,
    borderColor: COLORS.brandAzulOscuro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarTexto: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.onPrimary,
  },
  nombre: {
    // H1 clamp: rango efectivo [32, 52] px — simula el clamp(2rem, 5vw,
    // 3.25rem) de web. el `...TYPOGRAPHY.headlineLg` aporta fontWeight
    // y lineHeight; el fontSize queda overridden por la clamp.
    ...TYPOGRAPHY.headlineLg,
    fontSize: NOMBRE_FONT_SIZE_CLAMP,
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
  },
  gridFila: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginHorizontal: SPACING.margin,
  },
  listaCard: {
    marginHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
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
  },
  filaConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  filaConfigIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
    // WCAG 2.5.5: touch target >= 44px. La fila entera (icon + texto)
    // debe ser tappable, no solo el icono. Sin esto, el Pressable
    // colapsa al alto del contenido (~36px) y falla el criterio.
    minHeight: 44,
  },
  filaConfigTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
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
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.full,
  },
  toastTexto: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
});