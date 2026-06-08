import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  crearOperarioRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import type { Operario } from '../operarios/types';

type Props = ConfigStackScreenProps<'Configuracion'>;

/** Genera un UUID v4 simple sin dependencias externas. */
function generarUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CLAVE_DEVICE_ID = 'device_uuid';
const CLAVE_CEDULA = 'cedula_operario';

async function obtenerOCrearDeviceId(): Promise<string> {
  const existente = await AsyncStorage.getItem(CLAVE_DEVICE_ID);
  if (existente) return existente;
  const nuevo = generarUuid();
  await AsyncStorage.setItem(CLAVE_DEVICE_ID, nuevo);
  return nuevo;
}

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
  | { tipo: 'sin-operario' }
  | { tipo: 'asignando' }
  | { tipo: 'operario'; operario: Operario }
  | { tipo: 'error'; mensaje: string };

/**
 * Pantalla de perfil — datos del operario + acciones de gestión.
 */
export default function Configuracion({ navigation }: Props) {
  const [perfil, setPerfil] = useState<EstadoPerfil>({ tipo: 'cargando' });
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [asignando, setAsignando] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setPerfil({ tipo: 'cargando' });
    try {
      const cedulaGuardada = await AsyncStorage.getItem(CLAVE_CEDULA);
      if (!cedulaGuardada) {
        setPerfil({ tipo: 'sin-operario' });
        return;
      }

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
            id: number; numeroCedula: string; nombre: string;
            email: string; rol: string; estado: string;
            dispositivoId?: string; createdAt?: string;
          }>;
          const encontrado = lista.find(
            (o) => o.numeroCedula === cedulaGuardada && o.dispositivoId === deviceId,
          );
          if (encontrado) {
            const operario: Operario = {
              id_operario: encontrado.id,
              numero_cedula: encontrado.numeroCedula,
              nombre: encontrado.nombre,
              email: encontrado.email,
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

      setPerfil({ tipo: 'sin-operario' });
    } catch (e) {
      setPerfil({
        tipo: 'error',
        mensaje: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useFocusEffect(useCallback(() => { cargarPerfil(); }, [cargarPerfil]));

  async function asignarOperario(): Promise<void> {
    if (!cedula.trim()) {
      Alert.alert('Campo requerido', 'Ingresá tu número de cédula.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Campo requerido', 'Ingresá tu contraseña.');
      return;
    }

    setAsignando(true);

    // ── 1. Llamada al backend ─────────────────────────────────────────────────
    let operario: Operario;
    try {
      const deviceId = await obtenerOCrearDeviceId();
      const baseUrl = obtenerApiBaseUrl();

      const resp = await fetch(`${baseUrl}/api/v1/operarios/vincular-dispositivo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: cedula.trim(),
          password: password.trim(),
          dispositivoId: deviceId,
        }),
      });

      if (resp.status === 401 || resp.status === 404) {
        Alert.alert('Error', 'Cédula o contraseña incorrectos.');
        setAsignando(false);
        return;
      }
      if (resp.status === 409) {
        Alert.alert('Dispositivo ocupado', 'Este dispositivo ya está vinculado a otro operario. Contactá al administrador.');
        setAsignando(false);
        return;
      }
      if (!resp.ok) {
        Alert.alert('Error', `No se pudo asignar el operario (${resp.status}).`);
        setAsignando(false);
        return;
      }

      const raw = (await resp.json()) as {
        id: number; numeroCedula: string; nombre: string;
        email: string; rol: string; estado: string;
        dispositivoId?: string; createdAt?: string;
      };
      operario = {
        id_operario: raw.id,
        numero_cedula: raw.numeroCedula,
        nombre: raw.nombre,
        email: raw.email,
        rol: raw.rol,
        estado: raw.estado,
        dispositivo_id: raw.dispositivoId,
        created_at: raw.createdAt,
      };
    } catch {
      Alert.alert('Sin conexión', 'No se pudo conectar al servidor. Verificá la red e intentá de nuevo.');
      setAsignando(false);
      return;
    }

    // ── 2. Persistencia local ─────────────────────────────────────────────────
    try {
      await AsyncStorage.setItem(CLAVE_CEDULA, cedula.trim());
      const bootstrap = await getBootstrap();
      const repo = crearOperarioRepositoryExpoSqlite(bootstrap.db);
      await repo.inicializar();
      await repo.guardar(operario);

      setCedula('');
      setPassword('');
      setPerfil({ tipo: 'operario', operario });
    } catch {
      // Vinculado en backend pero falló persistencia local — mostramos igual
      setPerfil({ tipo: 'operario', operario });
    } finally {
      setAsignando(false);
    }
  }

  async function desasignarOperario(): Promise<void> {
    Alert.alert(
      'Cambiar de operario',
      '¿Seguro que querés desasignar este dispositivo? Necesitarás conexión para volver a asignarlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(CLAVE_CEDULA);
            setCedula('');
            setPassword('');
            setPerfil({ tipo: 'sin-operario' });
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

        {/* ── Estado: sin operario → formulario de asignación ──────── */}
        {(perfil.tipo === 'sin-operario' || perfil.tipo === 'asignando') && (
          <View style={styles.formularioWrap}>
            {/* Ilustración */}
            <View style={styles.avatarVacio}>
              <MaterialIcons name="person-off" size={40} color={COLORS.outline} />
            </View>
            <Text style={[TYPOGRAPHY.headlineSm, styles.formularioTitulo]}>
              Sin operario asignado
            </Text>
            <Text style={[TYPOGRAPHY.bodySm, styles.formularioSubtitulo]}>
              Ingresá tus credenciales para vincular este dispositivo
            </Text>

            <View style={styles.formularioCampos}>
              <Text style={[TYPOGRAPHY.labelMd, styles.inputLabel]}>CÉDULA</Text>
              <TextInput
                style={styles.input}
                placeholder="Número de cédula"
                placeholderTextColor={COLORS.outline}
                value={cedula}
                onChangeText={setCedula}
                keyboardType="numeric"
                autoCapitalize="none"
                editable={!asignando}
              />

              <Text style={[TYPOGRAPHY.labelMd, styles.inputLabel]}>CONTRASEÑA</Text>
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={COLORS.outline}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!asignando}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.botonAsignar,
                  pressed && styles.botonAsignarPressed,
                  asignando && styles.botonAsignarDisabled,
                ]}
                onPress={asignarOperario}
                disabled={asignando}
              >
                {asignando
                  ? <ActivityIndicator size="small" color={COLORS.background} />
                  : <Text style={styles.botonAsignarTexto}>ASIGNAR OPERARIO</Text>
                }
              </Pressable>
            </View>
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
            </View>

            {/* Danger zone */}
            <Pressable
              style={({ pressed }) => [styles.botonCambiar, pressed && styles.botonCambiarPressed]}
              onPress={desasignarOperario}
            >
              <MaterialIcons name="logout" size={20} color={COLORS.error} />
              <Text style={styles.botonCambiarTexto}>CAMBIAR DE OPERARIO</Text>
            </Pressable>
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

  // ── Formulario sin operario ─────────────────────────────────────────
  formularioWrap: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  avatarVacio: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  formularioTitulo: {
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  formularioSubtitulo: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  formularioCampos: {
    width: '100%',
  },
  inputLabel: {
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.primary,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
    ...(TYPOGRAPHY.bodyMd as object),
  },
  botonAsignar: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    height: 48,
  },
  botonAsignarPressed: { opacity: 0.8 },
  botonAsignarDisabled: { opacity: 0.5 },
  botonAsignarTexto: {
    color: COLORS.background,
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

  // ── Danger zone ─────────────────────────────────────────────────────
  botonCambiar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    height: 52,
    borderWidth: 2,
    borderColor: COLORS.error,
    backgroundColor: COLORS.background,
  },
  botonCambiarPressed: {
    backgroundColor: '#fff0f0',
  },
  botonCambiarTexto: {
    color: COLORS.error,
    ...(TYPOGRAPHY.labelMd as object),
  },
});
