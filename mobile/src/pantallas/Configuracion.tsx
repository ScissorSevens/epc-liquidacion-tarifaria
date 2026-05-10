import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';
import { Pressable } from 'react-native';
import { obtenerApiBaseUrl } from '../config/api';
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
  | { tipo: 'operario'; operario: Operario }
  | { tipo: 'error'; mensaje: string };

/**
 * Pantalla de configuración — menú de acciones directas + perfil del operario.
 */
export default function Configuracion({ navigation }: Props) {
  const [perfil, setPerfil] = useState<EstadoPerfil>({ tipo: 'cargando' });

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(): Promise<void> {
      try {
        const cedula = await AsyncStorage.getItem('cedula_operario');

        if (!cedula) {
          if (activo) setPerfil({ tipo: 'sin-operario' });
          return;
        }

        const deviceId = await obtenerOCrearDeviceId();

        // Vincular dispositivo en el backend (idempotente)
        let operarioDesdeBackend: Operario | null = null;
        try {
          const baseUrl = obtenerApiBaseUrl();
          const resp = await fetch(`${baseUrl}/api/v1/operarios/vincular-dispositivo`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_cedula: cedula, dispositivo_id: deviceId }),
          });
          if (resp.ok) {
            operarioDesdeBackend = (await resp.json()) as Operario;
          }
        } catch {
          // Sin red: seguimos con el repo local
        }

        // Buscar en repo local
        const db = await SQLite.openDatabaseAsync('mediapp.db');
        const repo = crearOperarioRepositoryExpoSqlite(db);
        await repo.inicializar();
        const operarioLocal = await repo.buscarPorDispositivoId(deviceId);

        if (!activo) return;

        if (operarioLocal) {
          setPerfil({ tipo: 'operario', operario: operarioLocal });
        } else if (operarioDesdeBackend) {
          setPerfil({ tipo: 'operario', operario: operarioDesdeBackend });
        } else {
          // Hay cédula pero no hay datos aún
          setPerfil({ tipo: 'sin-operario' });
        }
      } catch (e) {
        if (activo) {
          setPerfil({
            tipo: 'error',
            mensaje: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    void cargarPerfil();
    return () => {
      activo = false;
    };
  }, []);

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
        {perfil.tipo === 'cargando' && (
          <View style={styles.perfilCargando}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.bodySm, styles.itemValor]}>Cargando perfil…</Text>
          </View>
        )}

        {perfil.tipo === 'sin-operario' && (
          <View style={styles.item}>
            <MaterialIcons name="person-off" size={24} color={COLORS.textSecondary} />
            <Text style={[TYPOGRAPHY.bodyMd, styles.itemValor]}>Sin operario asignado</Text>
          </View>
        )}

        {perfil.tipo === 'error' && (
          <View style={styles.item}>
            <MaterialIcons name="error" size={24} color={COLORS.error ?? '#B00020'} />
            <Text style={[TYPOGRAPHY.bodySm, styles.itemValor]} numberOfLines={2}>
              {perfil.mensaje}
            </Text>
          </View>
        )}

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
});
