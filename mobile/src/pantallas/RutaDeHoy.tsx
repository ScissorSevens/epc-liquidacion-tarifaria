import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { useNetInfo } from '../hooks/useNetInfo';
import type { InicioStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = InicioStackScreenProps<'RutaDeHoy'>;

/**
 * Pantalla INICIO — muestra la ruta de lecturas del día.
 *
 * Carga suscriptores y calcula el progreso de lecturas capturadas hoy.
 * El banner offline es SIEMPRE visible porque useNetInfo() usa un shim
 * que retorna { isConnected: false } — comportamiento intencional para
 * el flujo offline-first de AquaRuta. Ver src/hooks/useNetInfo.ts.
 */
export default function RutaDeHoy({ navigation }: Props) {
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [capturasHoy, setCapturasHoy] = useState(0);
  const [pendientesCola, setPendientesCola] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recargando, setRecargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturadosHoy, setCapturadosHoy] = useState<Map<number, boolean>>(new Map());

  const { isConnected } = useNetInfo();

  const cargar = useCallback(async (esPrimeraCarga = false) => {
    if (esPrimeraCarga) {
      setLoading(true);
    } else {
      setRecargando(true);
    }
    setError(null);
    try {
      const bootstrap = await getBootstrap();
      const [listaSuscriptores, todasLecturas, itemsCola, todosMedidores] = await Promise.all([
        bootstrap.suscriptorRepo.listar(),
        bootstrap.lecturaRepo.listar(),
        bootstrap.colaRepo.listar(),
        bootstrap.medidorRepo.listar(),
      ]);

      // Contar lecturas capturadas hoy (comparar fecha ISO-8601 con fecha local)
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const idsConLecturaHoy = new Set(
        todasLecturas
          .filter((l) => l.timestamp_captura.slice(0, 10) === hoy)
          .map((l) => l.id_medidor),
      );

      // Mapa: id_suscriptor → id_medidor[]
      const medsPorSusc = (todosMedidores as Medidor[]).reduce<Map<number, number[]>>(
        (acc, med) => {
          const lista = acc.get(med.id_suscriptor) ?? [];
          lista.push(med.id_medidor);
          acc.set(med.id_suscriptor, lista);
          return acc;
        },
        new Map(),
      );

      // Mapa: id_suscriptor → capturado hoy (OR multi-medidor)
      const capturadosMap = new Map<number, boolean>(
        listaSuscriptores.map((s) => {
          const meds = medsPorSusc.get(s.id_suscriptor) ?? [];
          return [s.id_suscriptor, meds.some((id) => idsConLecturaHoy.has(id))];
        }),
      );

      // Contar items PENDIENTE en cola para el botón sticky
      const pendientes = itemsCola.filter((i) => i.estado === 'PENDIENTE').length;

      setSuscriptores(listaSuscriptores);
      setCapturasHoy(idsConLecturaHoy.size);
      setPendientesCola(pendientes);
      setCapturadosHoy(capturadosMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRecargando(false);
    }
  }, []);

  // Primera carga al montar
  useEffect(() => { void cargar(true); }, [cargar]);
  // Re-carga silenciosa al enfocar tab
  useFocusEffect(useCallback(() => { void cargar(false); }, [cargar]));

  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>Cargando ruta…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[TYPOGRAPHY.bodyMd, styles.errorText]}>
          Error al cargar: {error}
        </Text>
        <Pressable onPress={() => void cargar()} style={styles.btnRetry}>
          <Text style={[TYPOGRAPHY.labelLg, styles.btnRetryText]}>REINTENTAR</Text>
        </Pressable>
      </View>
    );
  }

  const progreso = suscriptores.length > 0 ? capturasHoy / suscriptores.length : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTexts}>
            <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>RUTA DE HOY</Text>
            <Text style={[TYPOGRAPHY.bodySm, styles.fechaHeader]}>{fechaHoy}</Text>
          </View>
          {recargando ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <MaterialIcons name="account-circle" size={28} color={COLORS.onPrimary} />
          )}
        </View>
      </View>

      <FlatList
        data={suscriptores}
        keyExtractor={(item) => String(item.id_suscriptor)}
        contentContainerStyle={
          suscriptores.length === 0 ? styles.listaVaciaContainer : styles.lista
        }
        ListHeaderComponent={
          <>
            {/* Banner offline */}
            {isConnected === false && (
              <View style={styles.banner}>
                <MaterialIcons name="cloud-off" size={20} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.labelLg, styles.bannerText]}>
                  Sin conexión — los datos se guardarán acá
                </Text>
              </View>
            )}

            {/* Progreso */}
            <View style={styles.progresoSection}>
              <View style={styles.progresoRow}>
                <Text style={[TYPOGRAPHY.labelLg]}>Progreso de lectura</Text>
                <Text style={[TYPOGRAPHY.labelLg]}>
                  {capturasHoy} / {suscriptores.length} capturadas
                </Text>
              </View>
              <View style={styles.barraContainer}>
                <View
                  style={[
                    styles.barraFill,
                    { width: `${Math.round(progreso * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[TYPOGRAPHY.bodyMd, styles.muted]}>
              Sin suscriptores cargados
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() =>
              navigation.navigate('Lecturas', {
                screen: 'DetalleSuscriptor',
                params: { id_suscriptor: item.id_suscriptor },
              })
            }
          >
            <View style={styles.cardContent}>
              <View style={styles.cardInfo}>
                <Text style={[TYPOGRAPHY.labelSm, styles.cardCodigo]}>
                  {item.codigo.toUpperCase()}
                </Text>
                <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]}>
                  {item.nombre_apellidos}
                </Text>
                {capturadosHoy.get(item.id_suscriptor) === true ? (
                  <View style={styles.statusRow}>
                    <MaterialIcons name="check-circle" size={14} color={COLORS.primary} />
                    <Text style={[TYPOGRAPHY.labelSm, styles.statusCapturada]}>Capturada hoy</Text>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    <Text style={[TYPOGRAPHY.labelSm, styles.statusPendiente]}>Pendiente</Text>
                  </View>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.primary} />
            </View>
          </Pressable>
        )}
      />

      {/* Botón sticky — solo visible si hay pendientes en cola */}
      {pendientesCola > 0 && (
        <View style={styles.stickyFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.btnSync,
              pressed && styles.btnSyncPressed,
            ]}
            onPress={() => navigation.navigate('Sincronizacion', { screen: 'Sincronizacion' })}
          >
            <MaterialIcons name="sync" size={20} color={COLORS.onPrimary} />
            <Text style={[TYPOGRAPHY.labelLg, styles.btnSyncText]}>
              SINCRONIZAR ({pendientesCola} pendientes)
            </Text>
          </Pressable>
        </View>
      )}

      {/* Footer global */}
      <View style={styles.footer}>
        <Text style={[TYPOGRAPHY.bodySm, styles.footerText]}>AquaRuta — EPC</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.margin,
  },
  header: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  titulo: {
    color: COLORS.onPrimary,
  },
  fechaHeader: {
    color: COLORS.onPrimary,
    opacity: 0.8,
  },
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.errorContainer,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    ...BORDERS.error,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  bannerText: {
    color: COLORS.error,
    flex: 1,
  },
  progresoSection: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  progresoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barraContainer: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  lista: {
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.xl,
  },
  listaVaciaContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.default,
    marginBottom: SPACING.sm,
    ...BORDERS.thin,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  cardInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardCodigo: {
    color: COLORS.textSecondary,
  },
  cardNombre: {
    color: COLORS.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusCapturada: {
    color: COLORS.primary,
  },
  statusPendiente: {
    color: COLORS.textSecondary,
  },
  stickyFooter: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  btnSync: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.default,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 48,
  },
  btnSyncPressed: {
    opacity: 0.7,
  },
  btnSyncText: {
    color: COLORS.onPrimary,
  },
  btnRetry: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
    ...BORDERS.thin,
  },
  btnRetryText: {
    color: COLORS.onPrimary,
  },
  footer: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  footerText: {
    color: COLORS.onBackground,
    opacity: 0.6,
  },
});
