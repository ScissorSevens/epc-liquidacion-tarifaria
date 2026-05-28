import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
import { FooterApp } from '../componentes/FooterApp';

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
  const porcentaje = Math.round(progreso * 100);

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.onPrimary} />
          </Pressable>
          <Text style={[TYPOGRAPHY.headlineSm, styles.topBarTitle]}>Ruta de hoy</Text>
        </View>
        <View style={styles.topBarRight}>
          {/* Icono sync con badge de pendientes */}
          <View style={styles.badgeWrapper}>
            {recargando ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} style={styles.topBarBtn} />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
                onPress={() => navigation.navigate('Sincronizacion', { screen: 'Sincronizacion' })}
              >
                <MaterialIcons name="cloud-sync" size={24} color={COLORS.onPrimary} />
              </Pressable>
            )}
            {pendientesCola > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendientesCola}</Text>
              </View>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
            onPress={() => navigation.navigate('Lecturas', { screen: 'MiPerfil' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.onPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner offline */}
        {isConnected === false && (
          <View style={styles.banner}>
            <MaterialIcons name="cloud-off" size={20} color={COLORS.error} />
            <Text style={[TYPOGRAPHY.bodySm, styles.bannerText]}>
              Sin conexión — los datos se guardarán localmente
            </Text>
          </View>
        )}

        {/* Sección de progreso */}
        <View style={styles.progresoCard}>
          <View style={styles.progresoRow}>
            <Text style={[TYPOGRAPHY.labelLg, styles.progresoLabel]}>PROGRESO DE LECTURA</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.progresoNumero]}>
              {capturasHoy}{' '}
              <Text style={[TYPOGRAPHY.bodySm, styles.progresoTotal]}>/ {suscriptores.length}</Text>
            </Text>
          </View>
          <View style={styles.barraContainer}>
            <View style={[styles.barraFill, { width: `${porcentaje}%` as `${number}%` }]} />
          </View>
        </View>

        {/* Lista de suscriptores (un solo grupo sin sector en datos reales) */}
        {suscriptores.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[TYPOGRAPHY.bodyMd, styles.muted]}>Sin suscriptores cargados</Text>
          </View>
        ) : (
          <View style={styles.grupo}>
            <View style={styles.grupoHeader}>
              <Text style={[TYPOGRAPHY.labelLg, styles.grupoTitulo]}>
                Suscriptores asignados
              </Text>
              <View style={styles.grupoDivisor} />
            </View>

            {suscriptores.map((item) => {
              const capturado = capturadosHoy.get(item.id_suscriptor) === true;
              return (
                <Pressable
                  key={item.id_suscriptor}
                  style={({ pressed }) => [
                    styles.card,
                    capturado && styles.cardCapturada,
                    pressed && !capturado && styles.cardPressed,
                  ]}
                  onPress={() =>
                    navigation.navigate('Lecturas', {
                      screen: 'DetalleSuscriptor',
                      params: { id_suscriptor: item.id_suscriptor },
                    })
                  }
                  disabled={capturado}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardInfo}>
                      {/* ID */}
                      <Text style={[TYPOGRAPHY.labelSm, styles.cardCodigo]}>
                        ID: {item.codigo.toUpperCase()}
                      </Text>
                      {/* Nombre */}
                      <Text
                        style={[
                          TYPOGRAPHY.headlineSm,
                          capturado ? styles.cardNombreCapturado : styles.cardNombre,
                        ]}
                      >
                        {item.nombre_apellidos}
                      </Text>
                      {/* Estado */}
                      {capturado ? (
                        <View style={styles.statusRow}>
                          <MaterialIcons name="check-circle" size={14} color={COLORS.secondary} />
                          <Text style={[TYPOGRAPHY.labelSm, styles.statusCapturada]}>
                            Capturado hoy
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.statusRow}>
                          <MaterialIcons name="schedule" size={14} color={COLORS.onSurfaceVariant} />
                          <Text style={[TYPOGRAPHY.labelSm, styles.statusPendiente]}>
                            Lectura pendiente
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Icono derecho */}
                    {capturado ? (
                      <View style={styles.iconCircleCheck}>
                        <MaterialIcons name="task-alt" size={22} color={COLORS.secondary} />
                      </View>
                    ) : (
                      <MaterialIcons name="chevron-right" size={24} color={COLORS.onSurfaceVariant} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <FooterApp />
      </ScrollView>

      {/* Botón sticky — siempre visible (wireframe lo muestra siempre) */}
      <View style={styles.stickyFooter}>
        <Pressable
          style={({ pressed }) => [styles.btnSync, pressed && styles.btnSyncPressed]}
          onPress={() => navigation.navigate('Sincronizacion', { screen: 'Sincronizacion' })}
        >
          <MaterialIcons name="sync" size={22} color={COLORS.onPrimary} />
          <Text style={[TYPOGRAPHY.headlineSm, styles.btnSyncText]}>Sincronizar</Text>
          {pendientesCola > 0 && (
            <View style={styles.btnBadge}>
              <Text style={styles.btnBadgeText}>({pendientesCola})</Text>
            </View>
          )}
        </Pressable>
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
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // ── TopAppBar ─────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  topBarBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  topBarTitle: {
    color: COLORS.onPrimary,
  },
  badgeWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  badgeText: {
    color: COLORS.onPrimary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },

  // ── ScrollView ────────────────────────────────────────────────────────────
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl * 3, // espacio para el sticky + footer nav
    paddingHorizontal: SPACING.md,
    gap: SPACING.lg,
  },

  // ── Banner offline ────────────────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.errorContainer,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(186,26,26,0.1)',
  },
  bannerText: {
    color: COLORS.onErrorContainer,
    flex: 1,
    fontWeight: '500',
  },

  // ── Progreso ──────────────────────────────────────────────────────────────
  progresoCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(197,198,206,0.3)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  progresoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progresoLabel: {
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progresoNumero: {
    color: COLORS.primary,
  },
  progresoTotal: {
    color: COLORS.onSurfaceVariant,
    fontWeight: '400',
  },
  barraContainer: {
    height: 12,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
  },

  // ── Grupo / Sector ────────────────────────────────────────────────────────
  grupo: {
    gap: SPACING.sm,
  },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  grupoTitulo: {
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  grupoDivisor: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surfaceDim,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(197,198,206,0.2)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  cardCapturada: {
    backgroundColor: 'rgba(211,228,254,0.3)',
    borderColor: 'rgba(197,198,206,0.1)',
    opacity: 0.8,
  },
  cardPressed: {
    backgroundColor: COLORS.surfaceContainer,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  cardInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardCodigo: {
    color: COLORS.secondary,
    letterSpacing: -0.5,
  },
  cardNombre: {
    color: COLORS.onSurface,
  },
  cardNombreCapturado: {
    color: COLORS.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusCapturada: {
    color: COLORS.secondary,
    fontWeight: '500',
  },
  statusPendiente: {
    color: COLORS.onSurfaceVariant,
  },
  iconCircleCheck: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,103,127,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },

  // ── Sticky footer ─────────────────────────────────────────────────────────
  stickyFooter: {
    position: 'absolute',
    bottom: 72, // sobre el BottomNav
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 40,
  },
  btnSync: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  btnSyncPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  btnSyncText: {
    color: COLORS.onPrimary,
  },
  btnBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  btnBadgeText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Error / Retry ─────────────────────────────────────────────────────────
  btnRetry: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
  },
  btnRetryText: {
    color: COLORS.onPrimary,
  },
});
