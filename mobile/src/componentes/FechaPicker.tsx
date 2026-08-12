/**
 * FechaPicker — selector de fecha con calendario mensual y diseño Modern Brutalism.
 *
 * Muestra un campo presionable que abre un Modal con grilla de días.
 * El valor se expone como string "YYYY-MM-DD".
 *
 * Uso:
 *   <FechaPicker value="2025-04-15" onChange={(v) => setCampo('fecha_instalacion', v)} />
 */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BORDERS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril',
  'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

function parsearFecha(valor: string): Date | null {
  if (!valor || valor.length < 10) return null;
  const d = new Date(valor + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function formatearISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function formatearLegible(valor: string): string {
  const d = parsearFecha(valor);
  if (!d) return valor;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

function primerDiaSemana(anio: number, mes: number): number {
  return new Date(anio, mes, 1).getDay(); // 0=Dom
}

interface Props {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  maxDate?: string; // no permitir fechas futuras si se pasa
}

export default function FechaPicker({ value, onChange, disabled, error, maxDate }: Props) {
  const [visible, setVisible] = useState(false);

  const hoy = new Date();
  const fechaActual = parsearFecha(value) ?? hoy;

  const [anioTemp, setAnioTemp] = useState(fechaActual.getFullYear());
  const [mesTemp, setMesTemp] = useState(fechaActual.getMonth());
  const [diaSelec, setDiaSelec] = useState<number | null>(
    parsearFecha(value) ? fechaActual.getDate() : null,
  );

  function abrir() {
    if (disabled) return;
    const f = parsearFecha(value) ?? hoy;
    setAnioTemp(f.getFullYear());
    setMesTemp(f.getMonth());
    setDiaSelec(parsearFecha(value) ? f.getDate() : null);
    setVisible(true);
  }

  function cancelar() { setVisible(false); }

  function confirmar() {
    if (diaSelec === null) return;
    onChange(formatearISO(anioTemp, mesTemp, diaSelec));
    setVisible(false);
  }

  function mesAnterior() {
    if (mesTemp === 0) { setMesTemp(11); setAnioTemp((a) => a - 1); }
    else setMesTemp((m) => m - 1);
    setDiaSelec(null);
  }

  function mesSiguiente() {
    if (mesTemp === 11) { setMesTemp(0); setAnioTemp((a) => a + 1); }
    else setMesTemp((m) => m + 1);
    setDiaSelec(null);
  }

  function esFuturo(dia: number): boolean {
    if (!maxDate) return false;
    const limite = parsearFecha(maxDate);
    if (!limite) return false;
    const candidato = new Date(anioTemp, mesTemp, dia);
    return candidato > limite;
  }

  // Construir grilla de días
  const totalDias = diasEnMes(anioTemp, mesTemp);
  const offsetInicio = primerDiaSemana(anioTemp, mesTemp);
  const celdas: Array<number | null> = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
  // Rellenar hasta completar filas de 7
  while (celdas.length % 7 !== 0) celdas.push(null);

  const etiqueta = value ? formatearLegible(value) : 'Seleccionar fecha';
  const sinFecha = !value;

  return (
    <>
      {/* Campo presionable */}
      <Pressable
        onPress={abrir}
        style={[
          styles.campo,
          error && styles.campoError,
          disabled && styles.campoDisabled,
        ]}
      >
        <Text style={[
          styles.campoTexto,
          sinFecha && styles.campoPlaceholder,
          disabled && styles.campoTextoDisabled,
        ]}>
          {etiqueta}
        </Text>
        <MaterialIcons
          name="calendar-today"
          size={20}
          color={disabled ? COLORS.placeholder : COLORS.primary}
        />
      </Pressable>

      {/* Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={cancelar}
      >
        <Pressable style={styles.overlay} onPress={cancelar}>
          <Pressable style={styles.card} onPress={() => {}}>

            {/* Título */}
            <Text style={styles.titulo}>SELECCIONAR FECHA</Text>

            {/* Navegación mes/año */}
            <View style={styles.navRow}>
              <Pressable
                onPress={mesAnterior}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-left" size={24} color={COLORS.primary} />
              </Pressable>

              <View style={styles.navCentro}>
                <Text style={styles.navTexto}>
                  {MESES[mesTemp]} {anioTemp}
                </Text>
              </View>

              <Pressable
                onPress={mesSiguiente}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-right" size={24} color={COLORS.primary} />
              </Pressable>
            </View>

            {/* Cabecera días semana */}
            <View style={styles.semanaRow}>
              {DIAS_SEMANA.map((d) => (
                <View key={d} style={styles.semanaCell}>
                  <Text style={styles.semanaTxt}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grilla de días */}
            <View style={styles.grilla}>
              {celdas.map((dia, idx) => {
                if (dia === null) {
                  return <View key={`vacio-${idx}`} style={styles.diaCell} />;
                }
                const seleccionado = dia === diaSelec;
                const futuro = esFuturo(dia);
                const esHoy =
                  dia === hoy.getDate() &&
                  mesTemp === hoy.getMonth() &&
                  anioTemp === hoy.getFullYear();

                return (
                  <Pressable
                    key={dia}
                    onPress={() => !futuro && setDiaSelec(dia)}
                    style={[
                      styles.diaCell,
                      seleccionado && styles.diaCellSelec,
                      esHoy && !seleccionado && styles.diaCellHoy,
                      futuro && styles.diaCellFuturo,
                    ]}
                  >
                    <Text style={[
                      styles.diaTxt,
                      seleccionado && styles.diaTxtSelec,
                      futuro && styles.diaTxtFuturo,
                    ]}>
                      {dia}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Fecha seleccionada preview */}
            {diaSelec !== null && (
              <View style={styles.preview}>
                <Text style={styles.previewTexto}>
                  {formatearISO(anioTemp, mesTemp, diaSelec)}
                </Text>
              </View>
            )}

            {/* Acciones */}
            <View style={styles.acciones}>
              <Pressable
                onPress={cancelar}
                style={({ pressed }) => [styles.btnSecundario, pressed && styles.btnPressed]}
              >
                <Text style={styles.btnSecundarioTexto}>CANCELAR</Text>
              </Pressable>
              <Pressable
                onPress={confirmar}
                disabled={diaSelec === null}
                style={({ pressed }) => [
                  styles.btnPrimario,
                  pressed && styles.btnPressed,
                  diaSelec === null && styles.btnDisabled,
                ]}
              >
                <Text style={styles.btnPrimarioTexto}>CONFIRMAR</Text>
              </Pressable>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const CELDA = 36;

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.none,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  campoError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorContainer,
  },
  campoDisabled: { backgroundColor: COLORS.surfaceLight },
  campoTexto: { ...TYPOGRAPHY.bodyMd, color: COLORS.primary },
  campoPlaceholder: { color: COLORS.placeholder },
  campoTextoDisabled: { color: COLORS.placeholder },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.none,
    width: '100%',
    maxWidth: 340,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  titulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },

  // Navegación mes/año
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  flecha: {
    padding: SPACING.sm,
    borderRightWidth: 1,
    borderColor: COLORS.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flechaPressed: { backgroundColor: COLORS.surfaceLight },
  navCentro: { flex: 1, alignItems: 'center', paddingVertical: SPACING.xs },
  navTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.primary },

  // Cabecera semana
  semanaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: COLORS.outline,
  },
  semanaCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  semanaTxt: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },

  // Grilla días
  grilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  diaCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.divider,
  },
  diaCellSelec: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  diaCellHoy: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  diaCellFuturo: {
    backgroundColor: COLORS.surfaceMuted,
  },
  diaTxt: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
  },
  diaTxtSelec: { color: COLORS.onPrimary, fontWeight: '700' },
  diaTxtFuturo: { color: COLORS.placeholder },

  // Preview
  preview: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceMuted,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  previewTexto: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },

  // Botones
  acciones: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  btnPrimario: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnPrimarioTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, letterSpacing: 1 },
  btnSecundario: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnSecundarioTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.primary, letterSpacing: 1 },
  btnPressed: { opacity: 0.7 },
  btnDisabled: { opacity: 0.4 },
});
