import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Snackbar,
  Surface,
  Text,
} from 'react-native-paper';

import {
  calcularSha256DeArchivo,
  persistirFoto,
} from '../adapters/foto-evidencia';
import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'CapturarFoto'>;

interface SnackState {
  visible: boolean;
  mensaje: string;
}

/**
 * Pantalla de captura fotografica del medidor.
 *
 * Flujo:
 *  1) Pide permiso de camara con `useCameraPermissions()`. Si no esta
 *     concedido muestra un mensaje + boton "Otorgar permiso" que vuelve
 *     a disparar el dialog del sistema operativo.
 *  2) Renderiza `<CameraView>` ocupando casi toda la pantalla.
 *  3) Boton "Tomar foto":
 *      a) `takePictureAsync({ quality: 0.7 })` -> URI temporal en cache.
 *      b) `persistirFoto` -> mueve a documentDirectory con nombre estable.
 *      c) `calcularSha256DeArchivo` -> hash hex 64 chars.
 *      d) Navega de vuelta a `CapturarLectura` (`navigation.navigate`)
 *         pasando como param `evidenciaFoto: { foto_path, foto_hash }`.
 *  4) Boton "Cancelar" en el header -> `goBack()` sin payload.
 *
 * react-navigation no soporta "retorno de valores" nativamente. El patron
 * es navegar a la pantalla padre re-pasando todos sus params previos +
 * el campo nuevo. Como `CapturarLectura` es la unica pantalla que abre
 * `CapturarFoto`, asumimos que su entry-point en el stack sigue activa
 * y `navigate` la enfocara reemplazando los params.
 */
export default function CapturarFoto({ navigation, route }: Props) {
  const { id_medidor, id_periodo, id_suscriptor } = route.params;

  const [permiso, pedirPermiso] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [procesando, setProcesando] = useState(false);
  const [snack, setSnack] = useState<SnackState>({
    visible: false,
    mensaje: '',
  });

  function mostrarError(mensaje: string) {
    setSnack({ visible: true, mensaje });
  }

  async function onTomarFoto() {
    if (cameraRef.current === null) return;
    setProcesando(true);
    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });
      if (foto === undefined || foto.uri === undefined) {
        mostrarError('La camara no devolvio una foto valida.');
        return;
      }
      const fotoPath = await persistirFoto(foto.uri, {
        id_medidor,
        id_periodo,
      });
      const fotoHash = await calcularSha256DeArchivo(fotoPath);
      navigation.navigate('CapturarLectura', {
        id_medidor,
        id_suscriptor,
        evidenciaFoto: {
          foto_path: fotoPath,
          foto_hash: fotoHash,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mostrarError(`No se pudo capturar la foto: ${msg}`);
    } finally {
      setProcesando(false);
    }
  }

  // Permiso aun cargando (primer render).
  if (permiso === null) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Tomar foto del medidor" />
        </Appbar.Header>
        <View style={styles.centro}>
          <ActivityIndicator />
          <Text style={styles.mensaje}>Verificando permisos…</Text>
        </View>
      </View>
    );
  }

  if (!permiso.granted) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Tomar foto del medidor" />
        </Appbar.Header>
        <View style={styles.centro}>
          <Surface style={styles.surface} elevation={1}>
            <Text variant="titleMedium" style={styles.titulo}>
              Permiso de camara requerido
            </Text>
            <Text variant="bodyMedium" style={styles.mensaje}>
              MediApp necesita acceso a la camara para registrar la
              evidencia fotografica del medidor.
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                void pedirPermiso();
              }}
              style={styles.boton}
              icon="camera"
            >
              Otorgar permiso
            </Button>
            <Button
              mode="text"
              onPress={() => navigation.goBack()}
              style={styles.boton}
            >
              Cancelar
            </Button>
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          disabled={procesando}
        />
        <Appbar.Content title="Tomar foto del medidor" />
      </Appbar.Header>

      <View style={styles.flex}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          mode="picture"
        />

        <Surface style={styles.barraInferior} elevation={2}>
          {procesando ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator />
              <Text style={styles.loaderText}>
                Guardando y calculando hash…
              </Text>
            </View>
          ) : (
            <Button
              mode="contained"
              icon="camera"
              onPress={() => {
                void onTomarFoto();
              }}
              style={styles.botonCapturar}
            >
              Tomar foto
            </Button>
          )}
        </Surface>
      </View>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={4000}
        style={styles.snackError}
      >
        {snack.mensaje}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  surface: { padding: 16, borderRadius: 8, width: '100%' },
  titulo: { marginBottom: 8 },
  mensaje: { marginBottom: 12, textAlign: 'center' },
  boton: { marginTop: 8 },
  camera: { flex: 1 },
  barraInferior: {
    padding: 16,
    paddingBottom: 32,
  },
  botonCapturar: { paddingVertical: 4 },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { marginLeft: 8 },
  snackError: { backgroundColor: '#c62828' },
});
