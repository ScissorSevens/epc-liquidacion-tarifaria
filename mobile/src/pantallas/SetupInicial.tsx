import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
import { BotonPrimario } from '../componentes/BotonPrimario';
import { FormField } from '../componentes/FormField';
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
 * Al tocar [Finalizar] con form valido:
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
 *
 * Migracion a FormField (Commit 4 — impeccable craft):
 *   - Reemplaza los helpers locales CampoTexto y CampoNumero.
 *   - 14 inputs de texto/numericos migrados al FormField reusable.
 *   - Validacion del componente ya viene del callsite via prop `error`.
 *   - Toques de craft: required asterisk, accesibilidad, touch target.
 *   - Elimina 50+ lineas de StyleSheet inline duplicadas.
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
        prestadorRepo: bs.repos.prestadorRepo,
        acuerdoRepo: bs.repos.acuerdoMunicipalRepo,
        parametrosRepo: bs.repos.parametrosTarifaRepo,
        operarioRepo: bs.repos.operarioRepo,
        hasher: bs.adapters.hasher,
        idGenerator: bs.adapters.idGenerator,
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
            <FormField
              label="Nombre del prestador"
              required
              value={prestadorForm.nombre}
              onChangeText={(v) => setCampoPrestador('nombre', v)}
              error={erroresPrestador.nombre}
              maxLength={200}
              editable={!cargando}
              placeholder="Ej: Asociacion de Usuarios La Esperanza"
              testID="setup-prestador-nombre"
            />
            <FormField
              label="NIT"
              required
              value={prestadorForm.nit}
              onChangeText={(v) => setCampoPrestador('nit', v)}
              error={erroresPrestador.nit}
              maxLength={20}
              editable={!cargando}
              placeholder="Ej: 900123456-7"
              testID="setup-prestador-nit"
            />
            <FormField
              label="Representante legal"
              required
              value={prestadorForm.representante_legal}
              onChangeText={(v) => setCampoPrestador('representante_legal', v)}
              error={erroresPrestador.representante_legal}
              editable={!cargando}
              placeholder="Nombre completo"
              testID="setup-prestador-rep-legal"
            />
            <FormField
              label="Cédula del representante"
              required
              value={prestadorForm.representante_legal_cedula}
              onChangeText={(v) =>
                setCampoPrestador('representante_legal_cedula', v.replace(/\D/g, ''))
              }
              error={erroresPrestador.representante_legal_cedula}
              keyboardType="numeric"
              maxLength={12}
              editable={!cargando}
              placeholder="6 a 12 dígitos"
              testID="setup-prestador-rep-cedula"
            />
            <FormField
              label="Municipio"
              required
              value={prestadorForm.municipio}
              onChangeText={(v) => setCampoPrestador('municipio', v)}
              error={erroresPrestador.municipio}
              maxLength={100}
              editable={!cargando}
              placeholder="Ej: Caqueza"
              testID="setup-prestador-municipio"
            />
            <FormField
              label="Departamento"
              required
              value={prestadorForm.departamento}
              onChangeText={(v) => setCampoPrestador('departamento', v)}
              error={erroresPrestador.departamento}
              maxLength={100}
              editable={!cargando}
              placeholder="Ej: Cundinamarca"
              testID="setup-prestador-departamento"
            />

            <View style={styles.campoContenedor}>
              <Text style={styles.etiqueta}>
                Segmento <Text style={styles.requerido}>*</Text>
              </Text>
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
                    accessibilityRole="button"
                    accessibilityLabel={`Segmento ${s === 1 ? 'urbano' : 'rural'}`}
                    accessibilityState={{ selected: prestadorForm.segmento === s }}
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
                <FormField
                  label="Suscriptores urbanos"
                  required
                  value={String(prestadorForm.num_suscriptores_urbanos)}
                  onChangeText={(v) => {
                    const n = Number.parseInt(v, 10);
                    setCampoPrestador(
                      'num_suscriptores_urbanos',
                      Number.isFinite(n) && n >= 0 ? n : 0,
                    );
                  }}
                  error={erroresPrestador.num_suscriptores_urbanos}
                  keyboardType="numeric"
                  editable={!cargando}
                  placeholder="0"
                  testID="setup-prestador-suscriptores-urbanos"
                />
              </View>
              <View style={styles.colMitad}>
                <FormField
                  label="Suscriptores rurales"
                  required
                  value={String(prestadorForm.num_suscriptores_rurales)}
                  onChangeText={(v) => {
                    const n = Number.parseInt(v, 10);
                    setCampoPrestador(
                      'num_suscriptores_rurales',
                      Number.isFinite(n) && n >= 0 ? n : 0,
                    );
                  }}
                  error={erroresPrestador.num_suscriptores_rurales}
                  keyboardType="numeric"
                  editable={!cargando}
                  placeholder="0"
                  testID="setup-prestador-suscriptores-rurales"
                />
              </View>
            </View>

            <FormField
              label="Email corporativo (opcional)"
              value={prestadorForm.email}
              onChangeText={(v) => setCampoPrestador('email', v)}
              error={erroresPrestador.email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!cargando}
              placeholder="contacto@ejemplo.com"
              testID="setup-prestador-email"
            />
            <FormField
              label="Teléfono (opcional)"
              value={prestadorForm.telefono}
              onChangeText={(v) => setCampoPrestador('telefono', v)}
              error={erroresPrestador.telefono}
              keyboardType="phone-pad"
              editable={!cargando}
              placeholder="Ej: 311 222 3344"
              testID="setup-prestador-telefono"
            />
          </View>

          {errorGlobal !== undefined && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTexto}>{errorGlobal}</Text>
            </View>
          )}

          <BotonPrimario
            texto="Siguiente"
            icono="arrow-forward"
            tono="amarillo"
            onPress={handleSiguiente}
            testID="siguiente-btn"
          />
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
          <FormField
            label="Cédula"
            required
            value={operarioForm.cedula}
            onChangeText={(v) => setCampoOperario('cedula', v.replace(/\D/g, ''))}
            error={erroresOperario.cedula}
            keyboardType="numeric"
            maxLength={12}
            editable={!cargando}
            placeholder="6 a 12 dígitos"
            testID="setup-operario-cedula"
          />
          <FormField
            label="Nombre completo"
            required
            value={operarioForm.nombre}
            onChangeText={(v) => setCampoOperario('nombre', v)}
            error={erroresOperario.nombre}
            editable={!cargando}
            placeholder="Nombre completo del operario"
            testID="setup-operario-nombre"
          />
          <FormField
            label="Email (opcional)"
            value={operarioForm.email}
            onChangeText={(v) => setCampoOperario('email', v)}
            error={erroresOperario.email}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!cargando}
            placeholder="contacto@ejemplo.com"
            testID="setup-operario-email"
          />
          <FormField
            label="Contraseña"
            required
            value={operarioForm.password}
            onChangeText={(v) => setCampoOperario('password', v)}
            error={erroresOperario.password}
            secureTextEntry
            editable={!cargando}
            placeholder="Mínimo 8 caracteres"
            helperText="La contraseña se guarda hasheada con SHA-256"
            testID="setup-operario-password"
          />
          <FormField
            label="Confirmar contraseña"
            required
            value={operarioForm.confirmar_password}
            onChangeText={(v) => setCampoOperario('confirmar_password', v)}
            error={erroresOperario.confirmar_password}
            secureTextEntry
            editable={!cargando}
            placeholder="Repetir contraseña"
            testID="setup-operario-confirmar"
          />

          {/* Checkbox de consentimiento (Ley 1581/2012) */}
          <Pressable
            onPress={() => setCampoOperario('consentimiento', !operarioForm.consentimiento)}
            disabled={cargando}
            style={({ pressed }) => [
              styles.consentimientoFila,
              pressed && styles.pressed,
            ]}
            accessibilityRole="switch"
            accessibilityLabel="Consentimiento para el tratamiento de datos personales"
            accessibilityState={{ checked: operarioForm.consentimiento }}
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
          <View style={styles.botonSecundarioWrap}>
            <Pressable
              onPress={handleAtras}
              style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPresionado]}
              disabled={cargando}
              accessibilityRole="button"
              accessibilityLabel="Volver al paso 1"
            >
              <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.textoBotonSecundario}>Atrás</Text>
            </Pressable>
          </View>
          <View style={styles.botonPrimarioWrap}>
            <BotonPrimario
              texto="Finalizar"
              textoCargando="Finalizando…"
              icono="check"
              tono="amarillo"
              onPress={() => void handleFinalizar()}
              cargando={cargando}
              testID="finalizar-btn"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: SPACING.xs,
  },
  requerido: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.error,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    height: 44, // WCAG 2.5.5
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
    borderWidth: 0,
  },
  chipText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  chipTextSel: {
    fontWeight: '700',
  },
  errorText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
    marginTop: SPACING.xs,
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
  botonSecundarioWrap: {
    flex: 1,
  },
  botonPrimarioWrap: {
    flex: 2,
  },
  botonSecundario: {
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
  textoBotonSecundario: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  botonPresionado: {
    opacity: 0.85,
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