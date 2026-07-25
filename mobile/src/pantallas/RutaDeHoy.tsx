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
import type { InicioStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import { useWorkspace } from '../composicion/useWorkspace';

type Props = InicioStackScreenProps<'RutaDeHoy'>;

/**
 * Pantalla INICIO — muestra la ruta de lecturas del día.
 *
 * Identidad del prestador (Opción A + B):
 *   - TopBar recibe el nombre del prestador activo como subtitulo.
 *   - Banner de identidad con NIT, segmento, total suscriptores y %
 *     capturado del mes — acerca al operario al prestador con el que
 *     trabaja (no una lista genérica de "suscriptores").
 *
 * Banner de conectividad removido temporalmente. La funcionalidad de
 * sync se deshabilita por ahora (2026-07-25).
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

  // PER-05: selectores específicos en useWorkspace. Cambios en otros
  // campos (acuerdo_vigente, parametros_vigentes, cargando) NO disparan
  // re-render de RutaDeHoy.
  const prestador = useWorkspace((s) => s.prestador);

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

      // Contar lecturas capturadas en el mes actual (YYYY-MM)
      const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
      const idsConLecturaHoy = new Set(
        todasLecturas
          .filter((l) => l.timestamp_captura.slice(0, 7) === mesActual)
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
        navigation.navigate('CapturarLectura', {
          id_medidor: medidores[0].id_medidor, id_suscriptor: item.id_suscriptor,
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
          <Text style={[TYPOGRAPHY.labelLg, styles.btnRetryText]}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const progreso = suscriptores.length > 0 ? capturasHoy / suscriptores.length : 0;
  const porcentaje = Math.round(progreso * 100);

  // ── Identidad del prestador (TopBar subtitulo + banner) ──────────────────
  // El TopBar recibe el nombre del prestador (Opción A):
  //   titulo:    "Ruta de hoy" — el identificador de la pantalla, estable.
  //   subtitulo: "Acueducto La Esperanza · Fusagasugá" — contexto del
  //              prestador activo, cambia con el workspace.
  // El banner muestra NIT, segmento, total suscriptores y % (Opción B).
  const prestadorNombre = prestador?.nombre ?? 'Prestador sin nombre';
  const prestadorSubtitulo = prestador
    ? `${prestador.nombre} · ${prestador.municipio}`
    : 'Sin prestador activo';

  // Total suscriptores = urbanos + rurales (lo que el prestador declara).
  const totalSuscriptoresPrestador = prestador
    ? prestador.num_suscriptores_urbanos + prestador.num_suscriptores_rurales
    : 0;

  return (
    <View style={styles.container}>
      {/* TopAppBar — Opción A: nombre del prestador como subtitulo */}
      <TopBar
        titulo="Ruta de hoy"
        subtitulo={prestadorSubtitulo}
        accionDerecha={
          <Pressable
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.topBarBtnPressed]}
            onPress={() => navigation.navigate('Config', { screen: 'Configuracion' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.onPrimary} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner de identidad del prestador (Opción B) — reemplaza al
            banner de conectividad, removido temporalmente. La
            funcionalidad de sync se deshabilita por ahora (2026-07-25). */}
        {prestador && (
          <View
            style={styles.identidadCard}
            accessibilityRole="summary"
            accessibilityLabel={`Prestador ${prestadorNombre}, NIT ${prestador.nit}, segmento ${prestador.segmento}, ${totalSuscriptoresPrestador} suscriptores, ${porcentaje} porciento capturado del mes`}
          >
            {/* Fila 1: nombre del prestador (headline) */}
            <View style={styles.identidadHeader}>
              <MaterialIcons
                name="business"
                size={22}
                color={COLORS.primary}
              />
              <Text
                style={styles.identidadNombre}
                numberOfLines={1}
              >
                {prestadorNombre}
              </Text>
            </View>

            {/* Fila 2: NIT · Segmento (label) */}
            <View style={styles.identidadMeta}>
              <MaterialIcons
                name="label-outline"
                size={14}
                color={COLORS.onSurfaceVariant}
              />
              <Text style={styles.identidadMetaTexto}>
                NIT {prestador.nit} · Segmento {prestador.segmento}{' '}
                {prestador.segmento === 1 ? 'urbano' : 'rural'}
              </Text>
            </View>

            {/* Fila 3: total suscriptores (stat) + barra de progreso (%) */}
            <View style={styles.identidadStats}>
              <View style={styles.identidadStat}>
                <MaterialIcons
                  name="people"
                  size={18}
                  color={COLORS.secondary}
                />
                <Text style={styles.identidadStatNumero}>
                  {totalSuscriptoresPrestador}
                </Text>
                <Text style={styles.identidadStatLabel}>
                  suscriptores
                </Text>
              </View>
              <View style={styles.identidadProgreso}>
                <View style={styles.identidadBarraContainer}>
                  <View
                    style={[
                      styles.identidadBarraFill,
                      { width: `${porcentaje}%` as `${number}%` },
                    ]}
                  />
                </View>
                <Text style={styles.identidadProcentaje}>
                  {porcentaje}% lecturas del mes
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Sección de progreso */}
        <View style={styles.progresoCard}>
          <View style={styles.progresoRow}>
            <Text style={[TYPOGRAPHY.labelLg, styles.progresoLabel]}>Lecturas del mes</Text>
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
                            Capturado este mes
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
                    navigation.navigate('CapturarLectura', {
                        id_medidor: med.id_medidor,
                        id_suscriptor: suscriptorSelector.id,
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
              <Text style={styles.btnCancelarTexto}>Cancelar</Text>
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

  // ── Banner de identidad del prestador (Opción B) ─────────────────────────
  // Reemplaza al banner de conectividad (removido temporalmente — sync
  // deshabilitado 2026-07-25).
  //
  // Bento-style: una card con 3 stats (nombre / NIT·segmento /
  // total suscriptores + barra de progreso).
  // Sin border+shadow combo (anti-pattern): solo borderWidth 1 con
  // outlineVariant. Border radius 16 (RADIUS.lg, no xl).
  identidadCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  identidadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2, // 6
  },
  identidadNombre: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.onSurface,
    flexShrink: 1,
  },
  identidadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  identidadMetaTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    flexShrink: 1,
  },
  identidadStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  identidadStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  identidadStatNumero: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.secondary,
  },
  identidadStatLabel: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
  },
  identidadProgreso: {
    flex: 1,
    gap: SPACING.xs,
  },
  identidadBarraContainer: {
    height: 8,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  identidadBarraFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
  },
  identidadProcentaje: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
  },

  // ── Progreso ──────────────────────────────────────────────────────────────
  // Sin border+shadow combo: solo border 1 con outlineVariant. Sin
  // elevación ni sombra (anti-pattern ghost-card).
  progresoCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  progresoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progresoLabel: {
    color: COLORS.onSurfaceVariant,
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
    fontWeight: '700',
  },
  grupoDivisor: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surfaceDim,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  // Sin border+shadow combo: solo border 1 con outlineVariant. Sin
  // elevación ni sombra (anti-pattern ghost-card).
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  cardCapturada: {
    backgroundColor: COLORS.surfaceContainerLow,
    opacity: 0.7,
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
  },
});
