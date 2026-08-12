/**
 * PeriodoPicker — selector de mes/año con diseño Modern Brutalism.
 *
 * Muestra un campo presionable que abre un Modal con flechas para
 * navegar entre meses y años. El valor se expone como string "YYYYMM".
 *
 * Uso:
 *   <PeriodoPicker value="202504" onChange={(v) => setCampo('id_periodo', v)} />
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

function periodoAFecha(periodo: string): { anio: number; mes: number } {
  const anio = parseInt(periodo.slice(0, 4), 10);
  const mes = parseInt(periodo.slice(4, 6), 10) - 1; // 0-indexed
  return { anio, mes };
}

function fechaAPeriodo(anio: number, mes: number): string {
  return `${anio}${String(mes + 1).padStart(2, '0')}`;
}

interface Props {
  value: string; // "YYYYMM"
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export default function PeriodoPicker({ value, onChange, disabled, error }: Props) {
  const [visible, setVisible] = useState(false);

  const { anio, mes } = periodoAFecha(value);
  const [anioTemp, setAnioTemp] = useState(anio);
  const [mesTemp, setMesTemp] = useState(mes);

  function abrir() {
    if (disabled) return;
    const actual = periodoAFecha(value);
    setAnioTemp(actual.anio);
    setMesTemp(actual.mes);
    setVisible(true);
  }

  function confirmar() {
    onChange(fechaAPeriodo(anioTemp, mesTemp));
    setVisible(false);
  }

  function cancelar() {
    setVisible(false);
  }

  function mesAnterior() {
    if (mesTemp === 0) { setMesTemp(11); setAnioTemp((a) => a - 1); }
    else setMesTemp((m) => m - 1);
  }

  function mesSiguiente() {
    if (mesTemp === 11) { setMesTemp(0); setAnioTemp((a) => a + 1); }
    else setMesTemp((m) => m + 1);
  }

  const etiqueta = `${MESES[mes]} ${anio}`;

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
        <Text style={[styles.campoTexto, disabled && styles.campoTextoDisabled]}>
          {etiqueta}
        </Text>
        <MaterialIcons
          name="calendar-month"
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
            <Text style={styles.titulo}>SELECCIONAR PERIODO</Text>

            {/* Navegación mes */}
            <View style={styles.fila}>
              <Pressable
                onPress={mesAnterior}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-left" size={28} color={COLORS.primary} />
              </Pressable>

              <View style={styles.centroNav}>
                <Text style={styles.mesTexto}>{MESES[mesTemp]}</Text>
              </View>

              <Pressable
                onPress={mesSiguiente}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-right" size={28} color={COLORS.primary} />
              </Pressable>
            </View>

            {/* Navegación año */}
            <View style={styles.fila}>
              <Pressable
                onPress={() => setAnioTemp((a) => a - 1)}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-left" size={28} color={COLORS.primary} />
              </Pressable>

              <View style={styles.centroNav}>
                <Text style={styles.anioTexto}>{anioTemp}</Text>
              </View>

              <Pressable
                onPress={() => setAnioTemp((a) => a + 1)}
                style={({ pressed }) => [styles.flecha, pressed && styles.flechaPressed]}
              >
                <MaterialIcons name="chevron-right" size={28} color={COLORS.primary} />
              </Pressable>
            </View>

            {/* Preview */}
            <View style={styles.preview}>
              <Text style={styles.previewTexto}>
                {fechaAPeriodo(anioTemp, mesTemp)}
              </Text>
            </View>

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
                style={({ pressed }) => [styles.btnPrimario, pressed && styles.btnPressed]}
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
  campoDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  campoTexto: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },
  campoTextoDisabled: {
    color: COLORS.placeholder,
  },

  // Modal overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.none,
    width: '100%',
    maxWidth: 340,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  titulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 1,
  },

  // Fila de navegación
  fila: {
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
  flechaPressed: {
    backgroundColor: COLORS.surfaceLight,
  },
  centroNav: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  mesTexto: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },
  anioTexto: {
    ...TYPOGRAPHY.bodyLg,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Preview del valor YYYYMM
  preview: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceMuted,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  previewTexto: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },

  // Botones
  acciones: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  btnPrimario: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnPrimarioTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    letterSpacing: 1,
  },
  btnSecundario: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.outline,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnSecundarioTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  btnPressed: {
    opacity: 0.7,
  },
});
