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

import { FooterApp } from '../componentes/FooterApp';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

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
  const { lectura, resultado, parametros, estrato, id_suscriptor } =
    route.params;

  const [detalleAbierto, setDetalleAbierto] = useState(true);

  const subsidioMostrar = resultado.subsidio > 0;
  const contribMostrar = resultado.contribucion > 0;
  const excedenteMostrar = resultado.consumoExcedente > 0;

  const fechaTxt = formatearFecha(lectura.timestamp_captura);
  const hashTxt =
    lectura.evidencia?.foto_hash !== undefined
      ? lectura.evidencia.foto_hash
      : '— (sin evidencia foto)';

  const subtitulo = useMemo(
    () =>
      `Suscriptor #${id_suscriptor} — Medidor #${lectura.id_medidor} — Periodo ${lectura.id_periodo}`,
    [id_suscriptor, lectura.id_medidor, lectura.id_periodo],
  );

  return (
    <View style={styles.root}>
      {/* Header brutalist */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.popToTop()}
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && styles.pressedDark,
          ]}
          accessibilityLabel="Volver"
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>FACTURA CALCULADA</Text>
        <Pressable
          onPress={() => {
            // Perfil: requiere módulo de autenticación.
          }}
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && styles.pressedDark,
          ]}
          accessibilityLabel="Cuenta"
        >
          <MaterialIcons name="radio-button-checked" size={24} color={COLORS.primary} />
        </Pressable>
      </View>

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
          <Text style={[styles.bentoLabel, styles.bentoLabelTotal]}>MONTO TOTAL</Text>
          <Text style={[styles.bentoTotal, styles.bentoTotalBlanco]}>{formatearCOP(resultado.total)}</Text>
        </View>
        <View style={styles.bentoRow}>
          <View style={[styles.bentoColHalf, styles.bentoFill]}>
            <Text style={styles.bentoLabelSm}>ANTERIOR</Text>
            <Text style={styles.bentoMid}>
              {lectura.lectura_anterior}{' '}
              <Text style={styles.bentoUnit}>m³</Text>
            </Text>
          </View>
          <View style={[styles.bentoColHalf, styles.bentoFill]}>
            <Text style={styles.bentoLabelSm}>ACTUAL</Text>
            <Text style={styles.bentoMid}>
              {lectura.lectura_actual}{' '}
              <Text style={styles.bentoUnit}>m³</Text>
            </Text>
          </View>
        </View>
        <View style={styles.bentoColFullWhite}>
          <View style={styles.bentoConsumoLeft}>
            <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
            <Text style={styles.bentoConsumoLabel}>Consumo del Periodo</Text>
          </View>
          <Text style={styles.bentoConsumoVal}>{resultado.consumo} m³</Text>
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
                label="Cargo Fijo"
                valor={formatearCOP(resultado.cargoFijo)}
              />
              <FilaDetalle
                label={`Cargo Consumo Básico (${resultado.consumoBasico}m³)`}
                valor={formatearCOP(resultado.cargoConsumo)}
              />
              {excedenteMostrar && (
                <FilaDetalle
                  label={`Cargo Excedente (${resultado.consumoExcedente}m³)`}
                  valor={formatearCOP(resultado.cargoExcedente)}
                />
              )}
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
                label="Umbral básico aplicado"
                valor={`${parametros.consumoBasico} m³`}
                meta
              />
            </View>
          )}
        </View>

        {/* Acciones */}
        <View style={styles.actionsCol}>
          <Pressable
            onPress={() => navigation.popToTop()}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedDark]}
          >
            <Text style={styles.btnPrimaryText}>VER HISTORIAL</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              navigation.replace('CapturarLectura', {
                id_medidor: lectura.id_medidor,
                id_suscriptor,
              })
            }
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedLight]}
          >
            <Text style={styles.btnSecondaryText}>VOLVER A LA RUTA</Text>
          </Pressable>
        </View>

        {/* Metadata footer */}
        <View style={styles.metaWrap}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>FECHA</Text>
            <Text style={styles.metaVal}>{fechaTxt}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>OPERADOR</Text>
            <Text style={styles.metaVal}>
              Operador #{lectura.id_operario}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>ESTRATO</Text>
            <Text style={styles.metaVal}>{estrato}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>HASH DE VERIFICACIÓN</Text>
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

const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 48;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },
  headerTitle: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
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
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  bentoLabelTotal: {
    color: COLORS.onPrimaryContainer,
  },
  bentoTotal: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -1.5,
    lineHeight: 44,
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
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 80,
  },
  bentoFill: {},
  bentoLabelSm: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    letterSpacing: 1,
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
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
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
  bentoConsumoLabel: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  bentoConsumoVal: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Detalle colapsable
  detalleWrap: {
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
    marginTop: SPACING.sm,
  },
  detalleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  detalleTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
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
    borderBottomColor: COLORS.divider,
  },
  filaDetalleLabel: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    flex: 1,
  },
  filaDetalleValor: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
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
  btnPrimary: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.primary,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  btnSecondary: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
    borderTopColor: COLORS.outline,
    gap: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metaLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaVal: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  metaCol: {
    flexDirection: 'column',
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  metaHash: {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.primary,
    // Fuente monoespaciada por plataforma. iOS = Menlo (sistema), Android =
    // 'monospace' (alias garantizado de Roboto Mono / Droid Sans Mono).
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: COLORS.surfaceMuted2,
    padding: SPACING.sm,
    ...BORDERS.dashed,
  },

  // Pressed states
  pressedLight: {
    backgroundColor: COLORS.surfaceLight,
  },
  pressedDark: {
    opacity: 0.85,
  },
});

