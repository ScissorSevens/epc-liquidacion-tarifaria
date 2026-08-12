/**
 * Icono del botón Guardar segun plataforma.
 *
 * iOS: SF Symbol "tray.and.arrow.down" (guardar) via expo-image.
 * Android (y default): MaterialIcons "save" via @expo/vector-icons.
 *
 * Esto reemplaza el `<MaterialIcons name="save" />` previo (admin-
 * parametros-tarifa-redesign Task 2). En iOS el SF Symbol usa el
 * weight/style del sistema, se ve mas nitido y respeta el tint del
 * boton (tintColor: systemBlue).
 *
 * Devuelve un ReactNode que se pasa como `iconoComponente` a
 * `BotonPrimario`. En iOS es `<Image>` de expo-image; en Android es
 * `<MaterialIcons>` directo para mantener la propagacion del testID
 * (`param-guardar-icon`) que esperan los tests de regresion.
 *
 * Extraido de `ParametrosTarifa.tsx` (parametros-tarifa-screen-
 * decomposition task 1.1). El comportamiento, props y testID son
 * IDENTICOS al original — solo cambia el archivo.
 */
import React from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export interface IconoGuardarProps {
  readonly colorIcono: string;
  readonly testID?: string;
}

export function IconoGuardar({
  colorIcono,
  testID,
}: IconoGuardarProps): React.ReactNode {
  if (Platform.OS === 'ios') {
    return (
      <Image
        source="sf:tray.and.arrow.down"
        style={{ width: 20, height: 20, tintColor: colorIcono }}
        tintColor={colorIcono}
        testID={testID}
        accessibilityLabel="Guardar parámetros"
      />
    );
  }
  // Android (y default): MaterialIcons directo.
  return (
    <MaterialIcons
      name="save"
      size={20}
      color={colorIcono}
      testID={testID}
      accessibilityLabel="Guardar parámetros"
    />
  );
}

export default IconoGuardar;