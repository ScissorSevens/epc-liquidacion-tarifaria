import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  HelperText,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  liquidarLectura,
  registrarLectura,
} from '@dominio/captura-lecturas/captura-lecturas';
import type {
  EntradaLectura,
  EvidenciaFoto,
} from '@dominio/captura-lecturas/types';
import type { Estrato } from '@dominio/motor-tarifario/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { PARAMETROS_TARIFARIOS_DEMO } from '../composition/parametros-tarifarios-demo';
import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'CapturarLectura'>;

// Estratos validos del dominio (1-6) tipados como literales para el SegmentedButtons.
type EstratoStr = '1' | '2' | '3' | '4' | '5' | '6';

interface FormState {
  lectura_anterior: string;
  lectura_actual: string;
  id_periodo: string;
  observaciones: string;
  estrato: EstratoStr;
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
    case 'estrato':
      if (valor === undefined || valor === '') return 'Estrato obligatorio';
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Pantalla de captura de lectura + disparo del calculo tarifario.
 *
 * Flujo:
 *  1) Prellena lectura anterior consultando la ultima lectura conocida
 *     del medidor (si existe) via `lecturaRepo.listar({ id_medidor })`.
 *     Si no hay historial, queda en blanco editable (primera lectura).
 *  2) Usuario completa actual + periodo (default mes actual) + estrato.
 *  3) Construye `EntradaLectura` con `id_operario: 1` HARDCODED — todavia
 *     no hay sistema de auth. Cuando exista, hay que reemplazar.
 *  4) Llama `registrarLectura` (valida + arma `Lectura`) y `liquidarLectura`
 *     (calcula via motor tarifario CRA).
 *  5) Si OK, navega a `ResultadoCalculo` con todo el contexto.
 *  6) Si error de validacion del dominio, muestra Snackbar con el mensaje
 *     tal cual lo tira la factory.
 */
export default function CapturarLectura({ navigation, route }: Props) {
  const { id_medidor, id_suscriptor } = route.params;

  const [form, setForm] = useState<FormState>({
    lectura_anterior: '',
    lectura_actual: '',
    id_periodo: periodoActual(),
    observaciones: '',
    estrato: '3',
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

  // Recibe la evidencia cuando `CapturarFoto` navega de vuelta con el
  // param poblado. `route.params.evidenciaFoto` cambia cada vez que la
  // pantalla hija invoca `navigation.navigate('CapturarLectura', {...})`.
  useEffect(() => {
    const recibida = route.params.evidenciaFoto;
    if (recibida !== undefined) {
      setEvidencia(recibida);
      // Limpiamos el param para que no se "re-aplique" en futuros renders
      // (por ejemplo si la pantalla pierde y recupera el foco).
      navigation.setParams({ evidenciaFoto: undefined });
    }
  }, [route.params.evidenciaFoto, navigation]);

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

  function onCalcular() {
    if (!validarTodo()) {
      mostrarSnack('Revisa los campos marcados', 'error');
      return;
    }
    setCalculando(true);
    try {
      const obs = form.observaciones.trim();
      const entrada: EntradaLectura = {
        id_medidor,
        id_periodo: form.id_periodo.trim(),
        id_operario: 1, // HARDCODED: aun no hay auth.
        lectura_actual: Number.parseFloat(form.lectura_actual),
        lectura_anterior: Number.parseFloat(form.lectura_anterior),
        ...(obs !== '' && { observaciones: obs }),
        ...(evidencia !== undefined && { evidencia }),
      };
      const lectura = registrarLectura(entrada);
      const estrato = Number.parseInt(form.estrato, 10) as Estrato;
      const resultado = liquidarLectura(
        lectura,
        PARAMETROS_TARIFARIOS_DEMO,
        estrato,
      );
      navigation.navigate('ResultadoCalculo', {
        lectura,
        resultado,
        parametros: PARAMETROS_TARIFARIOS_DEMO,
        estrato,
        id_suscriptor,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mostrarSnack(msg, 'error');
    } finally {
      setCalculando(false);
    }
  }

  const subtitulo = useMemo(
    () => `Suscriptor #${id_suscriptor} — Medidor #${id_medidor}`,
    [id_suscriptor, id_medidor],
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          disabled={calculando}
        />
        <Appbar.Content title="Capturar lectura" />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={styles.surface} elevation={1}>
            <Text variant="titleMedium" style={styles.titulo}>
              Datos de la lectura
            </Text>
            <Text variant="bodySmall" style={styles.subtitulo}>
              {subtitulo}
            </Text>

            {cargandoPrefill && (
              <View style={styles.loaderRow}>
                <ActivityIndicator />
                <Text variant="bodySmall" style={styles.loaderText}>
                  Cargando lectura previa…
                </Text>
              </View>
            )}

            <TextInput
              label="Lectura anterior (m³) *"
              value={form.lectura_anterior}
              onChangeText={(v) => setCampo('lectura_anterior', v)}
              onBlur={() => onBlur('lectura_anterior')}
              error={errores.lectura_anterior !== undefined}
              mode="outlined"
              keyboardType="decimal-pad"
              disabled={calculando || cargandoPrefill}
            />
            <HelperText
              type="error"
              visible={errores.lectura_anterior !== undefined}
            >
              {errores.lectura_anterior ?? ' '}
            </HelperText>

            <TextInput
              label="Lectura actual (m³) *"
              value={form.lectura_actual}
              onChangeText={(v) => setCampo('lectura_actual', v)}
              onBlur={() => onBlur('lectura_actual')}
              error={errores.lectura_actual !== undefined}
              mode="outlined"
              keyboardType="decimal-pad"
              disabled={calculando}
            />
            <HelperText
              type="error"
              visible={errores.lectura_actual !== undefined}
            >
              {errores.lectura_actual ?? ' '}
            </HelperText>

            <TextInput
              label="Periodo (YYYYMM) *"
              value={form.id_periodo}
              onChangeText={(v) => setCampo('id_periodo', v)}
              onBlur={() => onBlur('id_periodo')}
              error={errores.id_periodo !== undefined}
              mode="outlined"
              keyboardType="number-pad"
              maxLength={6}
              disabled={calculando}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HelperText type="error" visible={errores.id_periodo !== undefined}>
              {errores.id_periodo ?? ' '}
            </HelperText>

            <Text variant="labelMedium" style={styles.subLabel}>
              Estrato *
            </Text>
            <SegmentedButtons
              value={form.estrato}
              onValueChange={(v) => {
                setCampo('estrato', v as EstratoStr);
                const msg = validarCampo('estrato', v);
                setErrores((prev) => {
                  const next = { ...prev };
                  if (msg === undefined) delete next.estrato;
                  else next.estrato = msg;
                  return next;
                });
              }}
              buttons={[
                { value: '1', label: '1', disabled: calculando },
                { value: '2', label: '2', disabled: calculando },
                { value: '3', label: '3', disabled: calculando },
                { value: '4', label: '4', disabled: calculando },
                { value: '5', label: '5', disabled: calculando },
                { value: '6', label: '6', disabled: calculando },
              ]}
            />
            <HelperText type="error" visible={errores.estrato !== undefined}>
              {errores.estrato ?? ' '}
            </HelperText>

            <TextInput
              label="Observaciones"
              value={form.observaciones}
              onChangeText={(v) => setCampo('observaciones', v)}
              onBlur={() => onBlur('observaciones')}
              error={errores.observaciones !== undefined}
              mode="outlined"
              multiline
              numberOfLines={3}
              maxLength={300}
              disabled={calculando}
            />
            <HelperText
              type="error"
              visible={errores.observaciones !== undefined}
            >
              {errores.observaciones ?? ' '}
            </HelperText>

            <Text variant="labelMedium" style={styles.subLabel}>
              Evidencia fotografica (opcional)
            </Text>
            {evidencia === undefined ? (
              <Button
                mode="outlined"
                icon="camera"
                onPress={() => {
                  navigation.navigate('CapturarFoto', {
                    id_medidor,
                    id_periodo: form.id_periodo.trim(),
                    id_suscriptor,
                  });
                }}
                disabled={calculando}
                style={styles.botonFoto}
              >
                Tomar foto del medidor
              </Button>
            ) : (
              <View style={styles.evidenciaRow}>
                <Image
                  source={{ uri: evidencia.foto_path }}
                  style={styles.thumb}
                />
                <View style={styles.evidenciaInfo}>
                  <Text variant="bodySmall" style={styles.evidenciaTexto}>
                    ✓ Foto capturada
                  </Text>
                  {evidencia.foto_hash !== undefined && (
                    <Text variant="bodySmall" style={styles.evidenciaHash}>
                      hash: {evidencia.foto_hash.substring(0, 8)}…
                    </Text>
                  )}
                  <Button
                    mode="text"
                    icon="camera-retake"
                    compact
                    onPress={() => {
                      navigation.navigate('CapturarFoto', {
                        id_medidor,
                        id_periodo: form.id_periodo.trim(),
                        id_suscriptor,
                      });
                    }}
                    disabled={calculando}
                  >
                    Reemplazar foto
                  </Button>
                </View>
              </View>
            )}

            <Button
              mode="contained"
              onPress={onCalcular}
              disabled={calculando || cargandoPrefill}
              style={styles.submit}
              icon="calculator"
            >
              {calculando ? 'Calculando…' : 'Calcular'}
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={snack.tipo === 'ok' ? 1500 : 4000}
        style={snack.tipo === 'ok' ? styles.snackOk : styles.snackError}
      >
        {snack.mensaje}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  surface: { padding: 16, borderRadius: 8 },
  titulo: { marginBottom: 4 },
  subtitulo: { marginBottom: 12, color: '#666' },
  subLabel: { marginBottom: 6, marginTop: 4 },
  submit: { marginTop: 12 },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 8,
  },
  loaderText: { marginLeft: 8 },
  botonFoto: { marginTop: 4, marginBottom: 8 },
  evidenciaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },
  thumb: { width: 100, height: 100, borderRadius: 4, backgroundColor: '#eee' },
  evidenciaInfo: { flex: 1, marginLeft: 12 },
  evidenciaTexto: { color: '#2e7d32', fontWeight: '600' },
  evidenciaHash: { color: '#666', marginTop: 2 },
  snackOk: { backgroundColor: '#2e7d32' },
  snackError: { backgroundColor: '#c62828' },
});
