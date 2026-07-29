import { forwardRef, memo, useId } from 'react';
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';

/**
 * FormField — input de formulario reusable del sistema EPC.
 *
 * Encapsula los principios de craft de impeccable v1 + los
 * non-negotiables de accesibilidad de PRODUCT.md en un solo componente.
 *
 * Decisiones de craft (impeccable v1):
 *   - Label VISIBLE siempre (no solo placeholder). accessibility baseline.
 *   - Asterisco (*) rojo en label cuando required=true (NO uppercase, NO
 *     "(obligatorio)" inline — el asterisco es convención universal de
 *     formularios web y la nota "(opcional)" se mantiene en el callsite).
 *   - Touch target >= 44px (WCAG 2.5.5). height: 48px por defecto.
 *   - borderRadius RADIUS.md (12). NUNCA xl/full/24+ — el sobre-redondeo
 *     en inputs es codex tell.
 *   - Solo border (sin shadow). Esto evita el ghost-card anti-pattern
 *     (border + shadow combo) que veta impecable.
 *   - Error inline con icono MaterialIcons "error-outline" + texto
 *     claro. Color semántico COLORS.error (NO hex hardcodeado).
 *   - helperText debajo del campo. Cuando hay error, el helper se oculta
 *     (prioridad al error para reducir ruido cognitivo).
 *   - accessibilityLabel + accessibilityHint propagados al TextInput.
 *     Defaults sensatos derivados del label y el contexto.
 *   - Sin textTransform: uppercase (ALL CAPS ban). Title Case del callsite.
 *   - Tokens del skeletal-tokens.ts (NO hex hardcodeados).
 *   - placeholder opcional (NO reemplaza al label). Si el callsite lo
 *     quiere pasar, va como hint contextual.
 *
 * Migraciones que este componente desbloquea:
 *   - AltaSuscriptor, EditarSuscriptor, SetupInicial (elimina
 *     CampoTexto/CampoNumero inline con pequenas variaciones).
 *   - admin/AcuerdoMunicipal, admin/ParametrosTarifa,
 *     admin/ImportarPrestadores (los formularios de topes legales).
 *   - Login (migración parcial — preserva el icono izquierdo custom).
 */
type NombreIconoMaterial = ComponentProps<typeof MaterialIcons>['name'];

export interface FormFieldProps {
  /** Etiqueta visible (Title Case, sin ALL CAPS). */
  readonly label: string;
  /** Marca el campo como obligatorio. Muestra asterisco (*) en el label. */
  readonly required?: boolean;
  /** Valor controlado del input. */
  readonly value: string;
  /** Callback al cambiar el texto. */
  readonly onChangeText: (v: string) => void;
  /** Mensaje de error inline. Cuando se provee, oculta el helperText. */
  readonly error?: string;
  /** Texto de ayuda debajo del campo. NO se muestra si hay error. */
  readonly helperText?: string;
  /** Placeholder opcional (NO reemplaza al label — es solo hint contextual). */
  readonly placeholder?: string;
  /** Tipo de teclado. */
  readonly keyboardType?: KeyboardTypeOptions;
  /** Longitud maxima del input. */
  readonly maxLength?: number;
  /** Multilinea. */
  readonly multiline?: boolean;
  /** Numero de lineas visibles (multilinea). */
  readonly numberOfLines?: number;
  /** secureTextEntry — contraseñas. */
  readonly secureTextEntry?: boolean;
  /** autoCapitalize. Default: 'sentences'. */
  readonly autoCapitalize?: TextInputProps['autoCapitalize'];
  /** autoCorrect. Default: false. */
  readonly autoCorrect?: boolean;
  /** Icono Material a la izquierda del input (opcional). */
  readonly icono?: NombreIconoMaterial;
  /** accessibilityLabel override. Default: label. */
  readonly accessibilityLabel?: string;
  /** accessibilityHint override. Default: derivado del contexto. */
  readonly accessibilityHint?: string;
  /** testID para tests. Se propaga al TextInput. */
  readonly testID?: string;
  /** editable. Default: true. */
  readonly editable?: boolean;
  /** onBlur opcional para validación progresiva en el callsite. */
  readonly onBlur?: () => void;
  /** onFocus opcional. */
  readonly onFocus?: () => void;
}

export const FormField = memo(forwardRef<View, FormFieldProps>(function FormField({
  label,
  required = false,
  value,
  onChangeText,
  error,
  helperText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  multiline = false,
  numberOfLines,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  autoCorrect = false,
  icono,
  accessibilityLabel,
  accessibilityHint,
  testID,
  editable = true,
  onBlur,
  onFocus,
}, ref) {
  const autoId = useId();
  const labelId = `ff-label-${autoId}`;
  const hintId = helperText !== undefined ? `ff-helper-${autoId}` : undefined;
  const errorId = error !== undefined ? `ff-error-${autoId}` : undefined;
  // NOTE: accessibilityDescribedBy no existe en RN TextInput props.
  // Vinculamos label→input via accessibilityLabelledBy; el mensaje
  // debajo (error/helper) usa accessibilityLiveRegion="polite" para
  // que el screen reader lo anuncie al cambiar.

  // Construimos el accessibilityLabel final:
  //   - Custom prop gana.
  //   - Si required=true, agregamos "obligatorio" para que el screen
  //     reader lo anuncie sin depender del asterisco visual.
  //   - Default: el label.
  const labelFinal =
    accessibilityLabel ??
    (required ? `${label}, obligatorio` : label);

  // accessibilityHint: el callsite lo puede customizar. Si no, derivamos
  // un hint genérico cuando hay secureTextEntry o un placeholder. Si
  // tampoco eso aplica, dejamos string vacío (NO undefined) para que
  // screen readers anuncien la transición de foco de forma consistente.
  const hintFinal =
    accessibilityHint ??
    (secureTextEntry
      ? 'Campo de contraseña'
      : placeholder !== undefined && placeholder !== ''
        ? `Ejemplo: ${placeholder}`
        : '');

  const conError = error !== undefined;
  const mostrarHelper = !conError && helperText !== undefined;

  return (
    <View ref={ref} style={estilos.contenedor} testID={testID !== undefined ? `${testID}-field` : undefined}>
      {/* Label visible + asterisco si required */}
      <Text
        style={estilos.label}
        accessibilityRole="text"
        nativeID={labelId}
      >
        {label}
        {required && (
          <Text
            style={estilos.labelAsterisco}
            testID={testID !== undefined ? `${testID}-required` : undefined}
            accessibilityElementsHidden
          >
            {' *'}
          </Text>
        )}
      </Text>

      {/* Wrapper del input + icono opcional */}
      <View
        style={[
          estilos.inputFila,
          conError && estilos.inputFilaError,
          multiline && estilos.inputFilaMultilinea,
        ]}
      >
        {icono !== undefined && (
          <MaterialIcons
            name={icono}
            size={20}
            color={COLORS.outline}
            style={estilos.iconoIzquierda}
            testID={testID !== undefined ? `${testID}-icon` : undefined}
            accessibilityElementsHidden
          />
        )}
        <TextInput
          style={[
            estilos.input,
            multiline && estilos.inputMultilinea,
          ]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={COLORS.placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          accessibilityLabel={labelFinal}
          accessibilityHint={hintFinal}
          accessibilityLabelledBy={labelId}
          accessibilityState={{
            disabled: !editable,
          }}
          testID={testID}
          aria-invalid={conError}
          nativeID={testID !== undefined ? `${testID}-input` : undefined}
        />
      </View>

      {/* Mensaje debajo del campo: error (icono + texto) o helperText.
          Prioridad: error > helperText. Si hay error, el helper se oculta
          (UX: menos ruido cognitivo cuando algo falla). */}
      {conError && (
        <View
          style={estilos.errorFila}
          accessibilityLiveRegion="polite"
          nativeID={errorId}
          testID={testID !== undefined ? `${testID}-error` : undefined}
        >
          <MaterialIcons
            name="error-outline"
            size={16}
            color={COLORS.error}
            style={estilos.errorIcono}
            accessibilityElementsHidden
          />
          <Text style={estilos.errorText}>{error}</Text>
        </View>
      )}
      {mostrarHelper && (
        <Text
          style={estilos.helperText}
          nativeID={hintId}
          testID={testID !== undefined ? `${testID}-helper` : undefined}
        >
          {helperText}
        </Text>
      )}
    </View>
  );
}));

const estilos = StyleSheet.create({
  contenedor: {
    gap: SPACING.xs,
  },
  // ── Label ────────────────────────────────────────────────────────────────
  // Sin textTransform: uppercase (ALL CAPS ban de impeccable).
  // El label llega en Title Case desde el callsite.
  label: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurfaceVariant,
  },
  // Asterisco rojo: convención universal de formulario web. Color
  // semantico COLORS.error (mismo que el icono de error) para que el
  // operario relacione visualmente "obligatorio" con "rojo de error".
  labelAsterisco: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.error,
    fontWeight: '700',
  },
  // ── Input wrapper ────────────────────────────────────────────────────────
  // Solo border (sin shadow). Esto evita ghost-card (border + shadow
  // combo). El input vive sobre la superficie, no necesita elevacion
  // visual — el border solo basta para delimitar el touch target.
  inputFila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    minHeight: 48, // WCAG 2.5.5: >= 44px touch target.
  },
  inputFilaError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  inputFilaMultilinea: {
    alignItems: 'flex-start',
  },
  iconoIzquierda: {
    marginLeft: SPACING.sm + 4,
    marginRight: SPACING.xs,
  },
  // ── Input ────────────────────────────────────────────────────────────────
  // height 48px (>= 44). borderRadius RADIUS.md (12). Sin shadow.
  input: {
    flex: 1,
    minHeight: 48, // redundante con la fila, pero deja claro el touch target
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
  },
  inputMultilinea: {
    minHeight: 96,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  // ── Error ────────────────────────────────────────────────────────────────
  // Fila con icono + texto. Color semantico COLORS.error (NO hex).
  errorFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: 2,
  },
  errorIcono: {
    marginTop: 2, // alinea baseline del icono con la primera linea de texto
  },
  errorText: {
    flex: 1,
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
  },
  // ── Helper ───────────────────────────────────────────────────────────────
  helperText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
  },
});