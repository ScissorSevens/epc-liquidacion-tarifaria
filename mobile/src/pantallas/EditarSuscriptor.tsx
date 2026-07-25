import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { ActualizarSuscriptorInput, EstadoSuscriptor, Suscriptor } from '@dominio/suscriptores/types';
import { CATEGORIAS_USO, ETIQUETAS_CATEGORIA_USO, type CategoriaUso } from '@dominio/categorias-uso';
import { editarYEncolarSuscriptor } from '../adapters/editar-y-encolar-suscriptor';
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

// ─── Tipos locales ─────────────────────────────────────────────────────────────

type EstratoStr = '' | '1' | '2' | '3' | '4' | '5' | '6';

interface FormEditarState {
  nombre_apellidos: string;
  municipio: string;
  sector: string;
  direccion: string;
  estrato: EstratoStr;
  categoria_uso: CategoriaUso;
  matricula_inmobiliaria: string;
  numero_catastral: string;
  estado: EstadoSuscriptor;
  aplica_subsidio: boolean;
}

interface SnackState {
  visible: boolean;
  mensaje: string;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const BOTTOM_HEIGHT = 80;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function initForm(sus: Suscriptor): FormEditarState {
  return {
    nombre_apellidos: sus.nombre_apellidos,
    municipio: sus.municipio,
    sector: sus.sector ?? '',
    direccion: sus.direccion,
    estrato: String(sus.estrato) as EstratoStr,
    categoria_uso: sus.categoria_uso,
    matricula_inmobiliaria: sus.matricula_inmobiliaria ?? '',
    numero_catastral: sus.numero_catastral ?? '',
    estado: sus.estado,
    aplica_subsidio: sus.aplica_subsidio,
  };
}

// ─── Componente ────────────────────────────────────────────────────────────────

type Props = LecturasStackScreenProps<'EditarSuscriptor'>;

/**
 * Formulario de edicion de suscriptor. Pre-poblado con los valores actuales.
 *
 * - `cedula` se muestra read-only (no editable — campo de identidad).
 * - `estrato` y `estado` usan chips Pressable (patron AltaSuscriptor).
 * - GUARDAR deshabilitado si campos obligatorios estan vacios o hay envio en curso.
 * - Offline-first: escribe en SQLite → encola para sync posterior.
 */
export default function EditarSuscriptor({ navigation, route }: Props) {
  const { suscriptor } = route.params;
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormEditarState>(() => initForm(suscriptor));
  const [enviando, setEnviando] = useState(false);
  const [snack, setSnack] = useState<SnackState>({ visible: false, mensaje: '' });

  // Validacion minima: campos obligatorios no vacios
  const esValido =
    form.nombre_apellidos.trim().length >= 3 &&
    form.municipio.trim().length > 0 &&
    form.direccion.trim().length >= 3 &&
    form.estrato !== '';

  function setCampo<K extends keyof FormEditarState>(campo: K, valor: FormEditarState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function onGuardar() {
    if (!esValido || enviando) return;
    setEnviando(true);
    try {
      const { suscriptorRepo, colaRepo, idGenerator, hasher } = await getBootstrap();
      const cambios: ActualizarSuscriptorInput = {
        nombre_apellidos: form.nombre_apellidos.trim(),
        municipio: form.municipio.trim(),
        sector: form.sector.trim() || undefined,
        direccion: form.direccion.trim(),
        estrato: Number(form.estrato) as Suscriptor['estrato'],
        categoria_uso: form.categoria_uso,
        matricula_inmobiliaria: form.matricula_inmobiliaria.trim() || undefined,
        numero_catastral: form.numero_catastral.trim() || undefined,
        estado: form.estado,
        aplica_subsidio: form.aplica_subsidio,
      };
      await editarYEncolarSuscriptor({
        idSuscriptor: suscriptor.id_suscriptor,
        cambios,
        suscriptorRepo,
        colaRepo,
        idGenerator,
        hasher,
      });
      navigation.navigate('DetalleSuscriptor', { id_suscriptor: suscriptor.id_suscriptor });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[EditarSuscriptor] error al guardar:', err);
      setSnack({ visible: true, mensaje: 'Error al guardar. Intentar de nuevo.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.root}>
      <TopBar titulo="Editar suscriptor" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Sección 1: Datos personales ── */}
          <View style={styles.seccion}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="person" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>
                Datos Personales
              </Text>
            </View>

            {/* Cédula — solo lectura */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cédula</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{suscriptor.cedula}</Text>
              </View>
              <Text style={styles.helperText}>El número de cédula no es editable</Text>
            </View>

            {/* Nombre y apellidos */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre y apellidos</Text>
              <TextInput
                style={styles.input}
                value={form.nombre_apellidos}
                onChangeText={(v) => setCampo('nombre_apellidos', v)}
                placeholder="Ej: Juan Pérez"
                maxLength={150}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>

            {/* Estrato */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Estrato</Text>
              <View style={styles.chipsRow}>
                {(['1', '2', '3', '4', '5', '6'] as EstratoStr[]).map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setCampo('estrato', e)}
                    style={({ pressed }) => [
                      styles.chip,
                      form.estrato === e && styles.chipSel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, form.estrato === e && styles.chipTextSel]}>
                      {e}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Categoría de uso (Q10 spec, multi-tenant) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Categoría de uso</Text>
              <View style={styles.chipsRowCategoria}>
                {CATEGORIAS_USO.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCampo('categoria_uso', cat)}
                    style={({ pressed }) => [
                      styles.chipCategoria,
                      form.categoria_uso === cat && styles.chipSel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipTextSm,
                        form.categoria_uso === cat && styles.chipTextSel,
                      ]}
                    >
                      {ETIQUETAS_CATEGORIA_USO[cat]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helperTextCategoria}>
                Define cómo el motor tarifario aplica subsidios o contribuciones.
              </Text>
            </View>

            {/* Estado */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Estado</Text>
              <View style={styles.chipsRowEstado}>
                {(['activo', 'inactivo', 'suspendido'] as EstadoSuscriptor[]).map((est) => (
                  <Pressable
                    key={est}
                    onPress={() => setCampo('estado', est)}
                    style={({ pressed }) => [
                      styles.chipEstado,
                      form.estado === est && styles.chipSel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, form.estado === est && styles.chipTextSel]}>
                      {est.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Toggle subsidio (cambia post-creación) */}
            <View style={styles.toggleRow}>
              <Text style={[TYPOGRAPHY.bodyMd, styles.toggleLabel]}>¿Aplica subsidio?</Text>
              <Switch
                value={form.aplica_subsidio}
                onValueChange={(v) => setCampo('aplica_subsidio', v)}
                trackColor={{ false: COLORS.surfaceVariant, true: COLORS.secondaryContainer }}
                thumbColor={COLORS.surfaceContainerLowest}
                disabled={enviando}
              />
            </View>
          </View>

          {/* ── Sección 2: Ubicación ── */}
          <View style={[styles.seccion, styles.seccionLow]}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>Ubicación</Text>
            </View>

            {/* Municipio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Municipio</Text>
              <TextInput
                style={styles.input}
                value={form.municipio}
                onChangeText={(v) => setCampo('municipio', v)}
                placeholder="Ej: Bogotá"
                maxLength={100}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>

            {/* Dirección */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dirección</Text>
              <TextInput
                style={styles.input}
                value={form.direccion}
                onChangeText={(v) => setCampo('direccion', v)}
                placeholder="Calle, Carrera, Vereda o Sector"
                maxLength={200}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>

            {/* Sector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Sector <Text style={styles.opcional}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.sector}
                onChangeText={(v) => setCampo('sector', v)}
                placeholder="Ej: Centro, Zona Industrial"
                maxLength={100}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>
          </View>

          {/* ── Sección 3: Datos Legales ── */}
          <View style={[styles.seccion, styles.seccionLow]}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="gavel" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>Datos Legales</Text>
            </View>

            {/* Matrícula inmobiliaria */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Matrícula inmobiliaria <Text style={styles.opcional}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.matricula_inmobiliaria}
                onChangeText={(v) => setCampo('matricula_inmobiliaria', v)}
                maxLength={50}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>

            {/* Número catastral */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Número catastral <Text style={styles.opcional}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={form.numero_catastral}
                onChangeText={(v) => setCampo('numero_catastral', v)}
                maxLength={50}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
            </View>
          </View>

          <FooterApp />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Snack inline */}
      {snack.visible && (
        <Pressable
          onPress={() => setSnack((s) => ({ ...s, visible: false }))}
          style={styles.snackBox}
        >
          <Text style={styles.snackText}>{snack.mensaje}</Text>
          <Text style={styles.snackClose}>×</Text>
        </Pressable>
      )}

      {/* Bottom bar fijo */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || SPACING.md }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={enviando}
          style={({ pressed }) => [styles.btnCancelar, pressed && styles.pressed]}
        >
          <Text style={styles.btnCancelarText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => void onGuardar()}
          disabled={!esValido || enviando}
          style={({ pressed }) => [
            styles.btnGuardar,
            (!esValido || enviando) && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          {enviando ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <Text style={styles.btnGuardarText}>Guardar cambios</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: BOTTOM_HEIGHT + SPACING.xl,
    gap: SPACING.md,
  },

  // ── Secciones ──────────────────────────────────────────────────────────────
  seccion: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  seccionLow: {
    backgroundColor: COLORS.surfaceLight,
  },
  seccionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  seccionTitulo: {
    color: COLORS.primary,
  },

  // ── Campos ─────────────────────────────────────────────────────────────────
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
  },

  // Campo read-only (cédula)
  readonlyField: {
    height: 48,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  readonlyText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
  },
  helperText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
  },
  opcional: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
  },

  // ── Chips estrato ──────────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  chipSel: {
    backgroundColor: COLORS.secondaryContainer,
    borderColor: COLORS.secondaryContainer,
  },
  chipText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  chipTextSel: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── Chips estado (3 opciones — ancho proporcional) ─────────────────────────
  chipsRowEstado: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chipEstado: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceContainerLowest,
    paddingHorizontal: SPACING.xs,
  },

  // ── Chips categoria de uso (5 opciones — wrap) ────────────────────────────
  chipsRowCategoria: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chipCategoria: {
    paddingHorizontal: SPACING.md,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  chipTextSm: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
  },
  helperTextCategoria: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Toggle subsidio (cambia post-creación) ────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  toggleLabel: {
    color: COLORS.primary,
  },

  // ── Snack ──────────────────────────────────────────────────────────────────
  snackBox: {
    position: 'absolute',
    bottom: BOTTOM_HEIGHT + SPACING.md,
    left: SPACING.margin,
    right: SPACING.margin,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.error,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  snackText: {
    flex: 1,
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onPrimary,
  },
  snackClose: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
  },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    minHeight: BOTTOM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  btnCancelar: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    backgroundColor: 'transparent',
  },
  btnCancelarText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  btnGuardar: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: RADIUS.lg,
    elevation: 4,
    shadowColor: COLORS.primaryContainer,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  btnGuardarText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
  },
  btnDisabled: {
    backgroundColor: COLORS.onSurfaceVariant,
    opacity: 0.5,
    elevation: 0,
  },

  pressed: { opacity: 0.7 },
});
