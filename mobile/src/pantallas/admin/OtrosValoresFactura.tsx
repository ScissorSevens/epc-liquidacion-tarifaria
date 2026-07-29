/**
 * Pantalla admin: edicion de otros_valores y saldo_anterior para una factura.
 *
 * Res CRA 1038/2026: el sistema debe poder agregar conceptos autorizados
 * (Reconexion, Financiacion, etc.) y arrastrar saldo de periodos previos
 * ANTES de emitir la factura. Esta pantalla es el editor admin que
 * prepara esos datos — la persistencia la hace el caller via `onGuardar`.
 *
 * UI:
 *  - Lista actual de otros_valores (readonly inline; el admin edita el
 *    valor numerico o elimina el item).
 *  - Selector de catalogo con los 7 conceptos hardcoded.
 *  - Input para saldo_anterior (default 0).
 *  - Botones guardar / cancelar.
 *
 * Touch targets ≥ 44px (WCAG 2.5.5).
 *
 * Esta pantalla es CONTROLLED: no toca persistencia. Espera que el
 * caller provea `onGuardar` con los datos finales. Asi es testeable y
 * reusable (ej: como pantalla admin por prestador, o embebida en un
 * wizard de edicion).
 */
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  OtrosValoresCatalogo,
  type ConceptoOtroValor,
  type OtroValor,
} from '@dominio/factura/otros-valores-catalogo';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';

interface Props {
  readonly otrosValoresIniciales: readonly OtroValor[];
  readonly saldoAnteriorInicial: number;
  readonly onGuardar: (data: {
    otrosValores: readonly OtroValor[];
    saldoAnterior: number;
  }) => void;
  readonly onCancelar: () => void;
}

const TOUCH_TARGET = 56; // ≥ 44px (WCAG 2.5.5)

export default function OtrosValoresFactura({
  otrosValoresIniciales,
  saldoAnteriorInicial,
  onGuardar,
  onCancelar,
}: Props): React.ReactElement {
  const [otrosValores, setOtrosValores] = useState<OtroValor[]>(
    [...otrosValoresIniciales] as OtroValor[],
  );
  const [saldoAnterior, setSaldoAnterior] = useState<string>(
    saldoAnteriorInicial === 0 ? '0' : String(saldoAnteriorInicial),
  );

  function agregarConcepto(concepto: ConceptoOtroValor): void {
    // Verificar que no exista ya.
    if (otrosValores.some((ov) => ov.concepto === concepto)) return;
    const catalogo = OtrosValoresCatalogo[concepto];
    if (catalogo.requiere_glosa) {
      // Para conceptos que requieren glosa, abrimos un dialog inline
      // básico. Para Fase 1 simplificamos: el admin edita la glosa
      // luego en el item.
      setOtrosValores((prev) => [...prev, { concepto, valor: 0, glosa: '' }]);
    } else {
      setOtrosValores((prev) => [...prev, { concepto, valor: 0 }]);
    }
  }

  function eliminarConcepto(concepto: ConceptoOtroValor): void {
    setOtrosValores((prev) => prev.filter((ov) => ov.concepto !== concepto));
  }

  function editarValor(concepto: ConceptoOtroValor, texto: string): void {
    const valor = parseFloat(texto);
    setOtrosValores((prev) =>
      prev.map((ov) =>
        ov.concepto === concepto
          ? { ...ov, valor: Number.isFinite(valor) && valor >= 0 ? valor : 0 }
          : ov,
      ),
    );
  }

  function editarGlosa(concepto: ConceptoOtroValor, texto: string): void {
    setOtrosValores((prev) =>
      prev.map((ov) => (ov.concepto === concepto ? { ...ov, glosa: texto } : ov)),
    );
  }

  function handleGuardar(): void {
    const saldo = parseFloat(saldoAnterior);
    onGuardar({
      otrosValores,
      saldoAnterior: Number.isFinite(saldo) && saldo >= 0 ? saldo : 0,
    });
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Otros valores y saldo anterior</Text>
        <Text style={styles.sub}>
          Conceptos autorizados Res CRA 1038/2026. Se aplican a la
          siguiente factura que se emita.
        </Text>
      </View>

      {/* Lista de otros_valores actuales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitulo}>Conceptos aplicados</Text>
        {otrosValores.length === 0 ? (
          <Text style={styles.empty}>No hay conceptos aplicados.</Text>
        ) : (
          otrosValores.map((ov) => (
            <View key={ov.concepto} style={styles.itemCard} testID={`item-${ov.concepto}`}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemConcepto}>{ov.concepto}</Text>
                <Pressable
                  testID={`eliminar-${ov.concepto}`}
                  onPress={() => eliminarConcepto(ov.concepto)}
                  style={({ pressed }) => [
                    styles.btnEliminar,
                    pressed && styles.btnEliminarPressed,
                  ]}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={18} color={COLORS.error} />
                </Pressable>
              </View>
              <Text style={styles.itemDesc}>
                {OtrosValoresCatalogo[ov.concepto].descripcion}
              </Text>
              <View style={styles.itemRow}>
                <Text style={styles.itemLabel}>Valor (COP)</Text>
                <TextInput
                  testID={`valor-${ov.concepto}`}
                  value={String(ov.valor)}
                  onChangeText={(t) => editarValor(ov.concepto, t)}
                  keyboardType="numeric"
                  style={styles.inputValor}
                />
              </View>
              {OtrosValoresCatalogo[ov.concepto].requiere_glosa && (
                <View style={styles.itemRow}>
                  <Text style={styles.itemLabel}>Glosa</Text>
                  <TextInput
                    testID={`glosa-${ov.concepto}`}
                    value={ov.glosa ?? ''}
                    onChangeText={(t) => editarGlosa(ov.concepto, t)}
                    style={styles.inputGlosa}
                  />
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Selector de catalogo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitulo}>Agregar concepto del catálogo</Text>
        <View style={styles.catalogoGrid}>
          {(Object.keys(OtrosValoresCatalogo) as ConceptoOtroValor[]).map((concepto) => (
            <Pressable
              key={concepto}
              testID={`catalogo-${concepto}`}
              onPress={() => agregarConcepto(concepto)}
              disabled={otrosValores.some((ov) => ov.concepto === concepto)}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
                otrosValores.some((ov) => ov.concepto === concepto) && styles.chipDisabled,
              ]}
              hitSlop={8}
            >
              <Text style={styles.chipTexto}>{concepto}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Saldo anterior */}
      <View style={styles.section}>
        <Text style={styles.sectionTitulo}>Saldo anterior</Text>
        <Text style={styles.sub}>
          Deuda arrastrada de periodos previos. Se suma al total de la factura.
        </Text>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Saldo (COP)</Text>
          <TextInput
            testID="input-saldo-anterior"
            value={saldoAnterior}
            onChangeText={setSaldoAnterior}
            keyboardType="numeric"
            style={styles.inputValor}
          />
        </View>
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <Pressable
          testID="boton-cancelar"
          onPress={onCancelar}
          style={({ pressed }) => [styles.btnCancelar, pressed && styles.btnCancelarPressed]}
        >
          <Text style={styles.btnCancelarTexto}>Cancelar</Text>
        </Pressable>
        <Pressable
          testID="boton-guardar"
          onPress={handleGuardar}
          style={({ pressed }) => [styles.btnGuardar, pressed && styles.btnGuardarPressed]}
        >
          <Text style={styles.btnGuardarTexto}>Guardar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  header: { gap: SPACING.xs },
  titulo: { ...TYPOGRAPHY.headlineLg, color: COLORS.onSurface },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary },
  section: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  sectionTitulo: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  empty: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, fontStyle: 'italic' },
  itemCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemConcepto: { ...TYPOGRAPHY.bodyMd, color: COLORS.primary, fontWeight: '700' },
  itemDesc: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemLabel: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1 },
  inputValor: {
    minWidth: 120,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    textAlign: 'right',
  },
  inputGlosa: {
    flex: 2,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  btnEliminar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  btnEliminarPressed: { backgroundColor: COLORS.errorContainer },
  catalogoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  chipPressed: { backgroundColor: COLORS.primaryContainer },
  chipDisabled: { opacity: 0.4 },
  chipTexto: { ...TYPOGRAPHY.labelSm, color: COLORS.primary, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  btnCancelar: {
    flex: 1,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outline,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  btnCancelarPressed: { backgroundColor: COLORS.surfaceLight },
  btnCancelarTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.primary },
  btnGuardar: {
    flex: 1,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  btnGuardarPressed: { opacity: 0.85 },
  btnGuardarTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '700' },
});
