import { useEffect, useMemo, useState } from 'react';
import PeriodoPicker from '../components/PeriodoPicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  liquidarLectura,
  registrarLectura,
} from '@dominio/captura-lecturas/captura-lecturas';
import type {
  EntradaLectura,
  EvidenciaFoto,
} from '@dominio/captura-lecturas/types';
import type { Estrato } from '@dominio/motor-tarifario/types';
import type { Suscriptor } from '@dominio/suscriptores/types';

import { getBootstrap } from '../composition/get-bootstrap';
import { persistirYEncolarLectura } from '../adapters/persistir-y-encolar-lectura';
import { PARAMETROS_TARIFARIOS_DEMO } from '../composition/parametros-tarifarios-demo';
import { photoCaptureStore } from '../composition/photo-capture-store';
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

type Props = LecturasStackScreenProps<'CapturarLectura'>;

interface FormState {
  lectura_anterior: string;
  lectura_actual: string;
  id_periodo: string;
  observaciones: string;
}

type CampoForm = keyof FormState;
type Errores = Partial<Record<CampoForm, string>>;
type SnackTipo = 'ok' | 'error';

interface SnackState {
  visible: boolean;
  mensaje: string;
  tipo: SnackTipo;
}

// Periodo actual en formato YYYYMM segun la zona horaria local del celu.
function periodoActual(): string {
  const d = new Date();
  const anio = d.getFullYear().toString();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${anio}${mes}`;
}

const REGEX_NUMERO = /^\d+(\.\d+)?$/;
const REGEX_PERIODO = /^\d{6}$/;

function validarCampo(nombre: CampoForm, valor: string): string | undefined {
  switch (nombre) {
    case 'lectura_anterior': {
      if (valor.trim() === '') return 'Lectura anterior obligatoria';
      if (!REGEX_NUMERO.test(valor.trim())) return 'Solo numeros (>= 0)';
      if (Number.parseFloat(valor) < 0) return 'No puede ser negativa';
      return undefined;
    }
    case 'lectura_actual': {
      if (valor.trim() === '') return 'Lectura actual obligatoria';
      if (!REGEX_NUMERO.test(valor.trim())) return 'Solo numeros (>= 0)';
      if (Number.parseFloat(valor) < 0) return 'No puede ser negativa';
      return undefined;
    }
    case 'id_periodo': {
      if (valor.trim() === '') return 'Periodo obligatorio';
      if (!REGEX_PERIODO.test(valor.trim())) return 'Formato YYYYMM';
      const anio = Number.parseInt(valor.substring(0, 4), 10);
      const mes = Number.parseInt(valor.substring(4, 6), 10);
      if (anio < 2000) return 'Anio debe ser >= 2000';
      if (mes < 1 || mes > 12) return 'Mes debe estar entre 01 y 12';
      return undefined;
    }
    case 'observaciones':
      if (valor.length > 300) return 'Maximo 300 caracteres';
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Pantalla de captura de lectura + disparo del calculo tarifario.
 *
 * REDISEÑO VISUAL — Skeletal Wireframe System (Stitch).
 * Ver `stitch_mediapp_rural_water_wireframes/3._capturar_lectura/code.html`.
 *
 * NOTA: la LÓGICA es idéntica a la versión anterior con `react-native-paper`.
 * Solo cambian los componentes presentacionales:
 *  - Paper Appbar -> header custom blanco con borde negro.
 *  - Paper TextInput -> RN <TextInput> con borde 1px black, radius 0.
 *  - Paper SegmentedButtons -> chips Pressable estilo pill.
 *  - Paper Button (cámara) -> Pressable con borde dashed.
 *  - Paper Snackbar -> banner inline simple.
 *
 * Flujo (sin cambios):
 *  1) Prellena lectura anterior consultando la ultima lectura conocida
 *     del medidor (si existe) via `lecturaRepo.listar({ id_medidor })`.
 *  2) Carga el Suscriptor via `suscriptorRepo.buscarPorId` para mostrar
 *     nombre + dirección + estado en la card superior. Si falla, placeholders.
 *  3) Construye `EntradaLectura` con `id_operario: 1` (sin módulo de auth).
 *  4) Llama `registrarLectura` y `liquidarLectura` igual que antes.
 *  5) Navega a `ResultadoCalculo` con todo el contexto.
 *  6) Snackbar inline con mensajes del dominio si error.
 */
export default function CapturarLectura({ navigation, route }: Props) {
  const { id_medidor, id_suscriptor } = route.params;

  const [form, setForm] = useState<FormState>({
    lectura_anterior: '',
    lectura_actual: '',
    id_periodo: periodoActual(),
    observaciones: '',
  });
  const [errores, setErrores] = useState<Errores>({});
  const [calculando, setCalculando] = useState(false);
  const [cargandoPrefill, setCargandoPrefill] = useState(true);
  const [evidencia, setEvidencia] = useState<EvidenciaFoto | undefined>(
    undefined,
  );
  const [snack, setSnack] = useState<SnackState>({
    visible: false,
    mensaje: '',
    tipo: 'ok',
  });
  // Campo activo para focus state visual.
  const [campoFocal, setCampoFocal] = useState<CampoForm | null>(null);
  // Datos del suscriptor para mostrar en la card superior. Se carga via
  // `suscriptorRepo.buscarPorId`. Si falla, queda undefined y mostramos "—".
  const [suscriptor, setSuscriptor] = useState<Suscriptor | undefined>(
    undefined,
  );

  // Recibe la evidencia cuando `CapturarFoto` llama `goBack()` y depositó
  // la evidencia en `photoCaptureStore`. El listener de 'focus' garantiza
  // que el componente NUNCA se desmonte y el estado del formulario se preserve.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const ev = photoCaptureStore.getAndClear();
      if (ev !== null) {
        setEvidencia(ev);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Prefill de lectura anterior usando el historial del medidor. Si no
  // hay registros previos asumimos primera lectura y dejamos vacio.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { lecturaRepo } = await getBootstrap();
        const previas = await lecturaRepo.listar({ id_medidor });
        if (cancelado) return;
        if (previas.length > 0) {
          // `listar` ordena por id_lectura ascendente -> ultima es la mas reciente.
          const ultima = previas[previas.length - 1];
          if (ultima !== undefined) {
            setForm((prev) => ({
              ...prev,
              lectura_anterior: String(ultima.lectura_actual),
            }));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CapturarLectura] no se pudo prellenar anterior:', e);
      } finally {
        if (!cancelado) setCargandoPrefill(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id_medidor]);

  // Carga del suscriptor para la card de header. Solo presentación —
  // si falla, dejamos el card con placeholders ("—") y la pantalla sigue
  // siendo funcional. NO bloquea el cálculo.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { suscriptorRepo } = await getBootstrap();
        const s = await suscriptorRepo.buscarPorId(id_suscriptor);
        if (cancelado) return;
        if (s !== null) setSuscriptor(s);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CapturarLectura] no se pudo cargar suscriptor:', e);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id_suscriptor]);

  function setCampo<K extends CampoForm>(campo: K, valor: FormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function onBlur(campo: CampoForm) {
    const msg = validarCampo(campo, form[campo]);
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
      const msg = validarCampo(c, form[c]);
      if (msg !== undefined) next[c] = msg;
    });
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function mostrarSnack(mensaje: string, tipo: SnackTipo) {
    setSnack({ visible: true, mensaje, tipo });
  }

  async function onCalcular() {
    if (!validarTodo()) {
      mostrarSnack('Revisa los campos marcados', 'error');
      return;
    }
    if (suscriptor === undefined) {
      mostrarSnack('Cargando datos del suscriptor, reintentar en un momento', 'error');
      return;
    }
    setCalculando(true);
    try {
      const obs = form.observaciones.trim();
      const entrada: EntradaLectura = {
        id_medidor,
        id_periodo: form.id_periodo.trim(),
        id_operario: 1, // sin módulo de auth activo.
        lectura_actual: Number.parseFloat(form.lectura_actual),
        lectura_anterior: Number.parseFloat(form.lectura_anterior),
        ...(obs !== '' && { observaciones: obs }),
        ...(evidencia !== undefined && { evidencia }),
      };
      const lectura = registrarLectura(entrada);
      const estrato = suscriptor.estrato as Estrato;
      const resultado = liquidarLectura(
        lectura,
        PARAMETROS_TARIFARIOS_DEMO,
        estrato,
      );
      const bootstrap = await getBootstrap();
      await persistirYEncolarLectura({
        lectura,
        lecturaRepo: bootstrap.lecturaRepo,
        colaRepo: bootstrap.colaRepo,
        idGenerator: bootstrap.idGenerator,
        hasher: bootstrap.hasher,
      });
      navigation.navigate('ResultadoCalculo', {
        lectura,
        resultado,
        parametros: PARAMETROS_TARIFARIOS_DEMO,
        estrato,
        id_suscriptor,
      });
    } catch (err) {
      const causa = (err as { cause?: { codigo?: string } })?.cause?.codigo;
      const msg =
        causa === 'RESTRICCION_UNICIDAD'
          ? 'Ya existe una lectura para este medidor en este periodo.'
          : err instanceof Error ? err.message : String(err);
      mostrarSnack(msg, 'error');
    } finally {
      setCalculando(false);
    }
  }

  function abrirCamara() {
    navigation.navigate('CapturarFoto', {
      id_medidor,
      id_periodo: form.id_periodo.trim(),
      id_suscriptor,
    });
  }

  // Estado del badge superior: si conocemos al suscriptor usamos su `estado`,
  // sino fallback "ACTIVO" (el plan acepta esto como demo).
  const badgeTexto = (suscriptor?.estado ?? 'activo').toUpperCase();
  const nombreSuscriptor = suscriptor?.nombre_apellidos ?? '—';
  const direccionSuscriptor = suscriptor?.direccion ?? '—';

  // Última lectura para mostrarla destacada arriba del input.
  const lecturaAnteriorTxt =
    form.lectura_anterior.trim() === ''
      ? '—'
      : `${form.lectura_anterior} m³`;

  const subtitulo = useMemo(
    () => `Suscriptor #${id_suscriptor} — Medidor #${id_medidor}`,
    [id_suscriptor, id_medidor],
  );

  // Warning de consumo inusual: se muestra si el incremento supera 40% del anterior.
  const mostrarWarningConsumo = useMemo(() => {
    const anterior = Number.parseFloat(form.lectura_anterior);
    const actual = Number.parseFloat(form.lectura_actual);
    if (isNaN(anterior) || isNaN(actual) || anterior <= 0) return false;
    const consumo = actual - anterior;
    if (consumo <= 0) return false;
    return consumo / anterior > 0.4;
  }, [form.lectura_anterior, form.lectura_actual]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <TopBar
        titulo="Capturar lectura"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card del suscriptor */}
          <View style={styles.cardSuscriptor}>
            <View style={styles.cardSuscriptorTop}>
              <View style={styles.flex}>
                <Text style={styles.abonadoLabel}>
                  SUSCRIPTOR #{id_suscriptor}
                </Text>
                <Text style={styles.abonadoNombre} numberOfLines={1}>
                  {nombreSuscriptor}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeTexto}</Text>
              </View>
            </View>
            <View style={styles.cardSuscriptorRow}>
              <MaterialIcons name="location-on" size={14} color={COLORS.textSecondary} style={styles.cardRowIcon} />
              <Text style={styles.cardSuscriptorLine} numberOfLines={2}>
                {direccionSuscriptor}
              </Text>
            </View>
            <View style={styles.cardSuscriptorRow}>
              <MaterialIcons name="grid-on" size={14} color={COLORS.textSecondary} style={styles.cardRowIcon} />
              <Text style={styles.cardSuscriptorLine}>
                Categoría: Estrato {suscriptor?.estrato ?? '—'}
              </Text>
            </View>
            <Text style={styles.subtituloMeta}>{subtitulo}</Text>
          </View>

          {cargandoPrefill && (
            <View style={styles.loaderRow}>
              <Text style={styles.loaderText}>Cargando lectura previa…</Text>
            </View>
          )}

          {/* Card lectura anterior */}
          <View style={styles.cardAnterior}>
            <Text style={styles.anteriorLabel}>Lectura anterior</Text>
            <Text style={styles.anteriorValor}>{lecturaAnteriorTxt}</Text>
          </View>

          {/* Input lectura actual */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>LECTURA ACTUAL (m³)</Text>
            <View style={styles.inputBigWrapper}>
              <TextInput
                value={form.lectura_actual}
                onChangeText={(v) => setCampo('lectura_actual', v)}
                onFocus={() => setCampoFocal('lectura_actual')}
                onBlur={() => { setCampoFocal(null); onBlur('lectura_actual'); }}
                placeholder="0000"
                placeholderTextColor={COLORS.surfaceDim}
                keyboardType="decimal-pad"
                editable={!calculando}
                style={[
                  styles.inputBig,
                  campoFocal === 'lectura_actual' && styles.inputFocused,
                  errores.lectura_actual !== undefined && styles.inputError,
                ]}
              />
              <Text style={styles.inputBigUnit}>m³</Text>
            </View>
            {errores.lectura_actual !== undefined && (
              <Text style={styles.errorText}>{errores.lectura_actual}</Text>
            )}
          </View>

          {/* Input lectura anterior (editable, segun plan se conserva) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Lectura anterior (m³) *</Text>
            <TextInput
              value={form.lectura_anterior}
              onChangeText={(v) => setCampo('lectura_anterior', v)}
              onFocus={() => setCampoFocal('lectura_anterior')}
              onBlur={() => { setCampoFocal(null); onBlur('lectura_anterior'); }}
              placeholder="0000"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="decimal-pad"
              editable={!calculando && !cargandoPrefill}
              style={[
                styles.input,
                campoFocal === 'lectura_anterior' && styles.inputFocused,
                errores.lectura_anterior !== undefined && styles.inputError,
              ]}
            />
            {errores.lectura_anterior !== undefined && (
              <Text style={styles.errorText}>{errores.lectura_anterior}</Text>
            )}
          </View>

          {/* Periodo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Periodo *</Text>
            <PeriodoPicker
              value={form.id_periodo}
              onChange={(v) => setCampo('id_periodo', v)}
              disabled={calculando}
              error={errores.id_periodo !== undefined}
            />
            {errores.id_periodo !== undefined && (
              <Text style={styles.errorText}>{errores.id_periodo}</Text>
            )}
          </View>

          {/* Observaciones */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Observaciones</Text>
            <TextInput
              value={form.observaciones}
              onChangeText={(v) => setCampo('observaciones', v)}
              onFocus={() => setCampoFocal('observaciones')}
              onBlur={() => { setCampoFocal(null); onBlur('observaciones'); }}
              placeholder="Notas opcionales sobre la lectura"
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={3}
              maxLength={300}
              editable={!calculando}
              textAlignVertical="top"
              style={[
                styles.inputMulti,
                campoFocal === 'observaciones' && styles.inputFocused,
                errores.observaciones !== undefined && styles.inputError,
              ]}
            />
            {errores.observaciones !== undefined && (
              <Text style={styles.errorText}>{errores.observaciones}</Text>
            )}
          </View>


          {/* Botón cámara / preview de evidencia */}
          {mostrarWarningConsumo && (
            <View style={styles.warningBox}>
              <View style={styles.warningIconBox}>
                <MaterialIcons name="warning" size={22} color={COLORS.error} />
              </View>
              <View style={styles.warningTexts}>
                <Text style={styles.warningTitle}>Consumo inusual detectado</Text>
                <Text style={styles.warningDesc}>
                  El incremento es superior al 40% del promedio histórico del suscriptor.
                </Text>
              </View>
            </View>
          )}

          {/* Botón cámara / preview de evidencia */}
          {evidencia === undefined ? (
            <View>
              <Pressable
                onPress={abrirCamara}
                disabled={calculando}
                style={({ pressed }) => [
                  styles.camBtn,
                  pressed && styles.pressedLight,
                ]}
              >
                <View style={styles.camCirculo}>
                  <MaterialIcons name="camera-alt" size={36} color={COLORS.onPrimary} />
                </View>
                <Text style={styles.camLabel}>TOMAR FOTO DEL MEDIDOR</Text>
              </Pressable>
              <Text style={styles.camHint}>
                Foto opcional para validación de consumo inusual
              </Text>
            </View>
          ) : (
            <View style={styles.evidenciaCard}>
              <Image
                source={{ uri: evidencia.foto_path }}
                style={styles.evidenciaThumb}
              />
              <View style={styles.evidenciaInfo}>
                <View style={styles.evidenciaOkRow}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.secondary} />
                  <Text style={styles.evidenciaOk}>FOTO CAPTURADA</Text>
                </View>
                {evidencia.foto_hash !== undefined && (
                  <Text style={styles.evidenciaHash}>
                    {evidencia.foto_hash.substring(0, 8)}…
                  </Text>
                )}
                <Pressable
                  onPress={abrirCamara}
                  disabled={calculando}
                  style={({ pressed }) => [
                    styles.replaceBtn,
                    pressed && styles.pressedLight,
                  ]}
                >
                  <Text style={styles.replaceBtnText}>REEMPLAZAR</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Snack inline (reemplazo del Paper Snackbar) */}
          {snack.visible && (
            <Pressable
              onPress={() => setSnack((s) => ({ ...s, visible: false }))}
              style={[
                styles.snackBox,
                snack.tipo === 'ok' ? styles.snackOk : styles.snackError,
              ]}
            >
              <Text
                style={[
                  styles.snackText,
                  snack.tipo === 'error' && styles.snackTextError,
                ]}
              >
                {snack.mensaje}
              </Text>
              <Text style={styles.snackClose}>×</Text>
            </Pressable>
          )}

          {/* Footer de marca dentro del scroll para que no tape */}
          <FooterApp />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom fixed actions */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={calculando}
          style={({ pressed }) => [
            styles.btnSecondary,
            pressed && styles.pressedLight,
          ]}
        >
          <Text style={styles.btnSecondaryText}>CANCELAR</Text>
        </Pressable>
        <Pressable
          onPress={onCalcular}
          disabled={calculando || cargandoPrefill}
          style={({ pressed }) => [
            styles.btnPrimary,
            (calculando || cargandoPrefill) && styles.btnDisabled,
            pressed && styles.pressedDark,
          ]}
        >
          <Text style={styles.btnPrimaryText}>
            {calculando ? 'CALCULANDO…' : 'GUARDAR Y CALCULAR'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const BOTTOM_HEIGHT = 88;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: { flex: 1 },

  // Scroll
  scroll: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: BOTTOM_HEIGHT + SPACING.lg,
    gap: SPACING.lg,
  },

  // Card suscriptor
  cardSuscriptor: {
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardSuscriptorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  abonadoLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
  },
  abonadoNombre: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardSuscriptorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardRowIcon: {
    marginRight: 2,
  },
  cardSuscriptorLine: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    flex: 1,
  },
  subtituloMeta: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: 1,
  },

  // Loader
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  loaderText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
  },

  // Card lectura anterior
  cardAnterior: {
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  anteriorLabel: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.textSecondary,
  },
  anteriorValor: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },

  // Fields
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    marginLeft: 2,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.primary,
    ...TYPOGRAPHY.bodyMd,
  },
  inputBig: {
    width: '100%',
    height: 80,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: COLORS.primaryContainer,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingRight: 48, // espacio para el "m³" a la derecha
    color: COLORS.primary,
    ...TYPOGRAPHY.headlineLg,
  },
  inputMulti: {
    width: '100%',
    minHeight: 96,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.primary,
    ...TYPOGRAPHY.bodyMd,
  },
  inputFocused: {
    ...BORDERS.focused,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.error,
    marginLeft: 2,
    marginTop: 2,
  },

  // Cámara
  camBtn: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: COLORS.background,
    ...BORDERS.dashed,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  camCirculo: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camLabel: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  camHint: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // Evidencia preview
  evidenciaCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
  },
  evidenciaThumb: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
  },
  evidenciaInfo: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  evidenciaOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  evidenciaOk: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  evidenciaHash: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.textSecondary,
  },
  replaceBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    ...BORDERS.thin,
    backgroundColor: COLORS.background,
  },
  replaceBtnText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Snack inline
  snackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
  },
  snackOk: {
    backgroundColor: COLORS.surfaceLight,
  },
  snackError: {
    backgroundColor: COLORS.errorContainer,
    borderColor: COLORS.error,
  },
  snackText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.primary,
    flex: 1,
  },
  snackTextError: {
    color: COLORS.onErrorContainer,
  },
  snackClose: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    paddingHorizontal: SPACING.sm,
  },

  // Brand footer
  brandFooter: {
    ...TYPOGRAPHY.labelSm,
    fontSize: 8,
    color: COLORS.textTertiary,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_HEIGHT,
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  btnSecondary: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outline,
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
  btnPrimary: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.default,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Estados pressed
  pressedLight: {
    backgroundColor: COLORS.surfaceLight,
  },
  pressedDark: {
    opacity: 0.85,
  },

  // Input big wrapper (lectura actual con unidad flotante)
  inputBigWrapper: {
    position: 'relative',
  },
  inputBigUnit: {
    position: 'absolute',
    right: SPACING.lg,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },

  // Warning consumo inusual
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.errorContainer,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  warningIconBox: {
    backgroundColor: COLORS.errorContainer,
    borderRadius: RADIUS.default,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTexts: {
    flex: 1,
    gap: SPACING.xs,
  },
  warningTitle: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onErrorContainer,
    fontWeight: '600',
  },
  warningDesc: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onErrorContainer,
    lineHeight: 20,
  },
});
