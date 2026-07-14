import { useState } from 'react';
import {
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
import { useWorkspace } from '../composicion/useWorkspace';
import { BORDERS, COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

interface Props {
  readonly onLoginSuccess: () => void;
}

const MS_EN_UN_DIA = 24 * 60 * 60 * 1000;
const ID_PRESTADOR_DEMO = 1; // Placeholder hasta Fase 5.2 (backend real)
const NOMBRE_DEMO = 'Operario Demo';

/**
 * Login stub (Fase 4 Tarea 4.2.3) — MODO DEMO.
 *
 * Crea una Sesion fake local para no romper TS con el shape multi-tenant.
 * El backend real (.NET EPC + endpoint /auth) llega en Fase 5.2 (pantallas).
 *
 * La sesion fake tiene:
 *   - token: 'fake-token-' + Date.now()
 *   - cedula: input del usuario (trim)
 *   - nombre: placeholder fijo 'Operario Demo'
 *   - idPrestador: 1 (placeholder; el backend devolvera el real)
 *   - expiresAt: now + 24h
 *
 * Flujo:
 *   1. Valida inputs (cedula no vacia + contrasena >= 8 chars)
 *   2. Construye Sesion fake
 *   3. guardarSesion(sesion) en AsyncStorage
 *   4. useWorkspace.setSesionCompleta(sesion) — sync id_prestador_activo
 *   5. onLoginSuccess() — AuthGate cambia decision a con_sesion
 */
export default function Login({ onLoginSuccess }: Props) {
  const [cedula, setCedula] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState<{ cedula?: boolean; contrasena?: boolean }>({});

  async function handleIngresar() {
    const nuevosErrores: { cedula?: boolean; contrasena?: boolean } = {};
    if (!cedula.trim() || cedula.trim().length < 6) nuevosErrores.cedula = true;
    if (!contrasena || contrasena.length < 8) nuevosErrores.contrasena = true;

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});

    // MODO DEMO — Fase 4.2.3 stub. Backend real en Fase 5.2.
    const sesionFake: Sesion = {
      token: `fake-token-${Date.now()}`,
      cedula: cedula.trim(),
      nombre: NOMBRE_DEMO,
      idPrestador: ID_PRESTADOR_DEMO,
      expiresAt: Date.now() + MS_EN_UN_DIA,
    };

    await guardarSesion(sesionFake);
    await useWorkspace.getState().setSesionCompleta(sesionFake);
    onLoginSuccess();
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
