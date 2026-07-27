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
import { BotonPrimario } from '../componentes/BotonPrimario';
import { FooterApp } from '../componentes/FooterApp';
import { TarjetaMetrica } from '../componentes/TarjetaMetrica';
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

  // ── KPIs — calculados sobre el CONSUMO (delta) de cada período ────────────
  const consumos = lecturas.map((l) => Math.max(l.lectura_actual - l.lectura_anterior, 0));
  const totalConsumo = consumos.reduce((a, b) => a + b, 0);
  const promedioConsumo = consumos.length > 0 ? totalConsumo / consumos.length : 0;
  const picoConsumo = consumos.length > 0 ? Math.max(...consumos) : 0;

  // ── Últimos 6 períodos para el gráfico ──────────────────────────────────────
  const periodosUnicos = [...new Set(lecturas.map((l) => l.id_periodo))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 6)
    .reverse();
  const consumoPorPeriodo = periodosUnicos.map((p) => {
    const lectura = lecturas.find((l) => l.id_periodo === p);
    const consumo = lectura ? Math.max(lectura.lectura_actual - lectura.lectura_anterior, 0) : 0;
    return { periodo: p, valor: consumo };
  });

  // Si hay un solo dato, usamos su valor como referencia pero no lo escalamos al 100%
  // — visualmente se fija a 60% del alto máximo para que no llene todo el gráfico.
  const maxConsumoRaw = Math.max(...consumoPorPeriodo.map((c) => c.valor), 1);
  const escalaMax = consumoPorPeriodo.length === 1 ? maxConsumoRaw / 0.6 : maxConsumoRaw;

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
          <BotonPrimario
            texto="Reintentar"
            tono="azul"
            tamano="compacto"
            onPress={() => void cargar()}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* ── KPI Card ── */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiTitulo}>Métricas generales</Text>
            <View style={styles.kpiFila}>
              <TarjetaMetrica
                icono="analytics"
                etiqueta="Promedio"
                valor={`${promedioConsumo.toFixed(1)} m³`}
                variante="normal"
                testID="kpi-promedio"
              />
              <TarjetaMetrica
                icono="trending-up"
                etiqueta="Pico"
                valor={`${picoConsumo.toFixed(1)} m³`}
                variante="normal"
                testID="kpi-pico"
              />
              <TarjetaMetrica
                icono="water-drop"
                etiqueta="Total"
                valor={`${totalConsumo.toFixed(0)} m³`}
                variante="normal"
                testID="kpi-total"
              />
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
                  const altura = Math.max((c.valor / escalaMax) * 140, 4);
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
              lecturas.map((l, idx) => {
                const consumo = Math.max(l.lectura_actual - l.lectura_anterior, 0);
                return (
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
                    <View style={styles.filaValorWrap}>
                      <Text style={styles.filaValor}>{consumo.toFixed(1)} m³</Text>
                      <Text style={styles.filaLecturaRaw}>Lectura: {l.lectura_actual}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Botón volver ── */}
          <BotonPrimario
            texto="Volver"
            icono="arrow-back"
            tono="azul"
            onPress={() => navigation.goBack()}
          />

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
  // El botón "Reintentar" se renderiza via <BotonPrimario> extraído.

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
    marginBottom: SPACING.lg,
  },
  kpiFila: { flexDirection: 'row', gap: SPACING.sm },
  // Los 3 KPIs ahora se renderizan via <TarjetaMetrica> extraída.

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
  barraCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', maxWidth: 48 },
  barra: { width: '70%', borderRadius: 2 },
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
  filaValorWrap: { alignItems: 'flex-end', gap: 2 },
  filaValor: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  filaLecturaRaw: { fontSize: 11, color: COLORS.onSurfaceVariant, fontWeight: '400' },

  // El botón "Volver" se renderiza via <BotonPrimario> extraído.
});
