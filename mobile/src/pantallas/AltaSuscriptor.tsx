import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FechaPicker from '../components/FechaPicker';
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

import { crearSuscriptor, MENSAJES_ERROR_SUSCRIPTOR } from '@dominio/suscriptores';
import {
  CATEGORIAS_USO,
  ETIQUETAS_CATEGORIA_USO,
  type CategoriaUso,
} from '@dominio/categorias-uso';
import { logger } from '../composicion/logger';
import type { MedidorBorradorSinSuscriptor } from '../adapters/persistir-y-encolar-alta-suscriptor';
import { getBootstrap } from '../composition/get-bootstrap';
import { persistirYEncolarAltaSuscriptor } from '../adapters/persistir-y-encolar-alta-suscriptor';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { ConfigStackScreenProps } from '../navegacion/types';
import {
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
  cedula: string;
  municipio: string;
  sector: string;
  calle: string;
  direccion: string;
  estrato: EstratoStr;
  aplica_subsidio: boolean;
  categoria_uso: CategoriaUso;
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
  cedula: '',
  municipio: '',
  sector: '',
  calle: '',
  direccion: '',
  estrato: '',
  aplica_subsidio: true,
  categoria_uso: 'residencial',
  matricula_inmobiliaria: '',
  numero_catastral: '',
  fecha_instalacion: '',
  observaciones_medidor: '',
};

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const BOTTOM_HEIGHT = 80;

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

    case 'cedula': {
      const t = v.trim();
      if (t.length === 0) return MENSAJES_ERROR_SUSCRIPTOR.CEDULA_VACIA;
      if (!/^\d{6,12}$/.test(t)) return MENSAJES_ERROR_SUSCRIPTOR.CEDULA_INVALIDA;
      return undefined;
    }

    case 'municipio': {
      const t = v.trim();
      if (t.length === 0) return MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_VACIO;
      if (t.length > 100) return MENSAJES_ERROR_SUSCRIPTOR.MUNICIPIO_LARGO;
      return undefined;
    }

    case 'sector':
      if (v.trim().length > 100) return MENSAJES_ERROR_SUSCRIPTOR.SECTOR_LARGO;
      return undefined;

    case 'calle':
      if (v.trim().length > 100) return MENSAJES_ERROR_SUSCRIPTOR.CALLE_LARGA;
      return undefined;

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
  const insets = useSafeAreaInsets();
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
        cedula: form.cedula.trim(),
        municipio: form.municipio.trim(),
        sector: form.sector.trim() || undefined,
        calle: form.calle.trim() || undefined,
        direccion: form.direccion.trim(),
        estrato: estratoNum,
        aplica_subsidio: form.aplica_subsidio,
        id_prestador: 0,
        categoria_uso: form.categoria_uso,
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
          const borradorMedSinSus: MedidorBorradorSinSuscriptor = {
            numero_medidor: numeroMedidorGenerado,
            fecha_instalacion: form.fecha_instalacion.trim(),
            estado: 'activo',
            observaciones:
              form.observaciones_medidor.trim() === ''
                ? undefined
                : form.observaciones_medidor.trim(),
          };

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
      logger.warn('AltaSuscriptor', 'error inesperado', { err });
      mostrarSnack(`Error inesperado: ${msg}`, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.root}>
      <TopBar titulo="Nuevo suscriptor" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.intro}>
            <Text style={[TYPOGRAPHY.headlineSm, styles.introTitulo]}>Registro de Usuario</Text>
            <Text style={[TYPOGRAPHY.bodySm, styles.introSub]}>
              Complete los datos requeridos para vincular un nuevo predio al sistema.
            </Text>
          </View>

          {/* ── Sección 1: Información Personal ── */}
          <View style={styles.seccion}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="person" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>
                Información Personal
              </Text>
            </View>

            {/* Nombre */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre y apellidos</Text>
              <TextInput
                style={[styles.input, errores.nombre_apellidos !== undefined && styles.inputError]}
                value={form.nombre_apellidos}
                onChangeText={(v) => setCampo('nombre_apellidos', v)}
                onBlur={() => onBlur('nombre_apellidos')}
                placeholder="Ej: Juan Pérez"
                maxLength={150}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.nombre_apellidos !== undefined && (
                <Text style={styles.errorText}>{errores.nombre_apellidos}</Text>
              )}
            </View>

            {/* Cédula */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cédula</Text>
              <TextInput
                style={[styles.input, errores.cedula !== undefined && styles.inputError]}
                value={form.cedula}
                onChangeText={(v) => setCampo('cedula', v)}
                onBlur={() => onBlur('cedula')}
                placeholder="6 a 12 dígitos"
                keyboardType="numeric"
                maxLength={12}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.cedula !== undefined && (
                <Text style={styles.errorText}>{errores.cedula}</Text>
              )}
            </View>

            {/* Dirección */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dirección</Text>
              <TextInput
                style={[styles.input, errores.direccion !== undefined && styles.inputError]}
                value={form.direccion}
                onChangeText={(v) => setCampo('direccion', v)}
                onBlur={() => onBlur('direccion')}
                placeholder="Calle, Carrera, Vereda o Sector"
                maxLength={200}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.direccion !== undefined && (
                <Text style={styles.errorText}>{errores.direccion}</Text>
              )}
            </View>

            {/* Estrato */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Estrato</Text>
              <View style={styles.chipsRow}>
                {(['1', '2', '3', '4', '5', '6'] as EstratoStr[]).map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => {
                      setCampo('estrato', e);
                      setErrores((prev) => {
                        const next = { ...prev };
                        delete next.estrato;
                        return next;
                      });
                    }}
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
              {errores.estrato !== undefined && (
                <Text style={styles.errorText}>{errores.estrato}</Text>
              )}
            </View>

            {/* Toggle subsidio */}
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

            {/* Categoría de uso (multi-tenant Q10 spec) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Categoría de uso</Text>
              <View style={styles.chipsRowCategoria}>
                {CATEGORIAS_USO.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCampo('categoria_uso', cat)}
                    disabled={enviando}
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
                style={[styles.input, errores.municipio !== undefined && styles.inputError]}
                value={form.municipio}
                onChangeText={(v) => setCampo('municipio', v)}
                onBlur={() => onBlur('municipio')}
                placeholder="Ej: Bogotá"
                maxLength={100}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.municipio !== undefined && (
                <Text style={styles.errorText}>{errores.municipio}</Text>
              )}
            </View>

            {/* Sector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sector <Text style={styles.opcional}>(opcional)</Text></Text>
              <TextInput
                style={[styles.input, errores.sector !== undefined && styles.inputError]}
                value={form.sector}
                onChangeText={(v) => setCampo('sector', v)}
                onBlur={() => onBlur('sector')}
                placeholder="Ej: Centro, Zona Industrial"
                maxLength={100}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.sector !== undefined && (
                <Text style={styles.errorText}>{errores.sector}</Text>
              )}
            </View>

            {/* Calle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Calle <Text style={styles.opcional}>(opcional)</Text></Text>
              <TextInput
                style={[styles.input, errores.calle !== undefined && styles.inputError]}
                value={form.calle}
                onChangeText={(v) => setCampo('calle', v)}
                onBlur={() => onBlur('calle')}
                placeholder="Ej: Cra 50 #20-30"
                maxLength={100}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.calle !== undefined && (
                <Text style={styles.errorText}>{errores.calle}</Text>
              )}
            </View>
          </View>

          {/* ── Sección 3: Datos Legales ── */}
          <View style={[styles.seccion, styles.seccionLow]}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="gavel" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>Datos Legales</Text>
            </View>

            {/* Matrícula */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Matrícula inmobiliaria</Text>
              <TextInput
                style={[styles.input, errores.matricula_inmobiliaria !== undefined && styles.inputError]}
                value={form.matricula_inmobiliaria}
                onChangeText={(v) => setCampo('matricula_inmobiliaria', v)}
                onBlur={() => onBlur('matricula_inmobiliaria')}
                maxLength={50}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.matricula_inmobiliaria !== undefined && (
                <Text style={styles.errorText}>{errores.matricula_inmobiliaria}</Text>
              )}
            </View>

            {/* Catastral */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Número catastral</Text>
              <TextInput
                style={[styles.input, errores.numero_catastral !== undefined && styles.inputError]}
                value={form.numero_catastral}
                onChangeText={(v) => setCampo('numero_catastral', v)}
                onBlur={() => onBlur('numero_catastral')}
                maxLength={50}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.numero_catastral !== undefined && (
                <Text style={styles.errorText}>{errores.numero_catastral}</Text>
              )}
            </View>
          </View>

          {/* ── Sección 4: Información del Medidor ── */}
          <View style={styles.seccion}>
            <View style={styles.seccionHeader}>
              <MaterialIcons name="speed" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.headlineSm, styles.seccionTitulo]}>
                Información del Medidor
              </Text>
            </View>

            {/* Fecha instalación */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Fecha de instalación</Text>
              <FechaPicker
                value={form.fecha_instalacion}
                onChange={(v) => setCampo('fecha_instalacion', v)}
                disabled={enviando}
                error={errores.fecha_instalacion !== undefined}
                maxDate={new Date().toISOString().slice(0, 10)}
              />
              {errores.fecha_instalacion !== undefined && (
                <Text style={styles.errorText}>{errores.fecha_instalacion}</Text>
              )}
            </View>

            {/* Observaciones */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Observaciones del medidor</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputMultiline,
                  errores.observaciones_medidor !== undefined && styles.inputError,
                ]}
                value={form.observaciones_medidor}
                onChangeText={(v) => setCampo('observaciones_medidor', v)}
                onBlur={() => onBlur('observaciones_medidor')}
                placeholder="Detalles técnicos, estado inicial o ubicación específica..."
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!enviando}
                placeholderTextColor={COLORS.onSurfaceVariant}
              />
              {errores.observaciones_medidor !== undefined && (
                <Text style={styles.errorText}>{errores.observaciones_medidor}</Text>
              )}
            </View>
          </View>

          <FooterApp />
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
          <Text style={[styles.snackText, snack.tipo === 'error' && styles.snackTextError]}>
            {snack.mensaje}
          </Text>
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
          onPress={() => void onSubmit()}
          disabled={enviando}
          style={({ pressed }) => [
            styles.btnGuardar,
            enviando && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          {enviando ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <Text style={styles.btnGuardarText}>Guardar suscriptor</Text>
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

  // ── Intro ──────────────────────────────────────────────────────────────────
  intro: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  introTitulo: {
    color: COLORS.primary,
  },
  introSub: {
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
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
    backgroundColor: COLORS.surfaceLight, // surface-container-low
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
  inputMultiline: {
    height: undefined,
    minHeight: 96,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
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

  // ── Chips categoria de uso (Q10 spec, 5 opciones) ──────────────────────────
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

  // ── Toggle subsidio ────────────────────────────────────────────────────────
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
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  snackOk: { backgroundColor: COLORS.secondary },
  snackWarning: { backgroundColor: COLORS.warning },
  snackError: { backgroundColor: COLORS.error },
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
