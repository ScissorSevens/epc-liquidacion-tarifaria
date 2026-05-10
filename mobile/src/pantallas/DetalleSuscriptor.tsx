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

import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import type { LecturasStackScreenProps } from '../navegacion/types';
import { BORDERS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DetalleSuscriptor] error al cargar:', e);
      setError('Error al cargar el detalle. Reintentar.');
    } finally {
      setLoading(false);
    }
  }, [id_suscriptor]);

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
      {/* ── Header brutalist ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressedDark]}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DETALLE SUSCRIPTOR</Text>
        <View style={styles.headerBtn} />
      </View>

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
            <Campo label="Dirección" valor={suscriptor.direccion} />
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
                trackColor={{ false: COLORS.outline, true: COLORS.primary }}
                thumbColor={COLORS.onPrimary}
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
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Brand footer */}
          <Text style={styles.brandFooter}>
            MEDIAPP V1.0.4 - MODO OFFLINE
          </Text>
        </ScrollView>
      )}

      {/* ── Bottom bar fijo ── */}
      {!loading && (
        <View style={styles.bottomBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.btnVolver, pressed && styles.pressedLight]}
          >
            <Text style={styles.btnVolverText}>VOLVER</Text>
          </Pressable>
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

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
    lineHeight: 36,
  },
  headerTitle: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    letterSpacing: 2,
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
    padding: SPACING.gutter,
    paddingBottom: 100,
    gap: SPACING.gutter,
  },

  /* ── Cards ── */
  card: {
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cardHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardTitle: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    letterSpacing: 1.5,
    fontWeight: '600',
  },

  /* ── Badge estado ── */
  badgeEstado: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeEstadoText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onPrimary,
    letterSpacing: 1,
  },

  /* ── Chip estrato ── */
  chipEstrato: {
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  chipEstratoText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    letterSpacing: 1,
    fontWeight: '600',
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
    backgroundColor: COLORS.outline,
    opacity: 0.12,
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
    paddingVertical: SPACING.sm,
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
    paddingVertical: SPACING.sm,
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  btnVolver: {
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  btnVolverText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    letterSpacing: 2,
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
});
