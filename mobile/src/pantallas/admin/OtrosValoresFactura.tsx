/**
 * Pantalla admin: edicion de otros_valores y saldo_anterior para una factura.
 *
 * Res CRA 1038/2026: el sistema debe poder agregar conceptos autorizados
 * (Reconexion, Financiacion, etc.) y arrastrar saldo de periodos previos
 * ANTES de emitir la factura. Esta pantalla es el editor admin que
 * prepara esos datos — la persistencia la hace el caller via `onGuardar`.
 *
 * Refactor `factura-compliance-cleanup` Task 8: la pantalla se splittea
 * en sub-componentes:
 *  - `ListaOtrosValores` (carpeta `OtrosValoresFactura/`) — render de
 *    la lista de conceptos aplicados.
 *  - `OtroValorItem` (carpeta `OtrosValoresFactura/`) — render de
 *    cada item individual.
 * El orquestador `OtrosValoresFactura.tsx` mantiene el estado
 * (otrosValores, saldoAnterior, catalogo) y delega el render a
 * los sub-componentes. Comportamiento preservado 1:1.
 *
 * Cambio introducido en `factura-compliance-hardening` Task 8: el catalogo
 * de conceptos se carga desde `ConceptoOtroValorRepository` (tabla SQLite
 * `concepto_otro_valor`, version regulatoria `1038-2026-v1`) en vez de la
 * constante hardcoded `OtrosValoresCatalogo`. Esto permite:
 *  - Cambio de norma → nueva migration 022 con la lista actualizada, sin
 *    redeploy.
 *  - Conceptos se pueden desactivar (`activo=false`) por regulatoria,
 *    permaneciendo visibles solo al auditor (legacy: solo activos visibles).
 *  - Auditoria: cada concepto lleva `version` y `created_at`.
 *
 * UI:
 *  - Lista actual de otros_valores (sub-componente `ListaOtrosValores`).
 *  - Selector de catalogo con los N conceptos seed vigentes.
 *  - Input para saldo_anterior (default 0).
 *  - Botones guardar / cancelar.
 *  - Estado de carga (`ActivityIndicator`) mientras `repo.listar()` esta
 *    en flight.
 *  - Estado de error accionable si `repo.listar()` lanza.
 *
 * Touch targets ≥ 44px (WCAG 2.5.5) en todos los controles.
 *
 * Esta pantalla es CONTROLLED: no toca persistencia. Espera que el
 * caller provea `onGuardar` con los datos finales. Asi es testeable y
 * reusable (ej: como pantalla admin por prestador, o embebida en un
 * wizard de edicion).
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getBootstrap } from '../../composition/get-bootstrap';
import type { ConceptoOtroValor, CodigoConceptoOtroValor } from '@dominio/concepto-otro-valor';
import type { OtroValor } from '@dominio/factura';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../theme/skeletal-tokens';
import { SeccionForm } from '../../componentes/SeccionForm';
import ListaOtrosValores from './OtrosValoresFactura/ListaOtrosValores';

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

type EstadoCatalogo =
  | { readonly tipo: 'cargando' }
  | {
      readonly tipo: 'listo';
      readonly catalogo: readonly ConceptoOtroValor[];
    }
  | { readonly tipo: 'error'; readonly mensaje: string };

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
  const [estado, setEstado] = useState<EstadoCatalogo>({ tipo: 'cargando' });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const bootstrap = await getBootstrap();
        const conceptos = await bootstrap.repos.conceptoOtroValorRepo.listar(true);
        // Solo activos (`activo=true`) — la UI los renderiza como opciones
        // elegibles. Conceptos `activo=false` quedan ocultos (auditable via DB).
        if (!cancelado) {
          setEstado({ tipo: 'listo', catalogo: conceptos });
        }
      } catch (e) {
        if (!cancelado) {
          const mensaje = e instanceof Error ? e.message : String(e);
          setEstado({ tipo: 'error', mensaje });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function agregarConcepto(concepto: string): void {
    if (otrosValores.some((ov) => ov.concepto === concepto)) return;
    if (estado.tipo !== 'listo') return;
    const meta = estado.catalogo.find((c) => c.codigo === concepto);
    // El codigo viene del catalogo validado (repo), asi que es seguro
    // castear a `CodigoConceptoOtroValor` que es el union de los 7
    // codigos canonicos Res CRA 1038/2026.
    const codigo = concepto as CodigoConceptoOtroValor;
    if (meta?.requiereGlosa) {
      setOtrosValores((prev) => [...prev, { concepto: codigo, valor: 0, glosa: '' }]);
    } else {
      setOtrosValores((prev) => [...prev, { concepto: codigo, valor: 0 }]);
    }
  }

  function eliminarConcepto(concepto: string): void {
    setOtrosValores((prev) => prev.filter((ov) => ov.concepto !== concepto));
  }

  function editarValor(concepto: string, texto: string): void {
    const valor = parseFloat(texto);
    setOtrosValores((prev) =>
      prev.map((ov) =>
        ov.concepto === concepto
          ? { ...ov, valor: Number.isFinite(valor) && valor >= 0 ? valor : 0 }
          : ov,
      ),
    );
  }

  function editarGlosa(concepto: string, texto: string): void {
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

  function reintentar(): void {
    setEstado({ tipo: 'cargando' });
    void estado;
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

      {/* Lista de otros_valores actuales (sub-componente) */}
      <ListaOtrosValores
        otrosValores={otrosValores}
        catalogo={estado.tipo === 'listo' ? estado.catalogo : []}
        onEliminar={eliminarConcepto}
        onEditarValor={editarValor}
        onEditarGlosa={editarGlosa}
      />

      {/* Selector de catalogo */}
      <SeccionForm titulo="Agregar concepto del catálogo">
        {estado.tipo === 'cargando' && (
          <View style={styles.loadingContainer} testID="catalogo-loading">
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.sub}>Cargando catálogo regulatorio...</Text>
          </View>
        )}
        {estado.tipo === 'error' && (
          <View style={styles.errorContainer} testID="catalogo-error">
            <Text style={styles.errorMensaje}>{estado.mensaje}</Text>
            <Pressable
              onPress={reintentar}
              style={({ pressed }) => [styles.btnReintentar, pressed && styles.btnReintentarPressed]}
            >
              <Text style={styles.btnReintentarTexto}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {estado.tipo === 'listo' && (
          <View style={styles.catalogoGrid}>
            {estado.catalogo.map((c) => (
              <Pressable
                key={c.codigo}
                testID={`catalogo-${c.codigo}`}
                onPress={() => agregarConcepto(c.codigo)}
                disabled={otrosValores.some((ov) => ov.concepto === c.codigo)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.chipPressed,
                  otrosValores.some((ov) => ov.concepto === c.codigo) && styles.chipDisabled,
                ]}
                hitSlop={8}
              >
                <Text style={styles.chipTexto}>{c.codigo}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SeccionForm>

      {/* Saldo anterior */}
      <SeccionForm titulo="Saldo anterior">
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
      </SeccionForm>

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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemLabel: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1 },
  inputValor: {
    minWidth: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    textAlign: 'right',
  },
  catalogoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
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
    minHeight: TOUCH_TARGET,
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
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  btnGuardarPressed: { opacity: 0.85 },
  btnGuardarTexto: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '700' },
  loadingContainer: { gap: SPACING.xs, alignItems: 'center', paddingVertical: SPACING.md },
  errorContainer: { gap: SPACING.xs, paddingVertical: SPACING.md },
  errorMensaje: { ...TYPOGRAPHY.bodySm, color: COLORS.error },
  btnReintentar: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.errorContainer,
    paddingHorizontal: SPACING.md,
  },
  btnReintentarPressed: { opacity: 0.7 },
  btnReintentarTexto: { ...TYPOGRAPHY.labelMd, color: COLORS.onErrorContainer, fontWeight: '700' },
});
