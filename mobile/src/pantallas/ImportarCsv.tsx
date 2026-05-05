import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Dialog,
  Divider,
  List,
  Paragraph,
  Portal,
  Text,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { parsearCSV } from '@dominio/importacion/parser-csv';
import { importarSuscriptoresYMedidores } from '@dominio/importacion/importador';
import type {
  ErrorImportacion,
  ErrorParseo,
  FilaCSV,
  ItemSaltado,
  ResultadoImportacion,
} from '@dominio/importacion/types';
import { getBootstrap } from '../composition/get-bootstrap';
import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'ImportarCsv'>;

// Header esperado por el parser. Lo replicamos solo para mostrarlo en el
// dialog de ayuda — la validacion REAL la hace `parsearCSV()`.
const HEADER_ESPERADO_TXT =
  'codigo,nombre_apellidos,direccion,estrato,matricula_inmobiliaria,numero_catastral,numero_medidor,fecha_instalacion,observaciones_medidor';

// Umbral a partir del cual pedimos confirmacion al usuario antes de
// procesar. RN no tiene workers triviales y el bucle es JS thread, asi
// que >500 filas puede sentirse lento en celulares de gama baja.
const UMBRAL_FILAS_GRANDES = 500;

interface ArchivoLeido {
  readonly nombre: string;
  readonly filas: ReadonlyArray<FilaCSV>;
  readonly erroresParseo: ReadonlyArray<ErrorParseo>;
}

type Estado =
  | { fase: 'idle' }
  | { fase: 'leyendo' }
  | { fase: 'preview'; archivo: ArchivoLeido }
  | { fase: 'importando' }
  | { fase: 'resultado'; reporte: ResultadoImportacion; archivoNombre: string }
  | { fase: 'error'; mensaje: string };

/**
 * Pantalla de importacion CSV.
 *
 * Flujo:
 *   1. idle      -> usuario toca "Seleccionar archivo".
 *   2. leyendo   -> DocumentPicker + lectura via expo-file-system (`new
 *                   File(uri).text()`, API nueva de SDK 54).
 *   3. preview   -> muestra nombre, filas validas detectadas y errores
 *                   de parseo si hubo. El usuario confirma o cancela.
 *   4. importando -> recorre filas, llama al importador puro del dominio
 *                    (cross-platform, depende solo de los puertos repo).
 *   5. resultado -> reporte con creados / saltados / errores. Botones
 *                    para volver al inicio o importar otro.
 *
 * Validacion del header: la hace `parsearCSV()` mismo. Si el header es
 * invalido devuelve `{ filas: [], errores: [{ linea: 1, ... }] }`. Lo
 * detectamos y vamos a fase `error` SIN llamar al importador con basura.
 *
 * Encoding: UTF-8 (default de `File.text()`). Si el CSV viene en
 * Windows-1252 o latin1 (Excel comun), se va a ver con caracteres raros
 * pero no rompe — deuda explicita, ver reporte del sub-agente.
 */
export default function ImportarCsv({ navigation }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'idle' });
  const [dialogFormatoVisible, setDialogFormatoVisible] = useState(false);
  const [dialogConfirmGrande, setDialogConfirmGrande] = useState<{
    visible: boolean;
    archivo: ArchivoLeido | null;
  }>({ visible: false, archivo: null });

  function reset() {
    setEstado({ fase: 'idle' });
  }

  async function seleccionarArchivo() {
    setEstado({ fase: 'leyendo' });
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Multiples MIME por compatibilidad: algunos proveedores Android
        // (Drive, Files) marcan CSV como `text/comma-separated-values` o
        // incluso `application/octet-stream`. `*/*` como ultimo recurso.
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        // Usuario cerro el picker: silencioso, vuelve a idle.
        setEstado({ fase: 'idle' });
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        setEstado({
          fase: 'error',
          mensaje: 'No se recibió ningún archivo del selector.',
        });
        return;
      }

      // API nueva de expo-file-system (SDK 54): `File` class.
      // `text()` lee como UTF-8 y devuelve string.
      const archivo = new File(asset.uri);
      const contenido = await archivo.text();

      const { filas, errores } = parsearCSV(contenido);

      // Header invalido o CSV vacio: el parser devuelve filas=[] y
      // un unico error en linea 1 con mensaje descriptivo. NO seguimos.
      if (filas.length === 0 && errores.length > 0 && errores[0]?.linea === 1) {
        setEstado({
          fase: 'error',
          mensaje: errores[0].mensaje,
        });
        return;
      }

      setEstado({
        fase: 'preview',
        archivo: {
          nombre: asset.name,
          filas,
          erroresParseo: errores,
        },
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      setEstado({
        fase: 'error',
        mensaje: `Error al leer el archivo: ${mensaje}`,
      });
    }
  }

  async function ejecutarImporte(archivo: ArchivoLeido) {
    setEstado({ fase: 'importando' });
    try {
      const bs = await getBootstrap();
      const reporte = await importarSuscriptoresYMedidores(
        archivo.filas,
        bs.suscriptorRepo,
        bs.medidorRepo,
      );
      setEstado({
        fase: 'resultado',
        reporte,
        archivoNombre: archivo.nombre,
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      setEstado({
        fase: 'error',
        mensaje: `Error inesperado durante la importación: ${mensaje}`,
      });
    }
  }

  function confirmarImporte(archivo: ArchivoLeido) {
    if (archivo.filas.length > UMBRAL_FILAS_GRANDES) {
      setDialogConfirmGrande({ visible: true, archivo });
      return;
    }
    void ejecutarImporte(archivo);
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          disabled={estado.fase === 'leyendo' || estado.fase === 'importando'}
        />
        <Appbar.Content title="Importar CSV" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        {estado.fase === 'idle' && (
          <RenderIdle
            onSeleccionar={() => void seleccionarArchivo()}
            onVerFormato={() => setDialogFormatoVisible(true)}
          />
        )}

        {estado.fase === 'leyendo' && <RenderCargando texto="Leyendo archivo…" />}

        {estado.fase === 'preview' && (
          <RenderPreview
            archivo={estado.archivo}
            onConfirmar={() => confirmarImporte(estado.archivo)}
            onCancelar={reset}
          />
        )}

        {estado.fase === 'importando' && (
          <RenderCargando texto="Importando… esto puede tardar un momento." />
        )}

        {estado.fase === 'resultado' && (
          <RenderResultado
            reporte={estado.reporte}
            archivoNombre={estado.archivoNombre}
            onVolverInicio={() => navigation.popToTop()}
            onImportarOtro={reset}
          />
        )}

        {estado.fase === 'error' && (
          <RenderError mensaje={estado.mensaje} onReintentar={reset} />
        )}
      </ScrollView>

      <Portal>
        <Dialog
          visible={dialogFormatoVisible}
          onDismiss={() => setDialogFormatoVisible(false)}
        >
          <Dialog.Title>Formato esperado</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              El archivo debe ser un CSV (separado por comas) con las
              siguientes 9 columnas en este orden:
            </Paragraph>
            <Text variant="bodySmall" style={styles.codeBlock}>
              {HEADER_ESPERADO_TXT}
            </Text>
            <Paragraph style={styles.dialogPara}>
              • Encoding: UTF-8.{'\n'}
              • Estrato: entero entre 1 y 6.{'\n'}
              • Fecha de instalación: formato YYYY-MM-DD.{'\n'}
              • Campos opcionales (matrícula, catastral, observaciones)
              pueden venir vacíos.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogFormatoVisible(false)}>
              Entendido
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={dialogConfirmGrande.visible}
          onDismiss={() =>
            setDialogConfirmGrande({ visible: false, archivo: null })
          }
        >
          <Dialog.Title>Archivo grande</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              El archivo tiene{' '}
              {dialogConfirmGrande.archivo?.filas.length ?? 0} filas
              válidas. Procesarlas puede tardar varios segundos y la app
              puede sentirse lenta. ¿Continuar?
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() =>
                setDialogConfirmGrande({ visible: false, archivo: null })
              }
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const a = dialogConfirmGrande.archivo;
                setDialogConfirmGrande({ visible: false, archivo: null });
                if (a) void ejecutarImporte(a);
              }}
            >
              Continuar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

// ---------- Sub-render: idle ----------

function RenderIdle({
  onSeleccionar,
  onVerFormato,
}: {
  onSeleccionar: () => void;
  onVerFormato: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitulo}>
          Importar suscriptores desde CSV
        </Text>
        <Text variant="bodyMedium" style={styles.cardBody}>
          Cargá un archivo .csv con tus suscriptores y medidores. El
          sistema valida cada fila y reporta duplicados y errores sin
          abortar el lote.
        </Text>
        <Text variant="bodySmall" style={styles.cardHint}>
          Formato: 9 columnas separadas por coma · UTF-8
        </Text>
        <Button
          mode="contained"
          icon="file-upload"
          onPress={onSeleccionar}
          style={styles.cta}
        >
          Seleccionar archivo CSV
        </Button>
        <Button mode="text" onPress={onVerFormato} style={styles.linkBtn}>
          Ver formato esperado
        </Button>
        <Text variant="bodySmall" style={styles.cardHintMuted}>
          Ningún archivo seleccionado.
        </Text>
      </Card.Content>
    </Card>
  );
}

// ---------- Sub-render: cargando ----------

function RenderCargando({ texto }: { texto: string }) {
  return (
    <View style={styles.cargando}>
      <ActivityIndicator size="large" />
      <Text variant="bodyLarge" style={styles.cargandoTexto}>
        {texto}
      </Text>
    </View>
  );
}

// ---------- Sub-render: preview ----------

function RenderPreview({
  archivo,
  onConfirmar,
  onCancelar,
}: {
  archivo: ArchivoLeido;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const grande = archivo.filas.length > UMBRAL_FILAS_GRANDES;
  const hayErroresParseo = archivo.erroresParseo.length > 0;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitulo}>
          Vista previa
        </Text>
        <Text variant="bodyMedium" style={styles.cardBody}>
          Archivo: <Text style={styles.bold}>{archivo.nombre}</Text>
        </Text>
        <Text variant="bodyLarge" style={styles.bigCount}>
          Se detectaron {archivo.filas.length} fila
          {archivo.filas.length === 1 ? '' : 's'} válida
          {archivo.filas.length === 1 ? '' : 's'}.
        </Text>

        {hayErroresParseo && (
          <View style={styles.warningBox}>
            <Text variant="bodyMedium" style={styles.warningTitulo}>
              ⚠ {archivo.erroresParseo.length} fila
              {archivo.erroresParseo.length === 1 ? '' : 's'} con errores de
              formato (se omitirán):
            </Text>
            {archivo.erroresParseo.slice(0, 5).map((e, i) => (
              <Text key={i} variant="bodySmall" style={styles.warningItem}>
                • Línea {e.linea}: {e.mensaje}
              </Text>
            ))}
            {archivo.erroresParseo.length > 5 && (
              <Text variant="bodySmall" style={styles.warningItem}>
                … y {archivo.erroresParseo.length - 5} más.
              </Text>
            )}
          </View>
        )}

        {grande && (
          <View style={styles.warningBox}>
            <Text variant="bodyMedium" style={styles.warningTitulo}>
              ⚠ Archivo grande ({archivo.filas.length} filas). El proceso
              puede tardar.
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Button mode="text" onPress={onCancelar} style={styles.flex1}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            icon="database-import"
            onPress={onConfirmar}
            style={styles.flex1}
            disabled={archivo.filas.length === 0}
          >
            Importar
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

// ---------- Sub-render: resultado ----------

function RenderResultado({
  reporte,
  archivoNombre,
  onVolverInicio,
  onImportarOtro,
}: {
  reporte: ResultadoImportacion;
  archivoNombre: string;
  onVolverInicio: () => void;
  onImportarOtro: () => void;
}) {
  const dupSus = reporte.saltados.filter(
    (s) => s.motivo === 'suscriptor_duplicado',
  );
  const dupMed = reporte.saltados.filter(
    (s) => s.motivo === 'medidor_duplicado',
  );

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.cardTitulo}>
          Resultado de la importación
        </Text>
        <Text variant="bodySmall" style={styles.cardHintMuted}>
          {archivoNombre}
        </Text>

        <Divider style={styles.divider} />

        <View style={styles.metricRow}>
          <Text variant="bodyLarge" style={styles.metricOk}>
            ✓ Suscriptores creados
          </Text>
          <Text variant="bodyLarge" style={styles.metricNum}>
            {reporte.suscriptoresCreados}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text variant="bodyLarge" style={styles.metricOk}>
            ✓ Medidores creados
          </Text>
          <Text variant="bodyLarge" style={styles.metricNum}>
            {reporte.medidoresCreados}
          </Text>
        </View>

        {dupSus.length > 0 && (
          <View style={styles.metricRow}>
            <Text variant="bodyLarge" style={styles.metricWarn}>
              ⚠ Suscriptores duplicados (omitidos)
            </Text>
            <Text variant="bodyLarge" style={styles.metricNum}>
              {dupSus.length}
            </Text>
          </View>
        )}
        {dupMed.length > 0 && (
          <View style={styles.metricRow}>
            <Text variant="bodyLarge" style={styles.metricWarn}>
              ⚠ Medidores duplicados (omitidos)
            </Text>
            <Text variant="bodyLarge" style={styles.metricNum}>
              {dupMed.length}
            </Text>
          </View>
        )}

        {reporte.errores.length > 0 && (
          <View style={styles.metricRow}>
            <Text variant="bodyLarge" style={styles.metricErr}>
              ✗ Errores
            </Text>
            <Text variant="bodyLarge" style={styles.metricNum}>
              {reporte.errores.length}
            </Text>
          </View>
        )}

        {(reporte.errores.length > 0 || reporte.saltados.length > 0) && (
          <DetalleListas saltados={reporte.saltados} errores={reporte.errores} />
        )}

        <Divider style={styles.divider} />

        <View style={styles.row}>
          <Button mode="text" onPress={onImportarOtro} style={styles.flex1}>
            Importar otro
          </Button>
          <Button
            mode="contained"
            icon="home"
            onPress={onVolverInicio}
            style={styles.flex1}
          >
            Volver al inicio
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function DetalleListas({
  saltados,
  errores,
}: {
  saltados: ReadonlyArray<ItemSaltado>;
  errores: ReadonlyArray<ErrorImportacion>;
}) {
  return (
    <List.Section>
      {saltados.length > 0 && (
        <List.Accordion
          title={`Detalle de duplicados (${saltados.length})`}
          left={(props) => <List.Icon {...props} icon="alert-circle-outline" />}
        >
          {saltados.map((s, i) => (
            <List.Item
              key={`s-${i}`}
              title={
                s.motivo === 'suscriptor_duplicado'
                  ? `Suscriptor código ${s.codigo ?? '?'}`
                  : `Medidor número ${s.numero_medidor ?? '?'}`
              }
              description={`Línea ${s.linea} — ${s.motivo.replace('_', ' ')}`}
              titleNumberOfLines={2}
              descriptionNumberOfLines={2}
            />
          ))}
        </List.Accordion>
      )}
      {errores.length > 0 && (
        <List.Accordion
          title={`Detalle de errores (${errores.length})`}
          left={(props) => <List.Icon {...props} icon="alert-octagon-outline" />}
        >
          {errores.map((e, i) => (
            <List.Item
              key={`e-${i}`}
              title={`Línea ${e.linea}`}
              description={e.mensaje}
              titleNumberOfLines={1}
              descriptionNumberOfLines={4}
            />
          ))}
        </List.Accordion>
      )}
    </List.Section>
  );
}

// ---------- Sub-render: error ----------

function RenderError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <Card style={[styles.card, styles.cardError]}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.errorTitulo}>
          ✗ No se pudo procesar el archivo
        </Text>
        <Text variant="bodyMedium" style={styles.errorBody}>
          {mensaje}
        </Text>
        <Button
          mode="contained"
          icon="refresh"
          onPress={onReintentar}
          style={styles.cta}
        >
          Reintentar
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  card: { marginBottom: 16 },
  cardError: { backgroundColor: '#fdecea' },
  cardTitulo: { marginBottom: 8 },
  cardBody: { marginBottom: 8 },
  cardHint: { opacity: 0.7, marginBottom: 16 },
  cardHintMuted: { opacity: 0.6, marginTop: 12, textAlign: 'center' },
  cta: { marginTop: 8 },
  linkBtn: { marginTop: 4 },
  bold: { fontWeight: '700' },
  bigCount: { marginTop: 8, marginBottom: 12, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
  flex1: { flex: 1 },
  divider: { marginVertical: 12 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricOk: { color: '#2e7d32' },
  metricWarn: { color: '#ef6c00' },
  metricErr: { color: '#c62828' },
  metricNum: { fontWeight: '700' },
  warningBox: {
    backgroundColor: '#fff4e5',
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  warningTitulo: { color: '#a65a00', fontWeight: '600', marginBottom: 4 },
  warningItem: { color: '#5a3d00', marginLeft: 4 },
  errorTitulo: { color: '#b71c1c', marginBottom: 8 },
  errorBody: { color: '#5d1010', marginBottom: 16 },
  codeBlock: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  dialogPara: { marginTop: 8 },
  cargando: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cargandoTexto: { marginTop: 16, textAlign: 'center' },
});
