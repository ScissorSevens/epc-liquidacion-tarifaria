import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import { obtenerApiBaseUrl } from '../config/api';
import { getBootstrap } from '../composition/get-bootstrap';
import { limpiarSesion } from '../composition/constantes';
import { obtenerOCrearDeviceId } from '../composition/device-id';
import { useWorkspace } from '../composicion/useWorkspace';
import {
  crearOperarioRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import type { Operario } from '../operarios/types';

type Props = ConfigStackScreenProps<'Configuracion'> & {
  readonly onLogoutRequested: () => void;
};

const CLAVE_CEDULA = 'cedula_operario';

/** Extrae las iniciales del nombre (hasta 2 letras). */
function obtenerIniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

type EstadoPerfil =
  | { tipo: 'cargando' }
  | { tipo: 'no-encontrado' }
  | { tipo: 'operario'; operario: Operario }
  | { tipo: 'error'; mensaje: string };

/**
 * Pantalla de perfil — datos del operario + acciones de gestión.
 */
export default function Configuracion({ navigation, onLogoutRequested }: Props) {
  const [perfil, setPerfil] = useState<EstadoPerfil>({ tipo: 'cargando' });

  const cargarPerfil = useCallback(async () => {
    setPerfil({ tipo: 'cargando' });
    try {
      const cedulaGuardada = await AsyncStorage.getItem(CLAVE_CEDULA);

      const deviceId = await obtenerOCrearDeviceId();

      const bootstrap = await getBootstrap();
      const repo = crearOperarioRepositoryExpoSqlite(bootstrap.db);
      await repo.inicializar();
      const operarioLocal = await repo.buscarPorDispositivoId(deviceId);

      if (operarioLocal) {
        setPerfil({ tipo: 'operario', operario: operarioLocal });
        return;
      }

      try {
        const baseUrl = obtenerApiBaseUrl();
        const resp = await fetch(`${baseUrl}/api/v1/operarios`);
        if (resp.ok) {
          const lista = (await resp.json()) as Array<{
            id: number; idPrestador: number; numeroCedula: string; nombre: string;
            email: string; rol: string; estado: string;
            dispositivoId?: string; createdAt?: string;
          }>;
          const encontrado = lista.find(
            (o) => o.numeroCedula === cedulaGuardada && o.dispositivoId === deviceId,
          );
          if (encontrado) {
            const operario: Operario = {
              id_operario: encontrado.id,
              id_prestador: encontrado.idPrestador,
              numero_cedula: encontrado.numeroCedula,
              nombre: encontrado.nombre,
              email: encontrado.email,
              /**
               * El backend NUNCA devuelve `password_hash` por seguridad — la
               * contraseña se valida en el endpoint de login y nunca viaja
               * en el payload de listado/vinculación. Acá guardamos string
               * vacío como placeholder porque esta pantalla NO autentica:
               * solo muestra el perfil. Si el operario quiere entrar de
               * nuevo con su cédula, el flujo de Login real usa el endpoint
               * dedicado y obtiene un token opaco (no el hash).
               */
              password_hash: '',
              rol: encontrado.rol,
              estado: encontrado.estado,
              dispositivo_id: encontrado.dispositivoId,
              created_at: encontrado.createdAt,
            };
            await repo.guardar(operario);
            setPerfil({ tipo: 'operario', operario });
            return;
          }
        }
      } catch {
        // Sin red
      }

      setPerfil({ tipo: 'no-encontrado' });
    } catch (e) {
      setPerfil({
        tipo: 'error',
        mensaje: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useFocusEffect(useCallback(() => { cargarPerfil(); }, [cargarPerfil]));

  function handleCerrarSesion(): void {
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
            await useWorkspace.getState().limpiarWorkspace();
            setPerfil({ tipo: 'cargando' });
            await onLogoutRequested();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <TopBar titulo="Mi perfil" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Estado: cargando ──────────────────────────────────────── */}
        {perfil.tipo === 'cargando' && (
          <View style={styles.cargandoWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* ── Estado: error ─────────────────────────────────────────── */}
        {perfil.tipo === 'error' && (
          <View style={styles.errorWrap}>
            <MaterialIcons name="error-outline" size={32} color={COLORS.error} />
            <Text style={[TYPOGRAPHY.bodyMd, styles.errorTexto]}>{perfil.mensaje}</Text>
            <Pressable style={styles.botonReintentar} onPress={cargarPerfil}>
              <Text style={styles.botonReintentarTexto}>REINTENTAR</Text>
            </Pressable>
          </View>
        )}

        {/* ── Fallback defensivo: la vinculación ocurre antes de Mi Perfil ── */}
        {perfil.tipo === 'no-encontrado' && (
          <View style={styles.cargandoWrap}>
            <Text style={[TYPOGRAPHY.bodyMd, styles.cargandoTexto]}>
              Cargando perfil...
            </Text>
          </View>
        )}

        {/* ── Estado: con operario ──────────────────────────────────── */}
        {perfil.tipo === 'operario' && (
          <>
            {/* Avatar + nombre + rol */}
            <View style={styles.perfilHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarIniciales}>
                  {obtenerIniciales(perfil.operario.nombre)}
                </Text>
              </View>
              <Text style={[TYPOGRAPHY.headlineMd, styles.perfilNombre]}>
                {perfil.operario.nombre}
              </Text>
              <Text style={[TYPOGRAPHY.bodySm, styles.perfilRol]}>
                {perfil.operario.rol} · EPC
              </Text>
            </View>

            {/* Información personal */}
            <Text style={[TYPOGRAPHY.labelMd, styles.seccionLabel]}>
              Información personal
            </Text>
            <View style={styles.tarjeta}>
              <View style={styles.filaInfo}>
                <Text style={[TYPOGRAPHY.bodySm, styles.filaEtiqueta]}>Cédula</Text>
                <Text style={[TYPOGRAPHY.bodyMd, styles.filaValor]}>
                  {perfil.operario.numero_cedula}
                </Text>
              </View>
              <View style={styles.separador} />
              <View style={styles.filaInfo}>
                <Text style={[TYPOGRAPHY.bodySm, styles.filaEtiqueta]}>Correo</Text>
                <Text style={[TYPOGRAPHY.bodyMd, styles.filaValor]} numberOfLines={1}>
                  {perfil.operario.email}
                </Text>
              </View>
              <View style={styles.separador} />
              <View style={styles.filaInfo}>
                <Text style={[TYPOGRAPHY.bodySm, styles.filaEtiqueta]}>Estado</Text>
                <Text style={[TYPOGRAPHY.bodyMd, styles.filaValor]}>
                  {perfil.operario.estado}
                </Text>
              </View>
            </View>

            {/* Gestión */}
            <Text style={[TYPOGRAPHY.labelMd, styles.seccionLabel]}>
              Gestión
            </Text>
            <View style={styles.tarjeta}>
              <Pressable
                style={({ pressed }) => [styles.itemMenu, pressed && styles.itemMenuPressed]}
                onPress={() => navigation.navigate('AltaSuscriptor')}
              >
                <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.bodyMd, styles.itemMenuTexto]}>Agregar suscriptor</Text>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
              </Pressable>
              <View style={styles.separador} />
              <Pressable
                style={({ pressed }) => [styles.itemMenu, pressed && styles.itemMenuPressed]}
                onPress={() => navigation.navigate('ImportarCsv')}
              >
                <MaterialIcons name="upload-file" size={24} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.bodyMd, styles.itemMenuTexto]}>Importar desde CSV</Text>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
              </Pressable>
              <View style={styles.separador} />
              <View style={styles.itemMenu}>
                <MaterialIcons name="info" size={24} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.bodyMd, styles.itemMenuTexto]}>Versión</Text>
                <Text style={[TYPOGRAPHY.bodyMd, styles.itemMenuValor]}>1.0.0</Text>
              </View>
              <View style={styles.separador} />
              <Pressable
                style={({ pressed }) => [styles.itemMenu, pressed && styles.itemMenuPressed]}
                onPress={handleCerrarSesion}
              >
                <MaterialIcons name="logout" size={24} color={COLORS.error} />
                <Text style={[TYPOGRAPHY.bodyMd, styles.itemMenuTexto, { color: COLORS.error }]}>Cerrar sesión</Text>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
              </Pressable>
            </View>
          </>
        )}

        <FooterApp />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // ── Cargando / error ────────────────────────────────────────────────
  cargandoWrap: {
    paddingVertical: SPACING.xl * 2,
    alignItems: 'center',
  },
  cargandoTexto: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorWrap: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.xl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  errorTexto: {
    color: COLORS.error,
    textAlign: 'center',
  },
  botonReintentar: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  botonReintentarTexto: {
    color: COLORS.primary,
    ...(TYPOGRAPHY.labelMd as object),
  },

  // ── Perfil con operario ─────────────────────────────────────────────
  perfilHeader: {
    alignItems: 'center',
    paddingHorizontal: SPACING.margin,
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarIniciales: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  perfilNombre: {
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  perfilRol: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── Secciones ───────────────────────────────────────────────────────
  seccionLabel: {
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  tarjeta: {
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.lg,
    ...BORDERS.thin,
    backgroundColor: COLORS.background,
    borderRadius: 0,
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginHorizontal: SPACING.margin,
    opacity: 0.3,
  },
  filaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.sm,
  },
  filaEtiqueta: {
    color: COLORS.textSecondary,
  },
  filaValor: {
    color: COLORS.primary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: SPACING.md,
  },
  itemMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.margin,
    gap: SPACING.md,
  },
  itemMenuPressed: {
    backgroundColor: COLORS.surfaceLight,
  },
  itemMenuTexto: {
    flex: 1,
    color: COLORS.primary,
  },
  itemMenuValor: {
    color: COLORS.textSecondary,
  },
});
