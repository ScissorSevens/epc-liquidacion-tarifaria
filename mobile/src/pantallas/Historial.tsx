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

import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import type { LecturasStackScreenProps } from '../navegacion/types';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type Props = LecturasStackScreenProps<'Historial'>;

function badgeSyncColor(estado: string): { bg: string; text: string } {
  switch (estado) {
    case 'sincronizado':
      return { bg: COLORS.primaryContainer, text: COLORS.onPrimaryContainer };
    case 'error':
      return { bg: COLORS.errorContainer, text: COLORS.onErrorContainer };
    default:
      return { bg: COLORS.secondary, text: COLORS.onPrimary };
  }
}

/**
 * Pantalla de historial completo de lecturas de un suscriptor.
 *
 * - Carga los medidores del suscriptor y luego todas sus lecturas.
 * - Agrupa las lecturas por medidor, ordenadas por fecha descendente.
 * - Solo lectura — no permite editar ni capturar.
 */
export default function Historial({ navigation, route }: Props) {
  const { id_suscriptor, nombre } = route.params;

  const [medidores, setMedidores] = useState<Medidor[]>([]);
  const [lecturasPorMedidor, setLecturasPorMedidor] = useState<Map<number, Lectura[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { medidorRepo, lecturaRepo } = await getBootstrap();
      const lista = await medidorRepo.listarPorSuscriptor(id_suscriptor);
      setMedidores(lista);

      const mapa = new Map<number, Lectura[]>();
      await Promise.all(
        lista.map(async (m) => {
          const lecturas = await lecturaRepo.listarPorMedidor(m.id_medidor);
          // Orden descendente por timestamp
          const ordenadas = [...lecturas].sort(
            (a, b) =>
              new Date(b.timestamp_captura).getTime() -
              new Date(a.timestamp_captura).getTime(),
          );
          mapa.set(m.id_medidor, ordenadas);
        }),
      );
      setLecturasPorMedidor(mapa);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Historial] error al cargar:', e);
      setError('No se pudo cargar el historial. Intentar de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [id_suscriptor]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totalLecturas = [...lecturasPorMedidor.values()].reduce(
    (acc, l) => acc + l.length,
    0,
  );

  return (
    <View style={styles.raiz}>
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarIzq}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
          </Pressable>
          <View>
            <Text style={styles.topBarTitulo}>HISTORIAL</Text>
            <Text style={styles.topBarSub} numberOfLines={1}>{nombre}</Text>
          </View>
        </View>
        <MaterialIcons name="history" size={24} color={COLORS.primary} />
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.cargandoTexto}>Cargando historial…</Text>
        </View>
      ) : error ? (
        <View style={styles.centrado}>
          <MaterialIcons name="error-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorTexto}>{error}</Text>
          <Pressable
            onPress={() => void cargar()}
            style={({ pressed }) => [styles.btnReintentar, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnReintentarTexto}>REINTENTAR</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Resumen */}
          <View style={styles.resumenCard}>
            <View style={styles.resumenItem}>
              <Text style={styles.resumenValor}>{medidores.length}</Text>
              <Text style={styles.resumenEtiqueta}>MEDIDORES</Text>
            </View>
            <View style={styles.resumenDivider} />
            <View style={styles.resumenItem}>
              <Text style={styles.resumenValor}>{totalLecturas}</Text>
              <Text style={styles.resumenEtiqueta}>LECTURAS</Text>
            </View>
          </View>

          {medidores.length === 0 ? (
            <View style={styles.vacio}>
              <MaterialIcons name="sensors-off" size={40} color={COLORS.onSurfaceVariant} />
              <Text style={styles.vacioTexto}>Sin medidores registrados</Text>
            </View>
          ) : (
            medidores.map((m) => {
              const lecturas = lecturasPorMedidor.get(m.id_medidor) ?? [];
              return (
                <View key={m.id_medidor} style={styles.medidorCard}>
                  {/* Cabecera medidor */}
                  <View style={styles.medidorHeader}>
                    <View style={styles.medidorHeaderIzq}>
                      <MaterialIcons name="speed" size={18} color={COLORS.secondary} />
                      <Text style={styles.medidorNumero}>N° {m.numero_medidor}</Text>
                    </View>
                    <View style={styles.badgeCantidad}>
                      <Text style={styles.badgeCantidadTexto}>
                        {lecturas.length} lectura{lecturas.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  {lecturas.length === 0 ? (
                    <View style={styles.sinLecturas}>
                      <Text style={styles.sinLecturasTexto}>Sin lecturas registradas</Text>
                    </View>
                  ) : (
                    lecturas.map((l, idx) => (
                      <View
                        key={l.id_lectura}
                        style={[
                          styles.filaLectura,
                          idx < lecturas.length - 1 && styles.filaLecturaBorde,
                        ]}
                      >
                        <View style={styles.filaLecturaIzq}>
                          <Text style={styles.filaPeriodo}>{l.id_periodo}</Text>
                          <Text style={styles.filaFecha}>
                            {new Date(l.timestamp_captura).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                        <View style={styles.filaLecturaDer}>
                          <Text style={styles.filaValor}>{l.lectura_actual} m³</Text>
                          <View
                            style={[
                              styles.badgeSync,
                              { backgroundColor: badgeSyncColor(l.estado_sync).bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeSyncTexto,
                                { color: badgeSyncColor(l.estado_sync).text },
                              ]}
                            >
                              {l.estado_sync.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })
          )}

          <FooterApp />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  topBarIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  topBarTitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  topBarSub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    maxWidth: 220,
  },

  // Estados
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.margin,
  },
  cargandoTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  errorTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.error,
    textAlign: 'center',
  },
  btnReintentar: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: RADIUS.lg,
  },
  btnReintentarTexto: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    letterSpacing: 0.8,
  },

  // Scroll
  scroll: {
    padding: SPACING.margin,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },

  // Resumen
  resumenCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  resumenItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  resumenValor: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.primary,
  },
  resumenEtiqueta: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  resumenDivider: {
    width: 1,
    backgroundColor: COLORS.outlineVariant,
    marginVertical: SPACING.md,
  },

  // Vacío
  vacio: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  vacioTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },

  // Card por medidor
  medidorCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  medidorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  medidorHeaderIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  medidorNumero: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  badgeCantidad: {
    backgroundColor: COLORS.surfaceVariant,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeCantidadTexto: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
  },

  // Sin lecturas
  sinLecturas: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  sinLecturasTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },

  // Filas de lectura
  filaLectura: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  filaLecturaBorde: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  filaLecturaIzq: {
    gap: 2,
  },
  filaPeriodo: {
    ...TYPOGRAPHY.bodyMd,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filaFecha: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
  },
  filaLecturaDer: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  filaValor: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },
  badgeSync: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeSyncTexto: {
    ...TYPOGRAPHY.labelSm,
    letterSpacing: 0.4,
  },
});
