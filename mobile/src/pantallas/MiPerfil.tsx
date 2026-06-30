import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import { limpiarSesion } from '../composition/constantes';
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  BORDERS,
} from '../theme/skeletal-tokens';
import type { ConfigStackScreenProps } from '../navegacion/types';

type Props = ConfigStackScreenProps<'MiPerfil'> & {
  readonly onLogoutRequested: () => void;
};

/** Datos de perfil estáticos — en el futuro vendrán del store. */
const PERFIL = {
  iniciales: 'OP',
  nombre: 'Operario',
  rol: 'Operario rural · EPC',
  idOperario: '—',
  telefono: '—',
  correo: '—',
  lecturas: '—',
  ultimaSincro: '—',
};

export default function MiPerfil({ navigation, onLogoutRequested }: Props) {
  const [toastVisible, setToastVisible] = useState(false);

  function mostrarToast() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }
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
          <View style={estilos.avatar}>
            <Text style={estilos.avatarTexto}>{PERFIL.iniciales}</Text>
          </View>
          <Text style={estilos.nombre}>{PERFIL.nombre}</Text>
          <Text style={estilos.rol}>{PERFIL.rol}</Text>
        </View>

        {/* Actividad Reciente */}
        <Text style={estilos.seccionTitulo}>ACTIVIDAD RECIENTE</Text>
        <View style={estilos.gridFila}>
          <View style={[estilos.gridCard, estilos.gridCardMitad]}>
            <MaterialIcons name="edit-note" size={24} color={COLORS.secondary} />
            <Text style={estilos.gridEtiqueta}>LECTURAS</Text>
            <Text style={estilos.gridValor}>{PERFIL.lecturas}</Text>
          </View>
          <View style={[estilos.gridCard, estilos.gridCardMitad]}>
            <MaterialIcons name="sync" size={24} color={COLORS.secondary} />
            <Text style={estilos.gridEtiqueta}>SINCRO</Text>
            <Text style={estilos.gridValor}>{PERFIL.ultimaSincro}</Text>
          </View>
        </View>

        {/* Información Personal */}
        <Text style={estilos.seccionTitulo}>INFORMACIÓN PERSONAL</Text>
        <View style={estilos.listaCard}>
          <FilaInfo etiqueta="ID Operario" valor={PERFIL.idOperario} borde />
          <FilaInfo etiqueta="Teléfono" valor={PERFIL.telefono} borde />
          <FilaInfo etiqueta="Correo" valor={PERFIL.correo} />
        </View>

        {/* Configuración */}
        <Text style={estilos.seccionTitulo}>CONFIGURACIÓN</Text>
        <View style={estilos.listaCard}>
          <View style={estilos.filaConfig}>
            <Pressable style={estilos.filaConfigIzq} onPress={mostrarToast} accessibilityLabel="Notificaciones — próximamente">
              <MaterialIcons name="notifications" size={20} color={COLORS.primary} />
              <Text style={estilos.filaConfigTexto}>Notificaciones</Text>
            </Pressable>
            {/* Toggle visual estático — funcionalidad futura */}
            <Pressable onPress={mostrarToast} accessibilityLabel="Activar notificaciones">
              <View style={estilos.toggleOff}>
                <View style={estilos.toggleThumb} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Cerrar sesión */}
        <Pressable
          style={({ pressed }) => [estilos.botonCerrar, pressed && estilos.botonPresionado]}
          onPress={async () => {
            await limpiarSesion();
            onLogoutRequested();
          }}
        >
          <MaterialIcons name="logout" size={20} color={COLORS.error} />
          <Text style={estilos.botonCerrarTexto}>CAMBIAR DE OPERARIO</Text>
        </Pressable>

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
}: {
  etiqueta: string;
  valor: string;
  borde?: boolean;
}) {
  return (
    <View style={[estilos.fila, borde && estilos.filaBorde]}>
      <Text style={estilos.filaEtiqueta}>{etiqueta}</Text>
      <Text style={estilos.filaValor}>{valor}</Text>
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
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  avatarTexto: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
  },
  nombre: {
    ...TYPOGRAPHY.headlineMd,
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
    letterSpacing: 1.2,
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  gridFila: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginHorizontal: SPACING.margin,
  },
  gridCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    ...BORDERS.thin,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  gridCardMitad: {
    flex: 1,
  },
  gridEtiqueta: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    marginTop: SPACING.xs,
    letterSpacing: 0.5,
  },
  gridValor: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },
  listaCard: {
    marginHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    ...BORDERS.thin,
    ...SHADOWS.card,
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
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    ...SHADOWS.card,
  },
  botonCerrar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm + 4,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.xl,
    height: 56,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.errorContainer,
    backgroundColor: COLORS.surfaceContainerLowest,
    ...SHADOWS.card,
  },
  botonPresionado: {
    opacity: 0.8,
  },
  botonCerrarTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.error,
    letterSpacing: 0.8,
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
