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
}

/**
 * Login real contra SQLite (TICKET-EPIC-LOGIN-001 / PUNTO A — Fase 5.2).
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
 */
export default function Login({ onLoginSuccess }: Props) {
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState<{ cedula?: boolean; contrasena?: boolean }>({});
  const [cargando, setCargando] = useState(false);

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

        {/* Card de login */}
        <View style={estilos.card}>
          <Text style={estilos.tituloCard}>Bienvenido de nuevo</Text>
          <Text style={estilos.subtituloCard}>
            Ingrese sus credenciales para acceder a su cuenta.
          </Text>

          {/* Campo Cédula */}
          <View style={estilos.campoContenedor}>
            <Text style={estilos.etiqueta}>CÉDULA</Text>
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
            <Text style={estilos.etiqueta}>CONTRASEÑA</Text>
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
    letterSpacing: 0.8,
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
