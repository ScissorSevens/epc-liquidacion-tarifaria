import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { TopBar } from '../componentes/TopBar';

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

  // ── Selector de medidor ───────────────────────────────────────────────────
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [medidoresSelector, setMedidoresSelector] = useState<Medidor[]>([]);
  const [suscriptorSelector, setSuscriptorSelector] = useState<{ id: number; nombre: string } | null>(null);

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

  const navegarACapturar = useCallback(async (item: Suscriptor) => {
    try {
      const { medidorRepo } = await getBootstrap();
      const medidores = await medidorRepo.listarPorSuscriptor(item.id_suscriptor);
      if (medidores.length === 0) return;
      if (medidores.length === 1 && medidores[0]) {
        navigation.navigate('Lecturas', {
          screen: 'CapturarLectura',
          params: { id_medidor: medidores[0].id_medidor, id_suscriptor: item.id_suscriptor },
        });
      } else {
        setMedidoresSelector(medidores);
        setSuscriptorSelector({ id: item.id_suscriptor, nombre: item.nombre_apellidos });
        setSelectorVisible(true);
      }
    } catch (e) {
      console.warn('[navegarACapturar] error:', e);
    }
  }, [navigation]);

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
      <TopBar
        titulo="Ruta de hoy"
        accionDerecha={
          <Pressable
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
            onPress={() => navigation.navigate('Lecturas', { screen: 'MiPerfil' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.onPrimary} />
          </Pressable>
        }
      />

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
                  onPress={() => { void navegarACapturar(item); }}
                  disabled={capturado}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardInfo}>
                      {/* ID */}
                      <Text style={[TYPOGRAPHY.labelMd, styles.cardCodigo]}>
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

      {/* ── Modal selector de medidor ─────────────────────────────────────── */}
      <Modal
        visible={selectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectorVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.handleBar} />
            <Text style={styles.sheetTitulo}>Seleccionar medidor</Text>
            {suscriptorSelector && (
              <Text style={styles.sheetSubtitulo}>{suscriptorSelector.nombre}</Text>
            )}
            {medidoresSelector.map((med) => (
              <Pressable
                key={med.id_medidor}
                style={({ pressed }) => [styles.medidorItem, pressed && styles.medidorItemPressed]}
                onPress={() => {
                  setSelectorVisible(false);
                  if (suscriptorSelector) {
                    navigation.navigate('Lecturas', {
                      screen: 'CapturarLectura',
                      params: {
                        id_medidor: med.id_medidor,
                        id_suscriptor: suscriptorSelector.id,
                      },
                    });
                  }
                }}
              >
                <MaterialIcons name="speed" size={20} color={COLORS.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medidorNro}>Medidor #{med.id_medidor}</Text>
                  <Text style={styles.medidorSerie}>{med.numero_medidor}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.onSurfaceVariant} />
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.btnCancelar, pressed && { opacity: 0.6 }]}
              onPress={() => setSelectorVisible(false)}
            >
              <Text style={styles.btnCancelarTexto}>CANCELAR</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  // ── TopAppBar (accionDerecha) ──────────────────────────────────────────────
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  topBarBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
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

  // ── Modal selector de medidor ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.outlineVariant,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  sheetSubtitulo: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    marginBottom: SPACING.lg,
  },
  medidorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: SPACING.sm,
  },
  medidorItemPressed: {
    backgroundColor: COLORS.surfaceContainer,
  },
  medidorNro: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  medidorSerie: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  btnCancelar: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  btnCancelarTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.5,
  },
});
