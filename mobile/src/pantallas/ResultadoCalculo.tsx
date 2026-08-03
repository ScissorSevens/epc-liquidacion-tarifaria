import { useMemo, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BotonPrimario } from '../componentes/BotonPrimario';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';
import { calcularTotalComponentes } from '@dominio/factura/pagos';

type Props = LecturasStackScreenProps<'ResultadoCalculo'>;

/**
 * Formatea pesos colombianos sin decimales con `Intl.NumberFormat`.
 *
 * Hermes (engine de RN) soporta `Intl.NumberFormat` desde RN 0.70 con
 * `jsEngine: hermes` y la opcion `intl` habilitada en el build (Expo SDK
 * 50+ trae intl-locale-data ya cableado). Si en algun celu cae al string
 * crudo, la app no rompe — pero el numero se muestra sin formato.
 */
function formatearCOP(monto: number): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(monto);
  } catch {
    // Fallback defensivo si Intl no esta disponible.
    return `$ ${Math.round(monto).toLocaleString('es-CO')}`;
  }
}

/**
 * Formatea ISO-8601 -> "DD MMM YYYY - HH:MM" en español rioplatense.
 * Si la entrada no parsea, devolvemos el string crudo (no rompe la UI).
 */
const MESES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
] as const;

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mes = MESES[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mes} ${yyyy} - ${hh}:${mm}`;
}

/**
 * Pantalla de resultado de liquidación — REDISEÑO VISUAL Skeletal Stitch.
 * Ver `stitch_mediapp_rural_water_wireframes/4._factura_calculada/code.html`.
 *
 * NOTA: la lógica es 100% presentacional. NO consulta repos. Recibe TODO
 * por params (`lectura`, `resultado`, `parametros`, `estrato`, `id_suscriptor`).
 *
 * Mapeo de botones:
 *   "Ver historial"  -> "VOLVER AL INICIO"  (popToTop) — no hay historial.
 *   "Volver a la ruta" -> "CAPTURAR OTRA"   (replace a CapturarLectura).
 *
 * Hash de verificación:
 *   El dominio actual NO calcula hash de la liquidación. Usamos
 *   `lectura.evidencia?.foto_hash` si existe; si no, mostramos el
 *   placeholder "— (sin evidencia foto)".
 */
export default function ResultadoCalculo({ navigation, route }: Props) {
  const {
    lectura,
    resultado,
    parametros,
    estrato,
    id_suscriptor,
    nombre_suscriptor,
    prestador,
    otros_valores,
    saldo_anterior,
  } = route.params;

  // `factura-preview-print-bluetooth` R8: el total normativo incluye
  // `liquidacion.total + sum(otros_valores) + saldo_anterior`. Si los
  // callers legacy no los pasan (pre-emision), default a 0 / [].
  const totalNormativo = calcularTotalComponentes(
    resultado.total,
    otros_valores ?? [],
    saldo_anterior ?? 0,
  );

  const [detalleAbierto, setDetalleAbierto] = useState(true);

  const subsidioMostrar = resultado.subsidio > 0;
  const contribMostrar = resultado.contribucion > 0;
  // En el motor multi-tenant, el "consumo excedente" no se desglosa por bloque.
  // Mostramos un mensaje informativo cuando el consumo efectivo es > 0
  // (consumo_efectivo_m3 = consumo_m3 si no aplica mínimo vital).
  const excedenteMostrar = resultado.consumo_efectivo_m3 > 0;

  const fechaTxt = formatearFecha(lectura.timestamp_captura);
  const hashTxt =
    lectura.evidencia?.foto_hash !== undefined
      ? lectura.evidencia.foto_hash
      : '— (sin evidencia foto)';

  const subtitulo = useMemo(
    () =>
      `${prestador?.nombre ?? '—'} (${prestador?.municipio ?? '—'}) — Suscriptor #${id_suscriptor} — Medidor #${lectura.id_medidor} — ${lectura.id_periodo}`,
    [prestador?.nombre, prestador?.municipio, id_suscriptor, lectura.id_medidor, lectura.id_periodo],
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <TopBar
        titulo="Factura calculada"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status: círculo + título + subtítulo */}
        <View style={styles.statusBlock}>
          <View style={styles.checkCircleContainer}>
            <MaterialIcons name="check-circle" size={56} color={COLORS.onPrimary} />
          </View>
          <Text style={styles.statusTitle}>Lectura registrada</Text>
          <Text style={styles.statusSub}>
            El proceso de facturación ha finalizado correctamente.
          </Text>
          <Text style={styles.subtituloMeta}>{subtitulo}</Text>
        </View>

        {/* Bento grid: total + anterior/actual + consumo */}
        <View style={[styles.bentoColFull, styles.bentoColFullTotal]}>
          <Text style={[styles.bentoLabel, styles.bentoLabelTotal]}>Monto total</Text>
          <Text
            testID="total-factura"
            style={[styles.bentoTotal, styles.bentoTotalBlanco]}
          >
            {formatearCOP(totalNormativo)}
          </Text>
        </View>
        <View style={styles.bentoRow}>
          <View style={[styles.bentoColHalf, styles.bentoFill]}>
            <Text style={styles.bentoLabelSm}>Anterior</Text>
            <Text style={styles.bentoMid}>
              {lectura.lectura_anterior}{' '}
              <Text style={styles.bentoUnit}>m³</Text>
            </Text>
          </View>
          <View style={[styles.bentoColHalf, styles.bentoFill]}>
            <Text style={styles.bentoLabelSm}>Actual</Text>
            <Text style={styles.bentoMid}>
              {lectura.lectura_actual}{' '}
              <Text style={styles.bentoUnit}>m³</Text>
            </Text>
          </View>
        </View>
        <View style={styles.bentoColFullWhite}>
          <View style={styles.bentoConsumoLeft}>
            <View style={styles.bentoConsumoIconBox}>
              <MaterialIcons name="speed" size={22} color={COLORS.onSurface} />
            </View>
            <Text style={styles.bentoConsumoLabel}>Consumo del Periodo</Text>
          </View>
            <Text style={styles.bentoConsumoVal}>{resultado.consumo_m3} m³</Text>
        </View>

        {/* Detalle colapsable */}
        <View style={styles.detalleWrap}>
          <Pressable
            onPress={() => setDetalleAbierto((v) => !v)}
            style={({ pressed }) => [
              styles.detalleHeader,
              pressed && styles.pressedLight,
            ]}
          >
            <Text style={styles.detalleTitulo}>Detalle de cálculo</Text>
            <MaterialIcons
              name={detalleAbierto ? 'expand-less' : 'expand-more'}
              size={20}
              color={COLORS.primary}
            />
          </Pressable>
          {detalleAbierto && (
            <View style={styles.detalleBody}>
              <FilaDetalle
                label={`Cargo Fijo (CF = CMA/N)`}
                valor={formatearCOP(resultado.cargo_fijo)}
              />
              <FilaDetalle
                label={`Cargo Consumo (CC unit ${formatearCOP(resultado.cc_unitario)}/m³ × ${resultado.consumo_efectivo_m3}m³)`}
                valor={formatearCOP(resultado.cc_total)}
              />
              {subsidioMostrar && (
                <FilaDetalle
                  label={`Subsidio (estrato ${estrato})`}
                  valor={`- ${formatearCOP(resultado.subsidio)}`}
                />
              )}
              {contribMostrar && (
                <FilaDetalle
                  label={`Contribución (estrato ${estrato})`}
                  valor={`+ ${formatearCOP(resultado.contribucion)}`}
                />
              )}
              <FilaDetalle
                label="Norma aplicada"
                valor={resultado.metadata.norma_aplicada}
                meta
              />
              <FilaDetalle
                label="Versión motor"
                valor={resultado.metadata.version_motor}
                meta
              />
            </View>
          )}
        </View>

        {/* Acciones */}
        <View style={styles.actionsCol}>
          <BotonPrimario
            texto="Ver historial"
            icono="history"
            tono="azul"
            onPress={() => navigation.navigate('Historial', {
              id_suscriptor,
              nombre: nombre_suscriptor,
            })}
          />
          <Pressable
            onPress={() =>
              navigation.replace('CapturarLectura', {
                id_medidor: lectura.id_medidor,
                id_suscriptor,
              })
            }
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedLight]}
          >
            <MaterialIcons name="map" size={20} color={COLORS.primary} />
            <Text style={styles.btnSecondaryText}>Volver a la ruta</Text>
          </Pressable>
        </View>

        {/* Metadata footer */}
        <View style={styles.metaWrap}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha</Text>
            <Text style={styles.metaVal}>{fechaTxt}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Prestador</Text>
            <Text style={styles.metaVal} numberOfLines={1}>
              {prestador?.nombre ?? '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Municipio</Text>
            <Text style={styles.metaVal} numberOfLines={1}>
              {prestador?.municipio ?? '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Operador</Text>
            <Text style={styles.metaVal}>
              Operador #{lectura.id_operario}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Estrato</Text>
            <Text style={styles.metaVal}>{estrato}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Hash de verificación</Text>
            <Text style={styles.metaHash}>{hashTxt}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer fijo */}
      <FooterApp />
    </View>
  );
}

/** Fila label/valor del detalle de cálculo. `meta` = estilo más sutil. */
function FilaDetalle({
  label,
  valor,
  meta,
}: {
  label: string;
  valor: string;
  meta?: boolean;
}) {
  return (
    <View style={styles.filaDetalle}>
      <Text style={[styles.filaDetalleLabel, meta && styles.filaMeta]}>
        {label}
      </Text>
      <Text style={[styles.filaDetalleValor, meta && styles.filaMeta]}>
        {valor}
      </Text>
    </View>
  );
}

const FOOTER_HEIGHT = 48;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Scroll
  scroll: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: FOOTER_HEIGHT + SPACING.xl,
    gap: SPACING.sm,
  },

  // Status
  statusBlock: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  checkCircleIcon: {
    marginBottom: SPACING.sm,
  },
  checkCircleContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.secondaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusTitle: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.primary,
  },
  statusSub: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  subtituloMeta: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // Bento grid
  bentoColFull: {
    width: '100%',
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  bentoColFullTotal: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  bentoLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  bentoLabelTotal: {
    color: COLORS.onPrimaryContainer,
  },
  bentoTotal: {
    ...TYPOGRAPHY.displayLg,
    color: COLORS.primary,
  },
  bentoTotalBlanco: {
    color: COLORS.onPrimary,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bentoColHalf: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(197,198,206,0.3)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    minHeight: 80,
  },
  bentoFill: {},
  bentoLabelSm: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  bentoMid: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  bentoUnit: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  bentoColFullWhite: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoConsumoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bentoConsumoIconBox: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: RADIUS.default,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoConsumoLabel: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  bentoConsumoVal: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.secondary,
    fontWeight: '700',
  },

  // Detalle colapsable
  detalleWrap: {
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
    marginTop: SPACING.sm,
  },
  detalleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  detalleTitulo: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  detalleBody: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  filaDetalle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,198,206,0.4)',
  },
  filaDetalleLabel: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    flex: 1,
  },
  filaDetalleValor: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurface,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  filaMeta: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Acciones
  actionsCol: {
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  btnSecondary: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(3,22,50,0.2)', // primary/20
    borderRadius: RADIUS.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  btnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorBox: {
    padding: SPACING.sm,
    backgroundColor: COLORS.errorContainer,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  errorText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.error,
  },

  // Metadata
  metaWrap: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    gap: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  metaVal: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurface,
    fontWeight: '700',
  },
  metaCol: {
    flexDirection: 'column',
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  metaHash: {
    fontSize: 10,
    lineHeight: 16,
    color: COLORS.onSurfaceVariant,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(203,219,245,0.4)', // surface-dim/40
    padding: SPACING.sm,
    borderRadius: RADIUS.default,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.outline,
    letterSpacing: 0.3,
  },

  // Pressed states
  pressedLight: {
    backgroundColor: COLORS.surfaceLight,
  },
  pressedDark: {
    opacity: 0.85,
  },
});

