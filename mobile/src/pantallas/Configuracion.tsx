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

type EstadoPerfil =
  | { tipo: 'cargando' }
  | { tipo: 'sin-operario' }
  | { tipo: 'asignando' }
  | { tipo: 'operario'; operario: Operario }
  | { tipo: 'error'; mensaje: string };

/**
 * Pantalla de configuración — menú de acciones directas + perfil del operario.
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

      // Buscar en repo local primero (funciona sin red)
      const bootstrap = await getBootstrap();
      const repo = crearOperarioRepositoryExpoSqlite(bootstrap.db);
      await repo.inicializar();
      const operarioLocal = await repo.buscarPorDispositivoId(deviceId);

      if (operarioLocal) {
        setPerfil({ tipo: 'operario', operario: operarioLocal });
        return;
      }

      // Sin datos locales → buscar en backend por cédula (ya fue vinculado previamente)
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
            // Cachear en SQLite para próximas cargas sin red
            await repo.guardar(operario);
            setPerfil({ tipo: 'operario', operario });
            return;
          }
        }
      } catch {
        // Sin red: mostramos sin-operario para que pueda reintentar
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
        return;
      }

      if (resp.status === 409) {
        Alert.alert('Dispositivo ocupado', 'Este dispositivo ya está vinculado a otro operario. Contactá al administrador.');
        return;
      }

      if (!resp.ok) {
        Alert.alert('Error', `No se pudo asignar el operario (${resp.status}).`);
        return;
      }

      const operario = (await resp.json()) as Operario;

      // Guardar cédula localmente para futuras cargas
      await AsyncStorage.setItem(CLAVE_CEDULA, cedula.trim());

      // Persistir operario en SQLite para que funcione sin red
      const bootstrap = await getBootstrap();
      const repo = crearOperarioRepositoryExpoSqlite(bootstrap.db);
      await repo.inicializar();
      await repo.guardar(operario);

      // Limpiar formulario
      setCedula('');
      setPassword('');

      setPerfil({ tipo: 'operario', operario });
    } catch {
      Alert.alert('Sin conexión', 'No se pudo conectar al servidor. Verificá la red e intentá de nuevo.');
    } finally {
      setAsignando(false);
    }
  }

  async function desasignarOperario(): Promise<void> {
    Alert.alert(
      'Desasignar operario',
      '¿Seguro que querés desasignar este dispositivo? Necesitarás conexión para volver a asignarlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desasignar',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>CONFIGURACIÓN</Text>
      </View>

      {/* Sección: Gestión de suscriptores */}
      <Text style={[TYPOGRAPHY.labelLg, styles.seccionLabel]}>
        GESTIÓN DE SUSCRIPTORES
      </Text>

      <View style={styles.seccion}>
        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => navigation.navigate('AltaSuscriptor')}
        >
          <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Agregar suscriptor</Text>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </Pressable>

        <View style={styles.separador} />

        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => navigation.navigate('ImportarCsv')}
        >
          <MaterialIcons name="upload-file" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Importar desde CSV</Text>
          <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Sección: Sistema */}
      <Text style={[TYPOGRAPHY.labelLg, styles.seccionLabel]}>SISTEMA</Text>

      <View style={styles.seccion}>
        <View style={styles.item}>
          <MaterialIcons name="info" size={24} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemText]}>Versión de la app</Text>
          <Text style={[TYPOGRAPHY.bodyMd, styles.itemValor]}>1.0.0</Text>
        </View>
      </View>


      {/* Sección: Mi perfil */}
      <Text style={[TYPOGRAPHY.labelLg, styles.seccionLabel]}>MI PERFIL</Text>

      <View style={styles.seccion}>
        {/* CARGANDO */}
        {perfil.tipo === 'cargando' && (
          <View style={styles.perfilCargando}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.bodySm, styles.itemValor]}>Cargando perfil…</Text>
          </View>
        )}

        {/* ERROR */}
        {perfil.tipo === 'error' && (
          <View style={styles.item}>
            <MaterialIcons name="error" size={24} color={COLORS.error} />
            <Text style={[TYPOGRAPHY.bodySm, styles.itemValor]} numberOfLines={2}>
              {perfil.mensaje}
            </Text>
          </View>
        )}

        {/* SIN OPERARIO → formulario de asignación */}
        {perfil.tipo === 'sin-operario' && (
          <View style={styles.formulario}>
            <View style={styles.formularioHeader}>
              <MaterialIcons name="person-off" size={24} color={COLORS.textSecondary} />
              <Text style={[TYPOGRAPHY.bodyMd, styles.itemValor]}>
                Sin operario asignado
              </Text>
            </View>

            <Text style={[TYPOGRAPHY.labelMd, styles.inputLabel]}>CÉDULA</Text>
            <TextInput
              style={styles.input}
              placeholder="Número de cédula"
              placeholderTextColor={COLORS.textSecondary}
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
              placeholderTextColor={COLORS.textSecondary}
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
        )}

        {/* CON OPERARIO → datos + botón desasignar */}
        {perfil.tipo === 'operario' && (
          <>
            <View style={styles.perfilFila}>
              <Text style={[TYPOGRAPHY.labelMd, styles.perfilEtiqueta]}>Nombre</Text>
              <Text style={[TYPOGRAPHY.bodyMd, styles.perfilValor]}>
                {perfil.operario.nombre}
              </Text>
            </View>
            <View style={styles.separador} />
            <View style={styles.perfilFila}>
              <Text style={[TYPOGRAPHY.labelMd, styles.perfilEtiqueta]}>Cédula</Text>
              <Text style={[TYPOGRAPHY.bodyMd, styles.perfilValor]}>
                {perfil.operario.numero_cedula}
              </Text>
            </View>
            <View style={styles.separador} />
            <View style={styles.perfilFila}>
              <Text style={[TYPOGRAPHY.labelMd, styles.perfilEtiqueta]}>Rol</Text>
              <Text style={[TYPOGRAPHY.bodyMd, styles.perfilValor]}>
                {perfil.operario.rol}
              </Text>
            </View>
            <View style={styles.separador} />
            <View style={styles.perfilFila}>
              <Text style={[TYPOGRAPHY.labelMd, styles.perfilEtiqueta]}>Estado</Text>
              <Text style={[TYPOGRAPHY.bodyMd, styles.perfilValor]}>
                {perfil.operario.estado}
              </Text>
            </View>
            <View style={styles.separador} />
            <Pressable
              style={({ pressed }) => [styles.botonDesasignar, pressed && styles.botonDesasignarPressed]}
              onPress={desasignarOperario}
            >
              <MaterialIcons name="logout" size={18} color={COLORS.error} />
              <Text style={styles.botonDesasignarTexto}>Desasignar este dispositivo</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  header: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  titulo: {
    color: COLORS.primary,
  },
  seccionLabel: {
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  seccion: {
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.lg,
    ...BORDERS.thin,
    borderRadius: 0,
    backgroundColor: COLORS.background,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.margin,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  itemPressed: {
    backgroundColor: COLORS.surfaceLight,
  },
  itemText: {
    flex: 1,
    color: COLORS.primary,
  },
  itemValor: {
    color: COLORS.textSecondary,
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.margin,
  },
  perfilCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.margin,
    gap: SPACING.md,
  },
  perfilFila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  perfilEtiqueta: {
    width: 72,
    color: COLORS.textSecondary,
  },
  perfilValor: {
    flex: 1,
    color: COLORS.primary,
  },
  // Formulario de asignación
  formulario: {
    padding: SPACING.margin,
    gap: SPACING.sm,
  },
  formularioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.primary,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
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
  botonAsignarPressed: {
    opacity: 0.8,
  },
  botonAsignarDisabled: {
    opacity: 0.5,
  },
  botonAsignarTexto: {
    color: COLORS.background,
    ...(TYPOGRAPHY.labelMd as object),
  },
  botonDesasignar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
  },
  botonDesasignarPressed: {
    backgroundColor: COLORS.surfaceLight,
  },
  botonDesasignarTexto: {
    color: COLORS.error,
    ...(TYPOGRAPHY.bodySm as object),
  },
});
