import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
 * el flujo offline-first de MediApp. Ver src/hooks/useNetInfo.ts.
 */
export default function RutaDeHoy({ navigation }: Props) {
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [capturasHoy, setCapturasHoy] = useState(0);
  const [pendientesCola, setPendientesCola] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useNetInfo();

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bootstrap = await getBootstrap();
      const [listaSuscriptores, todasLecturas, itemsCola] = await Promise.all([
        bootstrap.suscriptorRepo.listar(),
        bootstrap.lecturaRepo.listar(),
        bootstrap.colaRepo.listar(),
      ]);

      // Contar lecturas capturadas hoy (comparar fecha ISO-8601 con fecha local)
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const idsConLecturaHoy = new Set(
        todasLecturas
          .filter((l) => l.timestamp_captura.slice(0, 10) === hoy)
          .map((l) => l.id_medidor),
      );

      // Contar items PENDIENTE en cola para el botón sticky
      const pendientes = itemsCola.filter((i) => i.estado === 'PENDIENTE').length;

      setSuscriptores(listaSuscriptores);
      setCapturasHoy(idsConLecturaHoy.size);
      setPendientesCola(pendientes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>RUTA DE HOY</Text>
        <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>
          {capturasHoy} / {suscriptores.length} capturadas hoy
        </Text>
      </View>

      {/* Banner offline — siempre visible (useNetInfo shim retorna false) */}
      {isConnected === false && (
        <View style={styles.banner}>
          <Text style={[TYPOGRAPHY.bodySm, styles.bannerText]}>
            Sin conexión — los datos se guardarán localmente
          </Text>
        </View>
      )}

      {/* Lista de suscriptores */}
      <FlatList
        data={suscriptores}
        keyExtractor={(item) => String(item.id_suscriptor)}
        contentContainerStyle={
          suscriptores.length === 0 ? styles.listaVaciaContainer : styles.lista
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
                <Text style={[TYPOGRAPHY.labelLg, styles.cardCodigo]}>
                  {item.codigo}
                </Text>
                <Text style={[TYPOGRAPHY.bodyMd]}>{item.nombre_apellidos}</Text>
                {item.direccion !== '' && (
                  <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>
                    {item.direccion} · Estrato {item.estrato}
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
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
            <Text style={[TYPOGRAPHY.labelLg, styles.btnSyncText]}>
              SINCRONIZAR ({pendientesCola} pendientes)
            </Text>
          </Pressable>
        </View>
      )}
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
  },
  titulo: {
    color: COLORS.primary,
    marginBottom: SPACING.xs,
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
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.margin,
    ...BORDERS.thin,
    marginHorizontal: SPACING.margin,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  bannerText: {
    color: COLORS.textSecondary,
  },
  lista: {
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.xl,
  },
  listaVaciaContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.background,
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
    paddingHorizontal: SPACING.gutter,
  },
  cardInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardCodigo: {
    color: COLORS.primary,
  },
  chevron: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  stickyFooter: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  btnSync: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.default,
    ...BORDERS.thin,
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
});
