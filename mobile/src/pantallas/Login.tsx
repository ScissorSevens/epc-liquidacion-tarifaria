import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { FooterApp } from '../componentes/FooterApp';
import { guardarSesion, type Sesion } from '../composition/constantes';
import {
  loginLocal,
  ERROR_OPERARIO_NO_ENCONTRADO,
  ERROR_PASSWORD_INCORRECTA,
} from '../composition/login-local';
import { getBootstrap } from '../composition/get-bootstrap';
import { useWorkspace } from '../composicion/useWorkspace';
import { BORDERS, COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

interface Props {
  readonly onLoginSuccess: () => void;
  /**
   * Mensaje opcional que se muestra como banner dismissable arriba del form.
   * Usado por AuthGate (PUNTO C) para informar al operario que su sesion
   * persistida vencio y debe volver a ingresar. Si es undefined, no se
   * rendea banner (cold-boot limpio o sesion invalida donde NO queremos
   * el mensaje "Tu sesion anterior vencio").
   *
   * El mensaje es "semilla": Login lo copia a state interno en el primer
   * render y el state es lo que controla la visibilidad. Asi, si el
   * operario toca la X, el banner se oculta aunque el prop siga siendo
   * el mismo en re-renders futuros (no revive al mensaje dismissed).
   */
  readonly mensajeInicial?: string;
}

/**
 * Login real contra SQLite (TICKET-EPIC-LOGIN-001 / PUNTO A — Fase 5.2)
 * + banner de sesion vencida (PUNTO C — Fase 5 Tarea 5.3).
 *
 * Reemplaza el stub "modo demo" de Fase 4.2.3. Ahora valida cedula +
 * password contra la DB local del dispositivo via `loginLocal()` y crea
 * una Sesion multi-tenant con el idPrestador REAL del operario.
 *
 * Flujo:
 *   1. Valida inputs (cedula >= 6 digitos + contrasena >= 8 chars)
 *   2. Resuelve deps via `getBootstrap()` (operarioRepo + hasher)
 *   3. Llama `loginLocal({ operarioRepo, hasher, cedula, password })`
 *   4. Si OK → guardarSesion(sesion) + setSesionCompleta + onLoginSuccess
 *   5. Si throw OPERARIO_NO_ENCONTRADO  → Alert "No encontramos un operario..."
 *   6. Si throw PASSWORD_INCORRECTA    → Alert "Contrasena incorrecta..."
 *   7. Si throw otro error             → Alert "No se pudo iniciar sesion..."
 *
 * Multi-tenant: la sesion persistida tiene `idPrestador` del operario
 * (NO hardcoded a 1). Cada operario entra a SU prestador.
 *
 * PUNTO C — Banner "Tu sesion anterior vencio":
 *   Si AuthGate detecta que la sesion persistida esta vencida, pasa
 *   `mensajeInicial` y Login rendea un banner amarillo arriba del form.
 *   El operario puede dismissarlo con la X (UX: no forzamos a leer un
 *   mensaje que ya entendio). El state interno `mensajeVisible`
 *   controla la visibilidad; el prop es solo la semilla inicial.
 */
export default function Login({ onLoginSuccess, mensajeInicial }: Props) {
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState<{ cedula?: boolean; contrasena?: boolean }>({});
  const [cargando, setCargando] = useState(false);
  /**
   * Estado interno del banner. Inicializado con mensajeInicial si viene
   * del prop; el operario puede dismissar tocandola X, en cuyo caso
   * queda undefined y no vuelve a aparecer aunque el prop cambie.
   */
  const [mensajeVisible, setMensajeVisible] = useState<string | undefined>(
    mensajeInicial,
  );

  async function handleIngresar() {
    const nuevosErrores: { cedula?: boolean; contrasena?: boolean } = {};
    if (!cedula.trim() || cedula.trim().length < 6) nuevosErrores.cedula = true;
    if (!contrasena || contrasena.length < 8) nuevosErrores.contrasena = true;

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});
    setCargando(true);

    try {
      const { operarioRepo, hasher } = await getBootstrap();
      const resultado = await loginLocal({
        operarioRepo,
        hasher,
        cedula: cedula.trim(),
        password: contrasena,
      });

      // Login OK → persistir sesion + sincronizar workspace + notificar.
      await guardarSesion(resultado.sesion);
      await useWorkspace.getState().setSesionCompleta(resultado.sesion);
      onLoginSuccess();
    } catch (err) {
      const codigo = err instanceof Error ? err.message : String(err);

      if (codigo === ERROR_OPERARIO_NO_ENCONTRADO) {
        Alert.alert(
          'No encontramos tu cuenta',
          'No encontramos un operario con esa cédula. Verificá que hayas completado el setup inicial o contactá al administrador.',
        );
      } else if (codigo === ERROR_PASSWORD_INCORRECTA) {
        Alert.alert(
          'Contraseña incorrecta',
          'La contraseña no coincide. Intentá de nuevo.',
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo iniciar sesión. Detalle técnico: ${codigo}`,
        );
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Encabezado */}
        <View style={estilos.encabezado}>
          <Text style={estilos.tituloApp}>AquaServices</Text>
        </View>

        {/* Banner PUNTO C: sesion vencida, dismissable con X */}
        {mensajeVisible !== undefined && (
          <View
            style={estilos.banner}
            accessibilityRole="alert"
            accessibilityLabel={`Aviso: ${mensajeVisible}`}
          >
            <MaterialIcons
              name="info"
              size={20}
              color={COLORS.warning}
              style={estilos.bannerIcono}
            />
            <Text style={estilos.bannerTexto} numberOfLines={3}>
              {mensajeVisible}
            </Text>
            <Pressable
              onPress={() => setMensajeVisible(undefined)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar mensaje"
              testID="banner-cerrar"
            >
              <MaterialIcons
                name="close"
                size={18}
                color={COLORS.onSurfaceVariant}
              />
            </Pressable>
          </View>
        )}

        {/* Card de login */}
        <View style={estilos.card}>
          <Text style={estilos.tituloCard}>Bienvenido de nuevo</Text>
          <Text style={estilos.subtituloCard}>
            Ingrese sus credenciales para acceder a su cuenta.
          </Text>

          {/* Campo Cédula */}
          <View style={estilos.campoContenedor}>
            <Text style={estilos.etiqueta}>Cédula</Text>
            <View style={[estilos.inputFila, { borderColor: errores.cedula ? COLORS.error : COLORS.outlineVariant }]}>
              <MaterialIcons
                name="badge"
                size={20}
                color={COLORS.outline}
                style={estilos.icono}
              />
              <TextInput
                style={estilos.input}
                placeholder="0.000.000-0"
                placeholderTextColor={COLORS.outline}
                value={cedula}
                onChangeText={setCedula}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Campo Contraseña */}
          <View style={estilos.campoContenedor}>
            <Text style={estilos.etiqueta}>Contraseña</Text>
            <View style={[estilos.inputFila, { borderColor: errores.contrasena ? COLORS.error : COLORS.outlineVariant }]}>
              <MaterialIcons
                name="lock"
                size={20}
                color={COLORS.outline}
                style={estilos.icono}
              />
              <TextInput
                style={[estilos.input, estilos.inputContrasena]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.outline}
                value={contrasena}
                onChangeText={setContrasena}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setVerContrasena(!verContrasena)}
                style={estilos.botonVerContrasena}
                hitSlop={8}
              >
                <MaterialIcons
                  name={verContrasena ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={COLORS.outline}
                />
              </Pressable>
            </View>
          </View>

          {/* Botón Ingresar */}
          <Pressable
            style={({ pressed }) => [estilos.botonIngresar, pressed && estilos.botonPresionado]}
            onPress={handleIngresar}
          >
            <Text style={estilos.textoBoton}>Ingresar</Text>
            <MaterialIcons name="login" size={20} color={COLORS.onPrimary} />
          </Pressable>
        </View>

        {/* Divisor decorativo */}
        <View style={estilos.divisor} />

        <FooterApp />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  encabezado: {
    alignItems: 'center',
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  tituloApp: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
  },
  // PUNTO C — banner amarillo dismissable arriba del form.
  // Por que warningContainer / warning: tokens ya existentes en
  // skeletal-tokens (no agregamos paleta nueva). Fondo amarillo suave
  // + texto/borde naranja para asegurar contraste WCAG AA.
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningContainer,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  bannerIcono: {
    marginRight: SPACING.xs,
  },
  bannerTexto: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onWarningContainer,
    flex: 1,
    lineHeight: 18,
  },
  card: {
    marginHorizontal: SPACING.margin,
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.xl,
    ...SHADOWS.card,
  },
  tituloCard: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtituloCard: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  campoContenedor: {
    marginBottom: SPACING.lg,
  },
  etiqueta: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
    marginBottom: SPACING.xs,
  },
  inputFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.md,
    ...BORDERS.thin,
  },
  icono: {
    marginLeft: SPACING.sm + 4,
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    paddingVertical: SPACING.sm + 4,
    paddingRight: SPACING.sm,
  },
  inputContrasena: {
    paddingRight: 0,
  },
  botonVerContrasena: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.sm + 4,
  },
  botonIngresar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  botonPresionado: {
    opacity: 0.85,
  },
  textoBoton: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.onPrimary,
  },
  divisor: {
    height: 1,
    backgroundColor: COLORS.outlineVariant,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.lg,
  },
});
