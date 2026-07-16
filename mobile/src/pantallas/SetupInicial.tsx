import { useState } from 'react';
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

import {
  OPERARIO_FORM_VACIO,
  PRESTADOR_FORM_VACIO,
  prestadorFormABootstrap,
  validarPaso1,
  validarPaso2,
  type ErroresOperario,
  type ErroresPrestador,
  type OperarioForm,
  type PrestadorForm,
} from '../composition/validaciones-setup';
import {
  bootstrapCompleto,
} from '../composition/bootstrap-completo';
import { getBootstrap } from '../composition/get-bootstrap';
import { guardarSesion } from '../composition/constantes';
import { useWorkspace } from '../composicion/useWorkspace';
import { logger } from '../composicion/logger';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

interface Props {
  readonly onComplete: () => void;
}

/**
 * Pantalla SetupInicial (Fase 5 Tarea 5.1).
 *
 * Wizard de 2 pasos que muestra AuthGate cuando `prestadorRepo.listar()`
 * devuelve `[]` (estado `sin_setup`):
 *
 *   PASO 1 — Datos del prestador (10 campos). Ver `validarPaso1`.
 *   PASO 2 — Datos del primer operario (5 campos) + consent (Ley 1581/2012).
 *            Ver `validarPaso2`.
 *
 * Al tocar [FINALIZAR] con form valido:
 *   1. Revalida todo.
 *   2. Llama `bootstrapCompleto()` (crea prestador + acuerdo + parametros
 *      + operario atomicamente con rollback).
 *   3. Persiste la sesion con `guardarSesion()`.
 *   4. Sincroniza `useWorkspace.setSesionCompleta()`.
 *   5. Llama `onComplete()` para que AuthGate cambie a `con_sesion`.
 *
 * Si algo falla, muestra un banner rojo con el mensaje de error y
 * mantiene los datos del formulario para reintento.
 *
 * Por ahora, `bootstrapCompleto` se implementa como una funcion local
 * mobile (no llama al backend todavia — eso es Fase 6).
 */
export default function SetupInicial({ onComplete }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [prestadorForm, setPrestadorForm] = useState<PrestadorForm>(PRESTADOR_FORM_VACIO);
  const [operarioForm, setOperarioForm] = useState<OperarioForm>(OPERARIO_FORM_VACIO);
  const [erroresPrestador, setErroresPrestador] = useState<ErroresPrestador>({});
  const [erroresOperario, setErroresOperario] = useState<ErroresOperario>({});
  const [cargando, setCargando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState<string | undefined>(undefined);

  function setCampoPrestador<K extends keyof PrestadorForm>(campo: K, valor: PrestadorForm[K]) {
    setPrestadorForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function setCampoOperario<K extends keyof OperarioForm>(campo: K, valor: OperarioForm[K]) {
    setOperarioForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSiguiente() {
    const nuevosErrores = validarPaso1(prestadorForm);
    setErroresPrestador(nuevosErrores);
    if (Object.keys(nuevosErrores).length === 0) {
      setErrorGlobal(undefined);
      setPaso(2);
    }
  }

  function handleAtras() {
    setErrorGlobal(undefined);
    setPaso(1);
  }

  async function handleFinalizar() {
    // 1. Revalida todo (defensivo: la UI ya valida en cada onBlur/onPress).
    const nuevosErroresOperario = validarPaso2(operarioForm);
    setErroresOperario(nuevosErroresOperario);
    if (Object.keys(nuevosErroresOperario).length > 0) {
      return;
    }

    setCargando(true);
    setErrorGlobal(undefined);
    try {
      // 2. Bootstrap del tenant via getBootstrap (cached) + bootstrapCompleto.
      const bs = await getBootstrap();
      const resultado = await bootstrapCompleto({
        prestadorRepo: bs.prestadorRepo,
        acuerdoRepo: bs.acuerdoMunicipalRepo,
        parametrosRepo: bs.parametrosTarifaRepo,
        operarioRepo: bs.operarioRepo,
        hasher: bs.hasher,
        idGenerator: bs.idGenerator,
        input: {
          prestadorData: prestadorFormABootstrap(prestadorForm),
          operarioData: {
            numero_cedula: operarioForm.cedula.trim(),
            nombre: operarioForm.nombre.trim(),
            ...(operarioForm.email.trim() !== '' && { email: operarioForm.email.trim() }),
            password: operarioForm.password,
          },
        },
      });

      // 3. Persistir sesion local (placeholder hasta que llegue el backend).
      await guardarSesion(resultado.sesion);

      // 4. Sincronizar useWorkspace con la sesion resuelta.
      await useWorkspace.getState().setSesionCompleta(resultado.sesion);

      // 5. Notificar al padre (AuthGate cambia decision a con_sesion).
      onComplete();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      logger.warn('SetupInicial', 'error en bootstrap', { error: mensaje });
      setErrorGlobal(mensaje);
      // Mantenemos los datos del form para que el operario pueda reintentar
      // sin tener que volver a tipear todo.
    } finally {
      setCargando(false);
    }
  }

  // ── Render: paso 1 (datos del prestador) ──────────────────────────────────
  if (paso === 1) {
    return (
      <KeyboardAvoidingView
        style={styles.raiz}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.encabezado}>
            <Text style={styles.titulo}>Configuración Inicial</Text>
            <Text style={styles.subtitulo}>Paso 1 de 2</Text>
            <Text style={styles.subtituloSecundario}>Datos del prestador</Text>
          </View>

          <View style={styles.card}>
            <CampoTexto
              etiqueta="NOMBRE DEL PRESTADOR"
              placeholder="Ej: Asociacion de Usuarios La Esperanza"
              value={prestadorForm.nombre}
              onChangeText={(v) => setCampoPrestador('nombre', v)}
              error={erroresPrestador.nombre}
              maxLength={200}
            />
            <CampoTexto
              etiqueta="NIT"
              placeholder="Ej: 900123456-7"
              value={prestadorForm.nit}
              onChangeText={(v) => setCampoPrestador('nit', v)}
              error={erroresPrestador.nit}
              maxLength={20}
            />
            <CampoTexto
              etiqueta="REPRESENTANTE LEGAL"
              placeholder="Nombre completo"
              value={prestadorForm.representante_legal}
              onChangeText={(v) => setCampoPrestador('representante_legal', v)}
              error={erroresPrestador.representante_legal}
            />
            <CampoTexto
              etiqueta="CÉDULA DEL REPRESENTANTE"
              placeholder="6 a 12 dígitos"
              value={prestadorForm.representante_legal_cedula}
              onChangeText={(v) => setCampoPrestador('representante_legal_cedula', v.replace(/\D/g, ''))}
              error={erroresPrestador.representante_legal_cedula}
              keyboardType="numeric"
              maxLength={12}
            />
            <CampoTexto
              etiqueta="MUNICIPIO"
              placeholder="Ej: Caqueza"
              value={prestadorForm.municipio}
              onChangeText={(v) => setCampoPrestador('municipio', v)}
              error={erroresPrestador.municipio}
              maxLength={100}
            />
            <CampoTexto
              etiqueta="DEPARTAMENTO"
              placeholder="Ej: Cundinamarca"
              value={prestadorForm.departamento}
              onChangeText={(v) => setCampoPrestador('departamento', v)}
              error={erroresPrestador.departamento}
              maxLength={100}
            />

            <View style={styles.campoContenedor}>
              <Text style={styles.etiqueta}>SEGMENTO (Res CRA 825/2017)</Text>
              <View style={styles.chipsRow}>
                {([1, 2] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setCampoPrestador('segmento', s)}
                    style={({ pressed }) => [
                      styles.chip,
                      prestadorForm.segmento === s && styles.chipSel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, prestadorForm.segmento === s && styles.chipTextSel]}>
                      {s === 1 ? '1 — Urbano' : '2 — Rural'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {erroresPrestador.segmento !== undefined && (
                <Text style={styles.errorText}>{erroresPrestador.segmento}</Text>
              )}
            </View>

            <View style={styles.filaDosColumnas}>
              <View style={styles.colMitad}>
                <CampoNumero
                  etiqueta="SUSCRIPTORES URBANOS"
                  value={prestadorForm.num_suscriptores_urbanos}
                  onChangeNumber={(v) => setCampoPrestador('num_suscriptores_urbanos', v)}
                  error={erroresPrestador.num_suscriptores_urbanos}
                />
              </View>
              <View style={styles.colMitad}>
                <CampoNumero
                  etiqueta="SUSCRIPTORES RURALES"
                  value={prestadorForm.num_suscriptores_rurales}
                  onChangeNumber={(v) => setCampoPrestador('num_suscriptores_rurales', v)}
                  error={erroresPrestador.num_suscriptores_rurales}
                />
              </View>
            </View>

            <CampoTexto
              etiqueta="EMAIL CORPORATIVO (opcional)"
              placeholder="contacto@ejemplo.com"
              value={prestadorForm.email}
              onChangeText={(v) => setCampoPrestador('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <CampoTexto
              etiqueta="TELÉFONO (opcional)"
              placeholder="Ej: 311 222 3344"
              value={prestadorForm.telefono}
              onChangeText={(v) => setCampoPrestador('telefono', v)}
              keyboardType="phone-pad"
            />
          </View>

          {errorGlobal !== undefined && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTexto}>{errorGlobal}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSiguiente}
            style={({ pressed }) => [styles.botonPrimario, pressed && styles.botonPresionado]}
          >
            <Text style={styles.textoBotonPrimario}>SIGUIENTE</Text>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.onPrimary} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: paso 2 (datos del operario + finalizar) ──────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Configuración Inicial</Text>
          <Text style={styles.subtitulo}>Paso 2 de 2</Text>
          <Text style={styles.subtituloSecundario}>Datos del primer operario</Text>
        </View>

        <View style={styles.card}>
          <CampoTexto
            etiqueta="CÉDULA"
            placeholder="6 a 12 dígitos"
            value={operarioForm.cedula}
            onChangeText={(v) => setCampoOperario('cedula', v.replace(/\D/g, ''))}
            error={erroresOperario.cedula}
            keyboardType="numeric"
            maxLength={12}
          />
          <CampoTexto
            etiqueta="NOMBRE COMPLETO"
            placeholder="Nombre completo del operario"
            value={operarioForm.nombre}
            onChangeText={(v) => setCampoOperario('nombre', v)}
            error={erroresOperario.nombre}
          />
          <CampoTexto
            etiqueta="EMAIL (opcional)"
            placeholder="contacto@ejemplo.com"
            value={operarioForm.email}
            onChangeText={(v) => setCampoOperario('email', v)}
            error={erroresOperario.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <CampoTexto
            etiqueta="CONTRASEÑA"
            placeholder="Mínimo 8 caracteres"
            value={operarioForm.password}
            onChangeText={(v) => setCampoOperario('password', v)}
            error={erroresOperario.password}
            secureTextEntry
          />
          <CampoTexto
            etiqueta="CONFIRMAR CONTRASEÑA"
            placeholder="Repetir contraseña"
            value={operarioForm.confirmar_password}
            onChangeText={(v) => setCampoOperario('confirmar_password', v)}
            error={erroresOperario.confirmar_password}
            secureTextEntry
          />

          {/* Checkbox de consentimiento (Ley 1581/2012) */}
          <Pressable
            onPress={() => setCampoOperario('consentimiento', !operarioForm.consentimiento)}
            disabled={cargando}
            style={({ pressed }) => [
              styles.consentimientoFila,
              pressed && styles.pressed,
            ]}
          >
            <Switch
              value={operarioForm.consentimiento}
              onValueChange={(v) => setCampoOperario('consentimiento', v)}
              disabled={cargando}
              trackColor={{ false: COLORS.outlineVariant, true: COLORS.primaryContainer }}
              thumbColor={COLORS.surfaceContainerLowest}
            />
            <Text style={styles.consentimientoTexto}>
              Acepto el tratamiento de mis datos personales según la Ley 1581/2012.
            </Text>
          </Pressable>
          {erroresOperario.consentimiento !== undefined && (
            <Text style={styles.errorText}>{erroresOperario.consentimiento}</Text>
          )}
        </View>

        {errorGlobal !== undefined && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTexto}>{errorGlobal}</Text>
          </View>
        )}

        <View style={styles.filaBotones}>
          <Pressable
            onPress={handleAtras}
            style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPresionado]}
            disabled={cargando}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
            <Text style={styles.textoBotonSecundario}>ATRÁS</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleFinalizar()}
            style={({ pressed }) => [
              styles.botonPrimario,
              styles.botonPrimarioFlexible,
              cargando && styles.botonDeshabilitado,
              pressed && styles.botonPresionado,
            ]}
            disabled={cargando}
          >
            {cargando ? (
              <ActivityIndicator color={COLORS.onPrimary} size="small" />
            ) : (
              <>
                <Text style={styles.textoBotonPrimario}>FINALIZAR</Text>
                <MaterialIcons name="check" size={20} color={COLORS.onPrimary} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

interface CampoTextoProps {
  readonly etiqueta: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly error?: string;
  readonly keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  readonly autoCapitalize?: 'none' | 'sentences';
  readonly maxLength?: number;
  readonly secureTextEntry?: boolean;
}

function CampoTexto({
  etiqueta,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  secureTextEntry = false,
}: CampoTextoProps) {
  return (
    <View style={styles.campoContenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[styles.input, error !== undefined && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.outline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
      />
      {error !== undefined && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

interface CampoNumeroProps {
  readonly etiqueta: string;
  readonly value: number;
  readonly onChangeNumber: (v: number) => void;
  readonly error?: string;
}

function CampoNumero({ etiqueta, value, onChangeNumber, error }: CampoNumeroProps) {
  return (
    <View style={styles.campoContenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[styles.input, error !== undefined && styles.inputError]}
        value={String(value)}
        onChangeText={(v) => {
          const n = Number.parseInt(v, 10);
          onChangeNumber(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        placeholder="0"
        placeholderTextColor={COLORS.outline}
        keyboardType="numeric"
      />
      {error !== undefined && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  encabezado: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  titulo: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
  },
  subtitulo: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    marginTop: SPACING.xs,
  },
  subtituloSecundario: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  campoContenedor: {
    marginBottom: SPACING.md,
  },
  etiqueta: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingHorizontal: SPACING.md,
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceContainerLowest,
  },
  chipSel: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  chipTextSel: {
    fontWeight: '700',
  },
  filaDosColumnas: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  colMitad: {
    flex: 1,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  botonPrimario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 48,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: RADIUS.md,
  },
  botonPrimarioFlexible: {
    flex: 2,
  },
  botonSecundario: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 48,
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.outlineVariant,
  },
  textoBotonPrimario: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textoBotonSecundario: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  botonPresionado: {
    opacity: 0.85,
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  errorBanner: {
    backgroundColor: COLORS.errorContainer,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorBannerTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.error,
  },
  pressed: {
    opacity: 0.7,
  },
  consentimientoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  consentimientoTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurface,
    flex: 1,
  },
});
