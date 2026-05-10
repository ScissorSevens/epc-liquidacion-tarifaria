import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { crearMedidor } from '@dominio/medidores';
import { crearSuscriptor } from '@dominio/suscriptores';
import { getBootstrap } from '../composition/get-bootstrap';
import { persistirYEncolarAltaSuscriptor } from '../adapters/persistir-y-encolar-alta-suscriptor';
import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = ConfigStackScreenProps<'AltaSuscriptor'>;

function siguienteCodigo(maxCodigo: string | null | undefined): string {
  const n = maxCodigo ? Number.parseInt(maxCodigo, 10) : 0;
  return String(n + 1).padStart(4, '0');
}

function codigoANumeroMedidor(codigo: string): string {
  return `MED-${codigo}`;
}

type EstratoStr = '' | '1' | '2' | '3' | '4' | '5' | '6';

interface FormState {
  nombre_apellidos: string;
  direccion: string;
  estrato: EstratoStr;
  aplica_subsidio: boolean;
  matricula_inmobiliaria: string;
  numero_catastral: string;
  fecha_instalacion: string;
  observaciones_medidor: string;
}

type CampoForm = keyof FormState;
type Errores = Partial<Record<CampoForm, string>>;
type SnackTipo = 'ok' | 'error' | 'warning';

interface SnackState {
  visible: boolean;
  mensaje: string;
  tipo: SnackTipo;
}

const ESTADO_INICIAL: FormState = {
  nombre_apellidos: '',
  direccion: '',
  estrato: '',
  aplica_subsidio: true,
  matricula_inmobiliaria: '',
  numero_catastral: '',
  fecha_instalacion: '',
  observaciones_medidor: '',
};

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const HEADER_HEIGHT = 56;
const BOTTOM_HEIGHT = 88;

function validarCampo(nombre: CampoForm, valor: string | boolean): string | undefined {
  if (nombre === 'aplica_subsidio') return undefined;
  const v = valor as string;
  switch (nombre) {
    case 'nombre_apellidos': {
      const t = v.trim();
      if (t.length === 0) return 'Nombre obligatorio';
      if (t.length < 3) return 'Nombre obligatorio (mín 3 caracteres)';
      if (t.length > 150) return 'Nombre no puede superar 150 caracteres';
      return undefined;
    }

    case 'direccion': {
      const t = v.trim();
      if (t.length === 0) return 'Dirección obligatoria';
      if (t.length < 3) return 'Dirección obligatoria (mín 3 caracteres)';
      if (t.length > 200) return 'Dirección no puede superar 200 caracteres';
      return undefined;
    }

    case 'estrato':
      if (v === '') return 'Estrato obligatorio';
      return undefined;

    case 'matricula_inmobiliaria':
      if (v.length > 50) return 'Matrícula no puede superar 50 caracteres';
      return undefined;

    case 'numero_catastral':
      if (v.length > 50) return 'N° catastral no puede superar 50 caracteres';
      return undefined;

    case 'fecha_instalacion': {
      const t = v.trim();
      if (t.length === 0) return 'Fecha de instalación obligatoria';
      if (!REGEX_FECHA.test(t)) return 'Formato YYYY-MM-DD';
      const parsed = new Date(`${t}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return 'Fecha inválida';
      if (parsed.toISOString().slice(0, 10) !== t) return 'Fecha inválida';
      const hoy = new Date().toISOString().slice(0, 10);
      if (t > hoy) return 'Fecha no puede ser futura';
      return undefined;
    }

    case 'observaciones_medidor':
      if (v.length > 500) return 'Observaciones no puede superar 500 caracteres';
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Pantalla de alta combinada: crea Suscriptor + Medidor en un solo flujo.
 *
 * Persistencia atomica: validamos duplicados ANTES de crear nada (codigo
 * de suscriptor y numero de medidor). Si el medidor falla despues del
 * suscriptor, intentamos compensar con `eliminar()` - hoy stubeado, asi
 * que dejamos huerfano y avisamos al usuario.
 *
 * No hay TDD para esta pantalla (excepcion explicita para UI mobile, ver
 * AGENTS.md). Validacion manual: ver checklist al final del PR.
 */
export default function AltaSuscriptor({ navigation }: Props) {
  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [snack, setSnack] = useState<SnackState>({
    visible: false,
    mensaje: '',
    tipo: 'ok',
  });

  useEffect(() => {
    return () => {
      setForm(ESTADO_INICIAL);
      setErrores({});
    };
  }, []);

  function setCampo<K extends CampoForm>(campo: K, valor: FormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function onBlur(campo: CampoForm) {
    const val = form[campo];
    const msg = validarCampo(campo, val as string);
    setErrores((prev) => {
      const next = { ...prev };
      if (msg === undefined) delete next[campo];
      else next[campo] = msg;
      return next;
    });
  }

  function validarTodo(): boolean {
    const next: Errores = {};
    (Object.keys(form) as CampoForm[]).forEach((c) => {
      const msg = validarCampo(c, form[c] as string);
      if (msg !== undefined) next[c] = msg;
    });
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function mostrarSnack(mensaje: string, tipo: SnackTipo) {
    setSnack({ visible: true, mensaje, tipo });
  }

  async function onSubmit() {
    if (!validarTodo()) {
      mostrarSnack('Revisá los campos marcados', 'error');
      return;
    }
    setEnviando(true);
    try {
      const bs = await getBootstrap();

      const codigoGenerado = siguienteCodigo(await bs.suscriptorRepo.maxCodigo());
      const numeroMedidorGenerado = codigoANumeroMedidor(codigoGenerado);

      const estratoNum = Number.parseInt(form.estrato, 10) as 1 | 2 | 3 | 4 | 5 | 6;

      const borradorSus = crearSuscriptor({
        codigo: codigoGenerado,
        nombre_apellidos: form.nombre_apellidos.trim(),
        direccion: form.direccion.trim(),
        estrato: estratoNum,
        aplica_subsidio: form.aplica_subsidio,
        matricula_inmobiliaria:
          form.matricula_inmobiliaria.trim() === ''
            ? undefined
            : form.matricula_inmobiliaria.trim(),
        numero_catastral:
          form.numero_catastral.trim() === ''
            ? undefined
            : form.numero_catastral.trim(),
      });

      const sus = await (async () => {
        try {
          const borradorMed = crearMedidor({
            numero_medidor: numeroMedidorGenerado,
            id_suscriptor: 0,
            fecha_instalacion: form.fecha_instalacion.trim(),
            observaciones:
              form.observaciones_medidor.trim() === ''
                ? undefined
                : form.observaciones_medidor.trim(),
          });
          const { id_suscriptor: _ignored, ...borradorMedSinSus } = borradorMed;

          const out = await persistirYEncolarAltaSuscriptor({
            borradorSuscriptor: borradorSus,
            borradorMedidor: borradorMedSinSus,
            suscriptorRepo: bs.suscriptorRepo,
            medidorRepo: bs.medidorRepo,
            colaRepo: bs.colaRepo,
            idGenerator: bs.idGenerator,
            hasher: bs.hasher,
          });
          return out.suscriptor;
        } catch (errAlta) {
          const msg = errAlta instanceof Error ? errAlta.message : String(errAlta);
          mostrarSnack(`Error al crear medidor: ${msg}`, 'error');
          return null;
        }
      })();

      if (sus === null) return;

      mostrarSnack('Suscriptor y medidor creados correctamente', 'ok');
      setTimeout(() => {
        navigation.navigate('Lecturas', {
          screen: 'DetalleSuscriptor',
          params: { id_suscriptor: sus.id_suscriptor },
        });
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[AltaSuscriptor] error inesperado:', err);
      mostrarSnack(`Error inesperado: ${msg}`, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Header brutalist */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={enviando}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressedDark]}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>NUEVO SUSCRIPTOR</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sección 1 — Datos del Suscriptor */}
          <Text style={styles.seccionTitulo}>DATOS DEL SUSCRIPTOR</Text>

          <Text style={styles.autoGenInfo}>
            Código y número de medidor se asignan automáticamente.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOMBRE Y APELLIDOS *</Text>
            <TextInput
              style={[styles.input, errores.nombre_apellidos !== undefined && styles.inputError]}
              value={form.nombre_apellidos}
              onChangeText={(v) => setCampo('nombre_apellidos', v)}
              onBlur={() => onBlur('nombre_apellidos')}
              maxLength={150}
              editable={!enviando}
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.nombre_apellidos !== undefined && (
              <Text style={styles.errorText}>{errores.nombre_apellidos}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DIRECCIÓN *</Text>
            <TextInput
              style={[styles.input, errores.direccion !== undefined && styles.inputError]}
              value={form.direccion}
              onChangeText={(v) => setCampo('direccion', v)}
              onBlur={() => onBlur('direccion')}
              maxLength={200}
              editable={!enviando}
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.direccion !== undefined && (
              <Text style={styles.errorText}>{errores.direccion}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ESTRATO *</Text>
            <View style={styles.chipsRow}>
              {(['1', '2', '3', '4', '5', '6'] as EstratoStr[]).map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    setCampo('estrato', e);
                    const msg = validarCampo('estrato', e);
                    setErrores((prev) => {
                      const next = { ...prev };
                      if (msg === undefined) delete next.estrato;
                      else next.estrato = msg;
                      return next;
                    });
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    form.estrato === e && styles.chipSel,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={[styles.chipText, form.estrato === e && styles.chipTextSel]}>
                    {e}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errores.estrato !== undefined && (
              <Text style={styles.errorText}>{errores.estrato}</Text>
            )}
          </View>

          {/* Toggle aplica_subsidio */}
          <Pressable
            onPress={() => setCampo('aplica_subsidio', !form.aplica_subsidio)}
            style={styles.toggleRow}
          >
            <View style={[styles.toggleBox, form.aplica_subsidio && styles.toggleBoxOn]}>
              {form.aplica_subsidio && <Text style={styles.toggleCheck}>✓</Text>}
            </View>
            <View style={styles.toggleTexts}>
              <Text style={styles.toggleLabel}>APLICA SUBSIDIO</Text>
              <Text style={styles.toggleHint}>
                El suscriptor se acoge al subsidio por estrato
              </Text>
            </View>
          </Pressable>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>MATRÍCULA INMOBILIARIA</Text>
            <TextInput
              style={[styles.input, errores.matricula_inmobiliaria !== undefined && styles.inputError]}
              value={form.matricula_inmobiliaria}
              onChangeText={(v) => setCampo('matricula_inmobiliaria', v)}
              onBlur={() => onBlur('matricula_inmobiliaria')}
              maxLength={50}
              editable={!enviando}
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.matricula_inmobiliaria !== undefined && (
              <Text style={styles.errorText}>{errores.matricula_inmobiliaria}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NÚMERO CATASTRAL</Text>
            <TextInput
              style={[styles.input, errores.numero_catastral !== undefined && styles.inputError]}
              value={form.numero_catastral}
              onChangeText={(v) => setCampo('numero_catastral', v)}
              onBlur={() => onBlur('numero_catastral')}
              maxLength={50}
              editable={!enviando}
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.numero_catastral !== undefined && (
              <Text style={styles.errorText}>{errores.numero_catastral}</Text>
            )}
          </View>

          <View style={styles.separador} />

          {/* Sección 2 — Datos del Medidor */}
          <Text style={styles.seccionTitulo}>DATOS DEL MEDIDOR</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FECHA DE INSTALACIÓN *</Text>
            <TextInput
              style={[styles.input, errores.fecha_instalacion !== undefined && styles.inputError]}
              value={form.fecha_instalacion}
              onChangeText={(v) => setCampo('fecha_instalacion', v)}
              onBlur={() => onBlur('fecha_instalacion')}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              editable={!enviando}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.fecha_instalacion !== undefined && (
              <Text style={styles.errorText}>{errores.fecha_instalacion}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>OBSERVACIONES DEL MEDIDOR</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                errores.observaciones_medidor !== undefined && styles.inputError,
              ]}
              value={form.observaciones_medidor}
              onChangeText={(v) => setCampo('observaciones_medidor', v)}
              onBlur={() => onBlur('observaciones_medidor')}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!enviando}
              placeholderTextColor={COLORS.placeholder}
            />
            {errores.observaciones_medidor !== undefined && (
              <Text style={styles.errorText}>{errores.observaciones_medidor}</Text>
            )}
          </View>

          <Text style={styles.brandFooter}>MEDIAPP V1.0.4 - MODO OFFLINE</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Snack inline */}
      {snack.visible && (
        <Pressable
          onPress={() => setSnack((s) => ({ ...s, visible: false }))}
          style={[
            styles.snackBox,
            snack.tipo === 'error'
              ? styles.snackError
              : snack.tipo === 'warning'
                ? styles.snackWarning
                : styles.snackOk,
          ]}
        >
          <Text
            style={[styles.snackText, snack.tipo === 'error' && styles.snackTextError]}
          >
            {snack.mensaje}
          </Text>
          <Text style={styles.snackClose}>×</Text>
        </Pressable>
      )}

      {/* Bottom bar fijo */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={enviando}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedLight]}
        >
          <Text style={styles.btnSecondaryText}>CANCELAR</Text>
        </Pressable>
        <Pressable
          onPress={() => void onSubmit()}
          disabled={enviando}
          style={({ pressed }) => [
            styles.btnPrimary,
            enviando && styles.btnDisabled,
            pressed && styles.pressedDark,
          ]}
        >
          {enviando ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>GUARDAR</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },

  // Header
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    ...BORDERS.thick,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: COLORS.background,
  },
  headerBtn: {
    width: HEADER_HEIGHT,
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
    lineHeight: HEADER_HEIGHT,
  },
  headerTitle: {
    flex: 1,
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },

  // Scroll
  scroll: {
    padding: SPACING.md,
    paddingBottom: BOTTOM_HEIGHT + SPACING.lg,
  },

  // Sección título
  seccionTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },

  // Separador
  separador: {
    height: 1,
    backgroundColor: COLORS.outline,
    marginVertical: SPACING.lg,
  },

  // Campos
  fieldGroup: { marginBottom: SPACING.md },
  autoGenInfo: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  input: {
    ...BORDERS.thin,
    borderRadius: RADIUS.none,
    padding: SPACING.sm,
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },

  // Chips estrato
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    ...BORDERS.thin,
    borderRadius: RADIUS.none,
    backgroundColor: COLORS.background,
  },
  chipSel: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  chipTextSel: {
    color: COLORS.onPrimary,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  toggleBox: {
    width: 24,
    height: 24,
    ...BORDERS.thin,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  toggleBoxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleCheck: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  toggleTexts: { flex: 1 },
  toggleLabel: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  toggleHint: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Brand footer
  brandFooter: {
    ...TYPOGRAPHY.labelSm,
    fontSize: 8,
    color: COLORS.textTertiary,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: SPACING.lg,
  },

  // Snack inline
  snackBox: {
    position: 'absolute',
    bottom: BOTTOM_HEIGHT + SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  snackOk: { backgroundColor: '#2e7d32' },
  snackWarning: { backgroundColor: '#ef6c00' },
  snackError: { backgroundColor: '#c62828' },
  snackText: {
    flex: 1,
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onPrimary,
  },
  snackTextError: { color: COLORS.onPrimary },
  snackClose: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
  },

  // Bottom bar
  bottomBar: {
    height: BOTTOM_HEIGHT,
    flexDirection: 'row',
    ...BORDERS.thick,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    ...BORDERS.thin,
    borderRadius: RADIUS.none,
  },
  btnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  btnPrimary: {
    flex: 2,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.none,
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    letterSpacing: 1,
  },
  btnDisabled: {
    backgroundColor: COLORS.textSecondary,
  },

  // Press states
  pressedLight: { opacity: 0.6 },
  pressedDark: { opacity: 0.75 },
});
