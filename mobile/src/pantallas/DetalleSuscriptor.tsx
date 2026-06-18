import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { Medidor } from '@dominio/medidores/types';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import { BORDERS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

// ─── Constantes de historial ────────────────────────────────────────────────

const HISTORIAL_PERIODOS_VISIBLES = 2;

function calcularPeriodos() {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = ahora.getMonth();
  const actual = `${year}-${String(month + 1).padStart(2, '0')}`;
  const prevDate = month === 0 ? new Date(year - 1, 11) : new Date(year, month - 1);
  const anterior = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  return { actual, anterior };
}

// ─── Componente interno: HistorialLecturas ───────────────────────────────────

interface HistorialLecturasProps {
  lecturas: Lectura[];
  periodoActual: string;   // 'YYYY-MM'
  periodoAnterior: string; // 'YYYY-MM'
  loading: boolean;
}

function badgeColorSync(estado: string): { bg: string; text: string } {
  switch (estado) {
    case 'sincronizado':
      return { bg: COLORS.primaryContainer, text: COLORS.onPrimaryContainer };
    case 'error':
      return { bg: COLORS.errorContainer, text: COLORS.onErrorContainer };
    default: // pendiente
      return { bg: COLORS.secondary, text: COLORS.onPrimary };
  }
}

function HistorialLecturas({ lecturas, periodoActual, periodoAnterior, loading }: HistorialLecturasProps) {
  const [expandido, setExpandido] = useState(true);

  const lPeriodos = [periodoActual, periodoAnterior].slice(0, HISTORIAL_PERIODOS_VISIBLES);
  const tieneActual = lecturas.some((l) => l.id_periodo === periodoActual);

  if (loading) {
    return (
      <View style={stylesHistorial.container}>
        <ActivityIndicator size="small" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <View style={stylesHistorial.container}>
      {/* Header con toggle */}
      <Pressable
        onPress={() => setExpandido((v) => !v)}
        style={stylesHistorial.headerRow}
      >
        <View style={stylesHistorial.headerLeft}>
          <Text style={stylesHistorial.titulo}>HISTORIAL</Text>
          {tieneActual && (
            <View style={stylesHistorial.badgeActual}>
              <Text style={stylesHistorial.badgeActualText}>mes actual</Text>
            </View>
          )}
        </View>
        <MaterialIcons
          name={expandido ? 'expand-less' : 'expand-more'}
          size={20}
          color={COLORS.secondary}
        />
      </Pressable>

      {expandido && (
        <View style={stylesHistorial.body}>
          {lPeriodos.map((periodo) => {
            const lectura = lecturas.find((l) => l.id_periodo === periodo);
            return (
              <View key={periodo} style={stylesHistorial.fila}>
                <View style={stylesHistorial.filaDatos}>
                  <Text style={stylesHistorial.filaPeriodo}>{periodo}</Text>
                  {lectura ? (
                    <>
                      <Text style={stylesHistorial.filaValor}>
                        {lectura.lectura_actual} m³
                      </Text>
                      <Text style={stylesHistorial.filaFecha}>
                        {new Date(lectura.timestamp_captura).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </>
                  ) : (
                    <Text style={stylesHistorial.sinRegistro}>Sin registro</Text>
                  )}
                </View>
                {lectura && (
                  <View style={[stylesHistorial.badgeSync, { backgroundColor: badgeColorSync(lectura.estado_sync).bg }]}>
                    <Text style={[stylesHistorial.badgeSyncText, { color: badgeColorSync(lectura.estado_sync).text }]}>
                      {lectura.estado_sync.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const stylesHistorial = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    paddingTop: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  titulo: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.secondary,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  badgeActual: {
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeActualText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSecondaryContainer,
    fontSize: 9,
  },
  body: {
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  filaDatos: {
    flex: 1,
    gap: 2,
  },
  filaPeriodo: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  filaValor: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  filaFecha: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
  },
  sinRegistro: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  badgeSync: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginLeft: SPACING.sm,
  },
  badgeSyncText: {
    ...TYPOGRAPHY.labelSm,
    letterSpacing: 0.5,
  },
});

// ────────────────────────────────────────────────────────────────────────────

type Props = LecturasStackScreenProps<'DetalleSuscriptor'>;

/** Fila label/valor reutilizable dentro de las cards de datos. */
function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.campoValor}>{valor}</Text>
    </View>
  );
}

/**
 * Detalle read-only de un suscriptor + sus medidores asociados.
 *
 * - Carga `suscriptor` y `medidores` en paralelo via Promise.all.
 * - Muestra dos Cards: datos del suscriptor + lista de medidores.
 * - Bottom bar fijo con botón "VOLVER".
 */
export default function DetalleSuscriptor({ navigation, route }: Props) {
  const { id_suscriptor } = route.params;

  const [loading, setLoading] = useState(true);
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);
  const [medidores, setMedidores] = useState<Medidor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardandoSubsidio, setGuardandoSubsidio] = useState(false);
  const [historialMap, setHistorialMap] = useState<Map<number, Lectura[]>>(new Map());
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { suscriptorRepo, medidorRepo } = await getBootstrap();
      const [s, m] = await Promise.all([
        suscriptorRepo.buscarPorId(id_suscriptor),
        medidorRepo.listarPorSuscriptor(id_suscriptor),
      ]);
      setSuscriptor(s);
      setMedidores(m);
      // Cargar historial de lecturas para cada medidor
      void cargarHistorialDeMedidores(m);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DetalleSuscriptor] error al cargar:', e);
      setError('Error al cargar el detalle. Reintentar.');
    } finally {
      setLoading(false);
    }
  }, [id_suscriptor]);

  const cargarHistorial = useCallback(async (idMedidor: number) => {
    try {
      const { lecturaRepo } = await getBootstrap();
      const lecturas = await lecturaRepo.listarPorMedidor(idMedidor);
      setHistorialMap(prev => new Map(prev).set(idMedidor, lecturas));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DetalleSuscriptor] error al cargar historial:', e);
    }
  }, []);

  const cargarHistorialDeMedidores = useCallback(async (lista: Medidor[]) => {
    if (lista.length === 0) return;
    setLoadingHistorial(true);
    try {
      await Promise.all(lista.map((m) => cargarHistorial(m.id_medidor)));
    } finally {
      setLoadingHistorial(false);
    }
  }, [cargarHistorial]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const onToggleSubsidio = useCallback(async (nuevoValor: boolean) => {
    if (suscriptor === null || guardandoSubsidio) return;
    setGuardandoSubsidio(true);
    try {
      const { suscriptorRepo } = await getBootstrap();
      // El repo expo-sqlite expone toggleSubsidio; lo casteamos para no
      // tocar el interface de dominio que todavia tiene actualizar como stub.
      const repo = suscriptorRepo as unknown as {
        toggleSubsidio(id: number, valor: boolean): Promise<Suscriptor>;
      };
      const actualizado = await repo.toggleSubsidio(suscriptor.id_suscriptor, nuevoValor);
      setSuscriptor(actualizado);
    } catch (e) {
      console.warn('[DetalleSuscriptor] error al cambiar subsidio:', e);
      setError('No se pudo actualizar el subsidio. Reintentar.');
    } finally {
      setGuardandoSubsidio(false);
    }
  }, [suscriptor, guardandoSubsidio]);

  return (
    <View style={styles.container}>
      {/* ── TopAppBar ── */}
      <TopBar
        titulo="Detalle Suscriptor"
        onBack={() => navigation.goBack()}
      />

      {/* ── Snack inline de error ── */}
      {error !== null && (
        <Pressable
          onPress={() => setError(null)}
          style={styles.snackError}
        >
          <Text style={styles.snackText}>{error}</Text>
          <Pressable
            onPress={() => void cargar()}
            style={styles.snackRetry}
          >
            <Text style={styles.snackRetryText}>REINTENTAR</Text>
          </Pressable>
          <Text style={styles.snackClose}>×</Text>
        </Pressable>
      )}

      {/* ── Contenido principal ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : suscriptor === null ? (
        <View style={styles.center}>
          <Text style={styles.notFoundText}>SUSCRIPTOR NO ENCONTRADO</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedDark]}
          >
            <Text style={styles.btnPrimaryText}>VOLVER</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Card 1 — Datos del suscriptor */}
          <View style={styles.card}>
            {/* Cabecera de la card con badge de estado y chip de estrato */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>DATOS DEL SUSCRIPTOR</Text>
              <View style={styles.cardHeaderBadges}>
                <View style={styles.chipEstrato}>
                  <Text style={styles.chipEstratoText}>E{suscriptor.estrato}</Text>
                </View>
                <View style={styles.badgeEstado}>
                  <Text style={styles.badgeEstadoText}>
                    {suscriptor.estado.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />

            <Campo label="Código" valor={suscriptor.codigo} />
            <View style={styles.divider} />
            <Campo label="Nombre y apellidos" valor={suscriptor.nombre_apellidos} />
            <View style={styles.divider} />
            <Campo label="Cédula" valor={suscriptor.cedula} />
            <View style={styles.divider} />
            <Campo label="Dirección" valor={suscriptor.direccion} />
            <View style={styles.divider} />
            <Campo label="Municipio" valor={suscriptor.municipio} />
            <View style={styles.divider} />
            <Campo label="Sector" valor={suscriptor.sector ?? '—'} />
            <View style={styles.divider} />
            <Campo
              label="Matrícula inmobiliaria"
              valor={suscriptor.matricula_inmobiliaria ?? '—'}
            />
            <View style={styles.divider} />
            <Campo
              label="Número catastral"
              valor={suscriptor.numero_catastral ?? '—'}
            />
            <View style={styles.divider} />
            <Campo label="Fecha de alta" valor={suscriptor.created_at} />
            <View style={styles.divider} />

            {/* Toggle subsidio */}
            <View style={styles.subsidioRow}>
              <View style={styles.subsidioInfo}>
                <Text style={styles.campoLabel}>SUBSIDIO TARIFARIO</Text>
                <Text style={styles.subsidioDesc}>
                  {suscriptor.aplica_subsidio ? 'Aplica subsidio' : 'No aplica subsidio'}
                </Text>
              </View>
              <Switch
                value={suscriptor.aplica_subsidio}
                onValueChange={(v) => { void onToggleSubsidio(v); }}
                disabled={guardandoSubsidio}
                trackColor={{ false: COLORS.surfaceVariant, true: COLORS.secondaryContainer }}
                thumbColor={COLORS.surfaceContainerLowest}
              />
            </View>
          </View>

          {/* Card 2 — Medidores asociados */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>MEDIDORES ASOCIADOS</Text>
              <View style={styles.badgeEstado}>
                <Text style={styles.badgeEstadoText}>{medidores.length}</Text>
              </View>
            </View>
            <View style={styles.divider} />

            {medidores.length === 0 ? (
              <Text style={styles.sinMedidores}>SIN MEDIDORES ASOCIADOS</Text>
            ) : (
              medidores.map((m, idx) => (
                <View key={m.id_medidor}>
                  {idx > 0 && <View style={styles.medidorSeparator} />}
                  <View style={styles.medidor}>
                    <Campo label="Número" valor={m.numero_medidor} />
                    <View style={styles.divider} />
                    <Campo label="Fecha instalación" valor={m.fecha_instalacion} />
                    <View style={styles.divider} />
                    <View style={styles.medidorEstadoRow}>
                      <Text style={styles.campoLabel}>ESTADO</Text>
                      <View style={styles.badgeEstado}>
                        <Text style={styles.badgeEstadoText}>
                          {m.estado.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {m.observaciones !== undefined && m.observaciones !== '' && (
                      <>
                        <View style={styles.divider} />
                        <Campo label="Observaciones" valor={m.observaciones} />
                      </>
                    )}
                    <Pressable
                      onPress={() =>
                        navigation.navigate('CapturarLectura', {
                          id_medidor: m.id_medidor,
                          id_suscriptor,
                        })
                      }
                      style={({ pressed }) => [
                        styles.btnCapturar,
                        pressed && styles.pressedDark,
                      ]}
                    >
                      <Text style={styles.btnCapturarText}>CAPTURAR LECTURA</Text>
                    </Pressable>
                    {/* Botón historial completo */}
                    <Pressable
                      onPress={() =>
                        navigation.navigate('Historial', {
                          id_suscriptor,
                          nombre: suscriptor?.nombre_apellidos ?? '',
                        })
                      }
                      style={({ pressed }) => [
                        styles.btnHistorial,
                        pressed && styles.pressedLight,
                      ]}
                    >
                      <MaterialIcons name="history" size={18} color={COLORS.primary} />
                      <Text style={styles.btnHistorialText}>VER HISTORIAL COMPLETO</Text>
                      <MaterialIcons name="chevron-right" size={18} color={COLORS.onSurfaceVariant} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Brand footer */}
          <FooterApp />
        </ScrollView>
      )}

      {/* ── Bottom bar fijo ── */}
      {!loading && (
        <View style={[styles.bottomBar, styles.bottomBarRow]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.btnVolver, styles.btnHalf, pressed && styles.pressedLight]}
          >
            <Text style={styles.btnVolverText}>VOLVER</Text>
          </Pressable>
          {suscriptor !== null && (
            <Pressable
              onPress={() => navigation.navigate('EditarSuscriptor', { suscriptor })}
              style={({ pressed }) => [styles.btnEditar, styles.btnHalf, pressed && styles.pressedDark]}
            >
              <MaterialIcons name="edit" size={16} color={COLORS.onPrimary} />
              <Text style={styles.btnEditarText}>EDITAR</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Contenedor raíz */
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* ── Scroll ── */
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  notFoundText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.gutter,
    paddingBottom: 100,
    gap: SPACING.gutter,
  },

  /* ── Cards ── */
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  cardHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardTitle: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  /* ── Badge estado ── */
  badgeEstado: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeEstadoText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onPrimary,
    letterSpacing: 1,
  },

  /* ── Chip estrato ── */
  chipEstrato: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  chipEstratoText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    fontWeight: '700',
  },

  /* ── Toggle subsidio ── */
  subsidioRow: {
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subsidioInfo: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  subsidioDesc: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    marginTop: 2,
  },

  /* ── Campos ── */
  campo: {
    paddingVertical: SPACING.sm,
  },
  campoLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  campoValor: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },

  /* ── Dividers ── */
  divider: {
    height: 1,
    backgroundColor: COLORS.outlineVariant,
    opacity: 0.6,
  },
  medidorSeparator: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginVertical: SPACING.sm,
  },

  /* ── Medidor ── */
  medidor: {
    paddingVertical: SPACING.xs,
  },
  medidorEstadoRow: {
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sinMedidores: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    paddingVertical: SPACING.sm,
    textAlign: 'center',
  },

  /* ── Botón capturar lectura (primario full-width) ── */
  btnCapturar: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnCapturarText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    letterSpacing: 2,
  },

  /* ── Botón primario genérico ── */
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    letterSpacing: 2,
  },

  /* ── Bottom bar ── */
  bottomBar: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bottomBarRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btnHalf: {
    flex: 1,
  },
  btnVolver: {
    borderWidth: 2,
    borderColor: COLORS.primaryContainer,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnVolverText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primaryContainer,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  btnEditar: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  btnEditarText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  /* ── Pressed states ── */
  pressedDark: {
    opacity: 0.7,
  },
  pressedLight: {
    backgroundColor: COLORS.surfaceLight,
  },

  /* ── Snack inline error ── */
  snackError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorContainer,
    margin: SPACING.gutter,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
    ...BORDERS.thin,
    borderColor: COLORS.error,
  },
  snackText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onErrorContainer,
    flex: 1,
  },
  snackRetry: {
    backgroundColor: COLORS.onErrorContainer,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  snackRetryText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.errorContainer,
    letterSpacing: 1,
  },
  snackClose: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onErrorContainer,
    lineHeight: 20,
  },

  /* ── Brand footer ── */
  brandFooter: {
    ...TYPOGRAPHY.labelSm,
    fontSize: 8,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textAlign: 'center',
    paddingTop: SPACING.sm,
  },

  /* ── Botón historial completo ── */
  btnHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  btnHistorialText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    flex: 1,
    letterSpacing: 0.5,
  },
});
