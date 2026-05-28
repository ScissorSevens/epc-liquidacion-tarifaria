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
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

type Props = LecturasStackScreenProps<'Historial'>;

/** Convierte 'YYYYMM' o 'YYYY-MM' a etiqueta corta: 'ENE', 'FEB', etc. */
function mesCorto(periodo: string): string {
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const raw = periodo.replace('-', '');
  const mes = parseInt(raw.slice(4, 6), 10) - 1;
  return meses[mes] ?? periodo;
}

/** Convierte 'YYYYMM' o 'YYYY-MM' a label legible: 'Junio 2024' */
function mesLargo(periodo: string): string {
  const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];
  const raw = periodo.replace('-', '');
  const year = raw.slice(0, 4);
  const mes = parseInt(raw.slice(4, 6), 10) - 1;
  return `${meses[mes] ?? periodo} ${year}`;
}

/**
 * Pantalla de historial de consumo de un suscriptor.
 *
 * Muestra:
 * - KPIs: promedio, pico y total de consumo (m³) sobre todas las lecturas
 * - Gráfico de barras de los últimos 6 meses
 * - Lista de facturación: una fila por período, con fecha y valor en m³
 */
export default function Historial({ navigation, route }: Props) {
  const { id_suscriptor, nombre } = route.params;

  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { medidorRepo, lecturaRepo } = await getBootstrap();
      const medidores = await medidorRepo.listarPorSuscriptor(id_suscriptor);
      const todasLecturas = (
        await Promise.all(medidores.map((m) => lecturaRepo.listarPorMedidor(m.id_medidor)))
      ).flat();
      // Orden descendente por timestamp
      todasLecturas.sort(
        (a, b) => new Date(b.timestamp_captura).getTime() - new Date(a.timestamp_captura).getTime(),
      );
      // Deduplicar por período: si hay varios medidores con lectura en el mismo mes,
      // conservar solo la más reciente (ya están ordenadas desc por timestamp).
      const vistoPeriodo = new Set<string>();
      const sinDuplicados = todasLecturas.filter((l) => {
        if (vistoPeriodo.has(l.id_periodo)) return false;
        vistoPeriodo.add(l.id_periodo);
        return true;
      });
      setLecturas(sinDuplicados);
    } catch (e) {
      console.warn('[Historial] error al cargar:', e);
      setError('No se pudo cargar el historial. Intentar de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [id_suscriptor]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const valores = lecturas.map((l) => l.lectura_actual);
  const total = valores.reduce((a, b) => a + b, 0);
  const promedio = valores.length > 0 ? total / valores.length : 0;
  const pico = valores.length > 0 ? Math.max(...valores) : 0;

  // ── Últimos 6 períodos para el gráfico ──────────────────────────────────────
  const periodosUnicos = [...new Set(lecturas.map((l) => l.id_periodo))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 6)
    .reverse();
  const consumoPorPeriodo = periodosUnicos.map((p) => ({
    periodo: p,
    valor: lecturas.filter((l) => l.id_periodo === p).reduce((a, l) => a + l.lectura_actual, 0),
  }));
  const maxConsumo = Math.max(...consumoPorPeriodo.map((c) => c.valor), 1);

  return (
    <View style={styles.raiz}>
      {/* Top App Bar */}
      <TopBar
        titulo={nombre}
        onBack={() => navigation.goBack()}
      />

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

          {/* ── KPI Card ── */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiTitulo}>MÉTRICAS GENERALES</Text>
            <View style={styles.kpiFila}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiEtiqueta}>PROMEDIO</Text>
                <Text style={styles.kpiValor}>{promedio.toFixed(1)}</Text>
                <Text style={styles.kpiUnidad}>m³</Text>
              </View>
              <View style={[styles.kpiItem, styles.kpiItemBordes]}>
                <Text style={styles.kpiEtiqueta}>PICO</Text>
                <Text style={styles.kpiValor}>{pico.toFixed(1)}</Text>
                <Text style={styles.kpiUnidad}>m³</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiEtiqueta}>TOTAL</Text>
                <Text style={styles.kpiValor}>{total.toFixed(0)}</Text>
                <Text style={styles.kpiUnidad}>m³</Text>
              </View>
            </View>
          </View>

          {/* ── Gráfico de barras ── */}
          <View style={styles.graficoCard}>
            <View style={styles.graficoHeader}>
              <View>
                <Text style={styles.graficoTitulo}>Últimos 6 meses</Text>
                <Text style={styles.graficoSubtitulo}>Consumo registrado</Text>
              </View>
              <MaterialIcons name="bar-chart" size={24} color={COLORS.secondary} />
            </View>
            {consumoPorPeriodo.length === 0 ? (
              <View style={styles.sinDatos}>
                <Text style={styles.sinDatosTexto}>Sin datos aún</Text>
              </View>
            ) : (
              <View style={styles.barras}>
                {consumoPorPeriodo.map((c, idx) => {
                  const esUltimo = idx === consumoPorPeriodo.length - 1;
                  const altura = Math.max((c.valor / maxConsumo) * 140, 4);
                  return (
                    <View key={c.periodo} style={styles.barraCol}>
                      <View
                        style={[
                          styles.barra,
                          { height: altura },
                          esUltimo ? styles.barraActiva : styles.barraInactiva,
                        ]}
                      />
                      <Text style={[styles.barraEtiqueta, esUltimo && styles.barraEtiquetaActiva]}>
                        {mesCorto(c.periodo)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Historial de lecturas ── */}
          <Text style={styles.seccionTitulo}>Historial de Lecturas</Text>
          <View style={styles.listaCard}>
            {lecturas.length === 0 ? (
              <View style={styles.sinDatos}>
                <Text style={styles.sinDatosTexto}>Sin lecturas registradas</Text>
              </View>
            ) : (
              lecturas.map((l, idx) => (
                <View
                  key={l.id_lectura}
                  style={[styles.filaItem, idx < lecturas.length - 1 && styles.filaItemBorde]}
                >
                  <View>
                    <Text style={styles.filaMes}>{mesLargo(l.id_periodo)}</Text>
                    <Text style={styles.filaFecha}>
                      {new Date(l.timestamp_captura).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      }).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.filaValor}>{l.lectura_actual} m³</Text>
                </View>
              ))
            )}
          </View>

          {/* ── Botón volver ── */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.btnVolver, pressed && { opacity: 0.85 }]}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
            <Text style={styles.btnVolverTexto}>VOLVER</Text>
          </Pressable>

          <FooterApp />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COLORS.background },

  // Estados
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.margin,
  },
  cargandoTexto: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  errorTexto: { ...TYPOGRAPHY.bodyMd, color: COLORS.error, textAlign: 'center' },
  btnReintentar: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: RADIUS.lg,
  },
  btnReintentarTexto: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, letterSpacing: 0.8 },

  // Scroll
  scroll: {
    padding: SPACING.margin,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },

  // KPI Card
  kpiCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  kpiTitulo: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: SPACING.lg,
  },
  kpiFila: { flexDirection: 'row' },
  kpiItem: { flex: 1, alignItems: 'center', gap: 2 },
  kpiItemBordes: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  kpiEtiqueta: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  kpiValor: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary, fontWeight: '700' },
  kpiUnidad: { fontSize: 10, color: COLORS.onSurfaceVariant, fontWeight: '500' },

  // Gráfico
  graficoCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  graficoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  graficoTitulo: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  graficoSubtitulo: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  barras: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    gap: SPACING.sm,
    paddingHorizontal: 4,
  },
  barraCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: 2 },
  barraInactiva: { backgroundColor: COLORS.surfaceDim },
  barraActiva: { backgroundColor: COLORS.primary },
  barraEtiqueta: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    marginTop: SPACING.xs,
  },
  barraEtiquetaActiva: { color: COLORS.primary },

  // Sección lista
  seccionTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    paddingHorizontal: 4,
  },
  listaCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  sinDatos: { padding: SPACING.lg, alignItems: 'center' },
  sinDatosTexto: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  filaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 4,
  },
  filaItemBorde: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  filaMes: { ...TYPOGRAPHY.headlineSm, fontSize: 16, color: COLORS.primary },
  filaFecha: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '400' },
  filaValor: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },

  // Botón volver
  btnVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
  },
  btnVolverTexto: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
