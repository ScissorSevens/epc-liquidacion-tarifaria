import { useEffect, useState } from 'react';
import {
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
  Divider,
  HelperText,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { crearMedidor } from '@dominio/medidores';
import { crearSuscriptor } from '@dominio/suscriptores';
import { getBootstrap } from '../composition/get-bootstrap';
import { persistirYEncolarAltaSuscriptor } from '../adapters/persistir-y-encolar-alta-suscriptor';
import type { ConfigStackScreenProps } from '../navegacion/types';

type Props = ConfigStackScreenProps<'AltaSuscriptor'>;

// Valores literales validos de estrato (1-6) - el dominio rechaza cualquier
// otro entero. Tipamos asi para que SegmentedButtons + parseInt sean type-safe.
type EstratoStr = '' | '1' | '2' | '3' | '4' | '5' | '6';

interface FormState {
  codigo: string;
  nombre_apellidos: string;
  direccion: string;
  estrato: EstratoStr;
  matricula_inmobiliaria: string;
  numero_catastral: string;
  numero_medidor: string;
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
  codigo: '',
  nombre_apellidos: '',
  direccion: '',
  estrato: '',
  matricula_inmobiliaria: '',
  numero_catastral: '',
  numero_medidor: '',
  fecha_instalacion: '',
  observaciones_medidor: '',
};

const REGEX_CODIGO = /^\d{1,10}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
// El dominio acepta letras, digitos y guiones en numero_medidor (ver
// REGEX_NUMERO_MEDIDOR en src/medidores/medidores.ts). Replicamos aca para
// dar feedback temprano antes de tocar la DB.
const REGEX_NUMERO_MEDIDOR = /^[A-Za-z0-9-]{1,50}$/;

/**
 * Valida un campo individual y devuelve mensaje de error o undefined.
 * Las reglas espejan las del dominio (`crearSuscriptor` / `crearMedidor`).
 * Si el dominio rechaza algo que pasa estas reglas, el dominio MANDA y
 * el mensaje cae en el catch del submit.
 */
function validarCampo(nombre: CampoForm, valor: string): string | undefined {
  switch (nombre) {
    case 'codigo':
      if (valor.trim() === '') return 'Código obligatorio';
      if (!REGEX_CODIGO.test(valor)) {
        return 'Código debe ser numérico, máx 10 dígitos';
      }
      return undefined;

    case 'nombre_apellidos': {
      const v = valor.trim();
      if (v.length === 0) return 'Nombre obligatorio';
      if (v.length < 3) return 'Nombre obligatorio (mín 3 caracteres)';
      if (v.length > 150) return 'Nombre no puede superar 150 caracteres';
      return undefined;
    }

    case 'direccion': {
      const v = valor.trim();
      if (v.length === 0) return 'Dirección obligatoria';
      if (v.length < 3) return 'Dirección obligatoria (mín 3 caracteres)';
      if (v.length > 200) return 'Dirección no puede superar 200 caracteres';
      return undefined;
    }

    case 'estrato':
      if (valor === '') return 'Estrato obligatorio';
      return undefined;

    case 'matricula_inmobiliaria':
      if (valor.length > 50) return 'Matrícula no puede superar 50 caracteres';
      return undefined;

    case 'numero_catastral':
      if (valor.length > 50) return 'N° catastral no puede superar 50 caracteres';
      return undefined;

    case 'numero_medidor': {
      const v = valor.trim();
      if (v.length === 0) return 'Número de medidor obligatorio';
      if (!REGEX_NUMERO_MEDIDOR.test(v)) {
        return 'Solo letras, dígitos y guiones (1-50)';
      }
      return undefined;
    }

    case 'fecha_instalacion': {
      const v = valor.trim();
      if (v.length === 0) return 'Fecha de instalación obligatoria';
      if (!REGEX_FECHA.test(v)) return 'Formato YYYY-MM-DD';
      // Validamos parseabilidad real (descarta 2025-13-40 que pasa el regex).
      const parsed = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return 'Fecha inválida';
      // Re-serializamos para detectar fechas tipo 2025-02-31 que JS
      // "corrige" silenciosamente a 2025-03-03.
      if (parsed.toISOString().slice(0, 10) !== v) return 'Fecha inválida';
      // No permitir futuro (mismo criterio que el dominio).
      const hoy = new Date().toISOString().slice(0, 10);
      if (v > hoy) return 'Fecha no puede ser futura';
      return undefined;
    }

    case 'observaciones_medidor':
      if (valor.length > 500) return 'Observaciones no puede superar 500 caracteres';
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

  // Reset al unmount: si el usuario sale sin guardar, no preservamos el
  // form entre visitas. (En la practica el componente se desmonta solo
  // por replace/back, pero es explicito y barato.)
  useEffect(() => {
    return () => {
      setForm(ESTADO_INICIAL);
      setErrores({});
    };
  }, []);

  function setCampo<K extends CampoForm>(campo: K, valor: FormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  // Blur: valida solo ese campo. NO validamos on-change (molesto).
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

  async function onSubmit() {
    if (!validarTodo()) {
      mostrarSnack('Revisá los campos marcados', 'error');
      return;
    }
    setEnviando(true);
    try {
      const bs = await getBootstrap();

      // Pre-checks de duplicados ANTES de crear nada. Bajamos riesgo de
      // dejar huerfano por una colision evitable.
      const codigoExiste = await bs.suscriptorRepo.existePorCodigo(
        form.codigo.trim(),
      );
      if (codigoExiste) {
        mostrarSnack(
          `Ya existe un suscriptor con código ${form.codigo.trim()}`,
          'error',
        );
        return;
      }
      const numeroExiste = await bs.medidorRepo.existePorNumero(
        form.numero_medidor.trim(),
      );
      if (numeroExiste) {
        mostrarSnack(
          `Ya existe un medidor con número ${form.numero_medidor.trim()}`,
          'error',
        );
        return;
      }

      // Construimos los borradores via factories del dominio. Esto da
      // doble defensa (validacion local + dominio) y setea estado='activo'.
      // parseInt es seguro porque validarCampo ya garantizo '1'..'6'.
      const estratoNum = Number.parseInt(form.estrato, 10) as 1 | 2 | 3 | 4 | 5 | 6;

      const borradorSus = crearSuscriptor({
        codigo: form.codigo.trim(),
        nombre_apellidos: form.nombre_apellidos.trim(),
        direccion: form.direccion.trim(),
        estrato: estratoNum,
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
        // Camino 3 (D33+): persistir + encolar suscriptor + medidor en
        // una sola operacion atomica con compensacion. Reemplaza el
        // try/catch inline que solo persistia (sin encolar al backend).
        try {
          const borradorMed = crearMedidor({
            numero_medidor: form.numero_medidor.trim(),
            // id_suscriptor placeholder: el adapter lo inyecta tras crear
            // el suscriptor. Pasamos 0 para satisfacer el tipo del factory;
            // el adapter usa Omit<MedidorBorrador,'id_suscriptor'>.
            id_suscriptor: 0,
            fecha_instalacion: form.fecha_instalacion.trim(),
            observaciones:
              form.observaciones_medidor.trim() === ''
                ? undefined
                : form.observaciones_medidor.trim(),
          });
          // El adapter ignora `id_suscriptor` del borradorMed: lo sobreescribe
          // con el del suscriptor recien creado. Quitamos via destructuring
          // para no acoplar el contrato.
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
      // Pequeno delay para que el snack sea visible antes de navegar.
      // `replace` (no navigate) para que el back vaya a la lista, no al form.
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
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          disabled={enviando}
        />
        <Appbar.Content title="Nuevo Suscriptor" />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Seccion 1 - Datos del Suscriptor */}
          <Text variant="titleMedium" style={styles.seccionTitulo}>
            Datos del Suscriptor
          </Text>

          <TextInput
            label="Código *"
            value={form.codigo}
            onChangeText={(v) => setCampo('codigo', v)}
            onBlur={() => onBlur('codigo')}
            error={errores.codigo !== undefined}
            mode="outlined"
            keyboardType="number-pad"
            maxLength={10}
            disabled={enviando}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <HelperText type="error" visible={errores.codigo !== undefined}>
            {errores.codigo ?? ' '}
          </HelperText>

          <TextInput
            label="Nombre y apellidos *"
            value={form.nombre_apellidos}
            onChangeText={(v) => setCampo('nombre_apellidos', v)}
            onBlur={() => onBlur('nombre_apellidos')}
            error={errores.nombre_apellidos !== undefined}
            mode="outlined"
            maxLength={150}
            disabled={enviando}
          />
          <HelperText
            type="error"
            visible={errores.nombre_apellidos !== undefined}
          >
            {errores.nombre_apellidos ?? ' '}
          </HelperText>

          <TextInput
            label="Dirección *"
            value={form.direccion}
            onChangeText={(v) => setCampo('direccion', v)}
            onBlur={() => onBlur('direccion')}
            error={errores.direccion !== undefined}
            mode="outlined"
            maxLength={200}
            disabled={enviando}
          />
          <HelperText type="error" visible={errores.direccion !== undefined}>
            {errores.direccion ?? ' '}
          </HelperText>

          <Text variant="labelMedium" style={styles.subLabel}>
            Estrato *
          </Text>
          <SegmentedButtons
            value={form.estrato}
            onValueChange={(v) => {
              setCampo('estrato', v as EstratoStr);
              // Estrato no tiene blur natural (no es input de texto).
              // Validamos al cambiar para limpiar el error apenas eligen.
              const msg = validarCampo('estrato', v);
              setErrores((prev) => {
                const next = { ...prev };
                if (msg === undefined) delete next.estrato;
                else next.estrato = msg;
                return next;
              });
            }}
            buttons={[
              { value: '1', label: '1', disabled: enviando },
              { value: '2', label: '2', disabled: enviando },
              { value: '3', label: '3', disabled: enviando },
              { value: '4', label: '4', disabled: enviando },
              { value: '5', label: '5', disabled: enviando },
              { value: '6', label: '6', disabled: enviando },
            ]}
          />
          <HelperText type="error" visible={errores.estrato !== undefined}>
            {errores.estrato ?? ' '}
          </HelperText>

          <TextInput
            label="Matrícula inmobiliaria"
            value={form.matricula_inmobiliaria}
            onChangeText={(v) => setCampo('matricula_inmobiliaria', v)}
            onBlur={() => onBlur('matricula_inmobiliaria')}
            error={errores.matricula_inmobiliaria !== undefined}
            mode="outlined"
            maxLength={50}
            disabled={enviando}
          />
          <HelperText
            type="error"
            visible={errores.matricula_inmobiliaria !== undefined}
          >
            {errores.matricula_inmobiliaria ?? ' '}
          </HelperText>

          <TextInput
            label="Número catastral"
            value={form.numero_catastral}
            onChangeText={(v) => setCampo('numero_catastral', v)}
            onBlur={() => onBlur('numero_catastral')}
            error={errores.numero_catastral !== undefined}
            mode="outlined"
            maxLength={50}
            disabled={enviando}
          />
          <HelperText
            type="error"
            visible={errores.numero_catastral !== undefined}
          >
            {errores.numero_catastral ?? ' '}
          </HelperText>

          <Divider style={styles.divider} />

          {/* Seccion 2 - Datos del Medidor */}
          <Text variant="titleMedium" style={styles.seccionTitulo}>
            Datos del Medidor
          </Text>

          <TextInput
            label="Número de medidor *"
            value={form.numero_medidor}
            onChangeText={(v) => setCampo('numero_medidor', v)}
            onBlur={() => onBlur('numero_medidor')}
            error={errores.numero_medidor !== undefined}
            mode="outlined"
            maxLength={50}
            disabled={enviando}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <HelperText
            type="error"
            visible={errores.numero_medidor !== undefined}
          >
            {errores.numero_medidor ?? ' '}
          </HelperText>

          <TextInput
            label="Fecha de instalación *"
            value={form.fecha_instalacion}
            onChangeText={(v) => setCampo('fecha_instalacion', v)}
            onBlur={() => onBlur('fecha_instalacion')}
            error={errores.fecha_instalacion !== undefined}
            mode="outlined"
            placeholder="YYYY-MM-DD"
            maxLength={10}
            disabled={enviando}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
          />
          <HelperText
            type="error"
            visible={errores.fecha_instalacion !== undefined}
          >
            {errores.fecha_instalacion ?? ' '}
          </HelperText>

          <TextInput
            label="Observaciones del medidor"
            value={form.observaciones_medidor}
            onChangeText={(v) => setCampo('observaciones_medidor', v)}
            onBlur={() => onBlur('observaciones_medidor')}
            error={errores.observaciones_medidor !== undefined}
            mode="outlined"
            multiline
            numberOfLines={3}
            maxLength={500}
            disabled={enviando}
          />
          <HelperText
            type="error"
            visible={errores.observaciones_medidor !== undefined}
          >
            {errores.observaciones_medidor ?? ' '}
          </HelperText>

          <Button
            mode="contained"
            onPress={() => void onSubmit()}
            disabled={enviando}
            style={styles.submit}
            icon={enviando ? undefined : 'content-save'}
          >
            {enviando ? '' : 'Guardar suscriptor y medidor'}
          </Button>
          {enviando && (
            <View style={styles.loaderRow}>
              <ActivityIndicator />
              <Text variant="bodySmall" style={styles.loaderText}>
                Guardando…
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={
          snack.tipo === 'ok'
            ? 1500
            : snack.tipo === 'warning'
              ? 6000
              : 4000
        }
        style={
          snack.tipo === 'ok'
            ? styles.snackOk
            : snack.tipo === 'warning'
              ? styles.snackWarning
              : styles.snackError
        }
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
  seccionTitulo: { marginBottom: 8, marginTop: 4 },
  subLabel: { marginBottom: 6, marginTop: 4 },
  divider: { marginVertical: 12 },
  submit: { marginTop: 8 },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  loaderText: { marginLeft: 8 },
  snackOk: { backgroundColor: '#2e7d32' },
  snackError: { backgroundColor: '#c62828' },
  snackWarning: { backgroundColor: '#ef6c00' },
});
