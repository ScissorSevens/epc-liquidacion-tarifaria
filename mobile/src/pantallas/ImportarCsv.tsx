import { useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { parsearCSV } from '@dominio/importacion/parser-csv';
import type {
  ErrorImportacion,
  ErrorParseo,
  FilaCSV,
  ItemSaltado,
  ResultadoImportacion,
} from '@dominio/importacion/types';
import { persistirYEncolarImportacion } from '../adapters/persistir-y-encolar-importacion';
import { getBootstrap } from '../composition/get-bootstrap';
import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = ConfigStackScreenProps<'ImportarCsv'>;

// Header nuevo (7 columnas) — codigo y numero_medidor se asignan automáticamente.
const HEADER_ESPERADO_TXT =
  'nombre_apellidos,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';

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
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>({ fase: 'idle' });
  const [dialogFormatoVisible, setDialogFormatoVisible] = useState(false);
  const [dialogConfirmGrande, setDialogConfirmGrande] = useState<{
    visible: boolean;
    archivo: ArchivoLeido | null;
  }>({ visible: false, archivo: null });

  function reset() {
    setEstado({ fase: 'idle' });
    setDialogFormatoVisible(false);
    setDialogConfirmGrande({ visible: false, archivo: null });
  }

  // Resetea estado al perder foco — evita que quede pegada en fase resultado
  useFocusEffect(useCallback(() => {
    return () => { reset(); };
  }, []));

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
      // Camino 3 (D33+): persistir + encolar en una sola operacion.
      // Antes solo persistia (importarSuscriptoresYMedidores) y la cola
      // quedaba vacia → el backend nunca veia los suscriptores nuevos.
      const { reporte } = await persistirYEncolarImportacion({
        filas: archivo.filas,
        suscriptorRepo: bs.suscriptorRepo,
        medidorRepo: bs.medidorRepo,
        colaRepo: bs.colaRepo,
        idGenerator: bs.idGenerator,
        hasher: bs.hasher,
      });
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
    <View style={styles.root}>
      {/* Header brutalist */}
      <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={estado.fase === 'leyendo' || estado.fase === 'importando'}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressedDark]}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>IMPORTAR CSV</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 + 20 }]}>
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
            onVolverInicio={() => {
              navigation.popToTop();
              navigation.navigate('Inicio', { screen: 'RutaDeHoy' });
            }}
            onImportarOtro={reset}
          />
        )}

        {estado.fase === 'error' && (
          <RenderError mensaje={estado.mensaje} onReintentar={reset} />
        )}

        <Text style={styles.brandFooter}>MEDIAPP V1.0.4 - MODO OFFLINE</Text>
      </ScrollView>

      {/* Dialog: formato esperado */}
      <Modal
        visible={dialogFormatoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogFormatoVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDialogFormatoVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitulo}>FORMATO ESPERADO</Text>
            <Text style={styles.modalBody}>
              El archivo debe ser un CSV (separado por comas) con{'\n'}
              <Text style={{ fontWeight: '700' }}>7 columnas</Text> en este orden:
            </Text>
            <Text style={styles.modalCode}>{HEADER_ESPERADO_TXT}</Text>
            <Text style={styles.modalBody}>
              • Código y número de medidor se asignan automáticamente.{'\n'}
              • Encoding: UTF-8.{'\n'}
              • Estrato: entero entre 1 y 6.{'\n'}
              • Fecha de instalación: formato YYYY-MM-DD.{'\n'}
              • Campos opcionales (matrícula, catastral, observaciones) pueden venir vacíos.{'\n'}
              • También acepta el formato legado de 9 columnas con código y número de medidor.
            </Text>
            <Pressable
              onPress={() => setDialogFormatoVisible(false)}
              style={styles.modalBtn}
            >
              <Text style={styles.modalBtnText}>ENTENDIDO</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dialog: archivo grande */}
      <Modal
        visible={dialogConfirmGrande.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogConfirmGrande({ visible: false, archivo: null })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDialogConfirmGrande({ visible: false, archivo: null })}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitulo}>ARCHIVO GRANDE</Text>
            <Text style={styles.modalBody}>
              El archivo tiene {dialogConfirmGrande.archivo?.filas.length ?? 0} filas válidas.
              Procesarlas puede tardar varios segundos y la app puede sentirse lenta.
              ¿Continuar?
            </Text>
            <View style={styles.modalBtnsRow}>
              <Pressable
                onPress={() => setDialogConfirmGrande({ visible: false, archivo: null })}
                style={[styles.modalBtn, styles.modalBtnSecondary]}
              >
                <Text style={styles.modalBtnSecondaryText}>CANCELAR</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const a = dialogConfirmGrande.archivo;
                  setDialogConfirmGrande({ visible: false, archivo: null });
                  if (a) void ejecutarImporte(a);
                }}
                style={styles.modalBtn}
              >
                <Text style={styles.modalBtnText}>CONTINUAR</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>IMPORTAR SUSCRIPTORES DESDE CSV</Text>
      <Text style={styles.cardBody}>
        Cargá un archivo .csv con tus suscriptores y medidores. El sistema
        valida cada fila y reporta duplicados y errores sin abortar el lote.
      </Text>
      <Text style={styles.cardHint}>7 columnas separadas por coma · UTF-8</Text>
      <View style={styles.separador} />
      <Pressable
        onPress={onSeleccionar}
        style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedDark]}
      >
        <MaterialIcons name="upload-file" size={20} color={COLORS.onPrimary} />
        <Text style={styles.btnPrimaryText}>SELECCIONAR ARCHIVO CSV</Text>
      </Pressable>
      <Pressable
        onPress={onVerFormato}
        style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedLight]}
      >
        <Text style={styles.btnSecondaryText}>VER FORMATO ESPERADO</Text>
      </Pressable>
    </View>
  );
}

// ---------- Sub-render: cargando ----------

function RenderCargando({ texto }: { texto: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>{texto}</Text>
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
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>VISTA PREVIA</Text>
      <Text style={styles.cardBody}>
        Archivo: <Text style={styles.bold}>{archivo.nombre}</Text>
      </Text>
      <Text style={styles.bigCount}>
        Se detectaron {archivo.filas.length} fila
        {archivo.filas.length === 1 ? '' : 's'} válida
        {archivo.filas.length === 1 ? '' : 's'}.
      </Text>

      {hayErroresParseo && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠ {archivo.erroresParseo.length} fila
            {archivo.erroresParseo.length === 1 ? '' : 's'} con errores de
            formato (se omitirán):
          </Text>
          {archivo.erroresParseo.slice(0, 5).map((e, i) => (
            <Text key={i} style={styles.warningText}>
              • Línea {e.linea}: {e.mensaje}
            </Text>
          ))}
          {archivo.erroresParseo.length > 5 && (
            <Text style={styles.warningText}>
              … y {archivo.erroresParseo.length - 5} más.
            </Text>
          )}
        </View>
      )}

      {grande && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠ Archivo grande ({archivo.filas.length} filas). El proceso puede tardar.
          </Text>
        </View>
      )}

      <View style={styles.separador} />
      <View style={styles.botonesRow}>
        <Pressable
          onPress={onCancelar}
          style={({ pressed }) => [styles.btnSecondary, styles.flex1, pressed && styles.pressedLight]}
        >
          <Text style={styles.btnSecondaryText}>CANCELAR</Text>
        </Pressable>
        <Pressable
          onPress={onConfirmar}
          disabled={archivo.filas.length === 0}
          style={({ pressed }) => [
            styles.btnPrimary,
            styles.flex1,
            archivo.filas.length === 0 && styles.btnDisabled,
            pressed && styles.pressedDark,
          ]}
        >
          <MaterialIcons name="cloud-upload" size={18} color={COLORS.onPrimary} />
          <Text style={styles.btnPrimaryText}>IMPORTAR</Text>
        </Pressable>
      </View>
    </View>
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
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>RESULTADO DE LA IMPORTACIÓN</Text>
      <Text style={styles.cardHint}>{archivoNombre}</Text>
      <View style={styles.separador} />

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>SUSCRIPTORES CREADOS</Text>
        <Text style={styles.metricValorOk}>{reporte.suscriptoresCreados}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>MEDIDORES CREADOS</Text>
        <Text style={styles.metricValorOk}>{reporte.medidoresCreados}</Text>
      </View>

      {dupSus.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>SUSCRIPTORES DUPLICADOS</Text>
          <Text style={styles.metricValorWarn}>{dupSus.length}</Text>
        </View>
      )}
      {dupMed.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>MEDIDORES DUPLICADOS</Text>
          <Text style={styles.metricValorWarn}>{dupMed.length}</Text>
        </View>
      )}
      {reporte.errores.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>ERRORES</Text>
          <Text style={styles.metricValorErr}>{reporte.errores.length}</Text>
        </View>
      )}

      {(reporte.saltados.length > 0 || reporte.errores.length > 0) && (
        <DetalleListas saltados={reporte.saltados} errores={reporte.errores} />
      )}

      <View style={styles.separador} />
      <View style={styles.botonesRow}>
        <Pressable
          onPress={onImportarOtro}
          style={({ pressed }) => [styles.btnSecondary, styles.flex1, pressed && styles.pressedLight]}
        >
          <Text style={styles.btnSecondaryText}>IMPORTAR OTRO</Text>
        </Pressable>
        <Pressable
          onPress={onVolverInicio}
          style={({ pressed }) => [styles.btnPrimary, styles.flex1, pressed && styles.pressedDark]}
        >
          <MaterialIcons name="home" size={18} color={COLORS.onPrimary} />
          <Text style={styles.btnPrimaryText}>INICIO</Text>
        </Pressable>
      </View>
    </View>
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
    <View style={{ marginTop: SPACING.md }}>
      {saltados.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={[styles.warningText, { fontWeight: '700', marginBottom: SPACING.xs }]}>
            Duplicados ({saltados.length})
          </Text>
          {saltados.map((s, i) => (
            <Text key={`s-${i}`} style={styles.warningText}>
              • Línea {s.linea} —{' '}
              {s.motivo === 'suscriptor_duplicado'
                ? `Suscriptor código ${s.codigo ?? '?'}`
                : `Medidor número ${s.numero_medidor ?? '?'}`}
            </Text>
          ))}
        </View>
      )}
      {errores.length > 0 && (
        <View style={[styles.warningBox, { marginTop: SPACING.sm }]}>
          <Text style={[styles.warningText, { fontWeight: '700', marginBottom: SPACING.xs, color: COLORS.error }]}>
            Errores ({errores.length})
          </Text>
          {errores.map((e, i) => (
            <Text key={`e-${i}`} style={[styles.warningText, { color: COLORS.error }]}>
              • Línea {e.linea}: {e.mensaje}
            </Text>
          ))}
        </View>
      )}
    </View>
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
    <View style={styles.errorCard}>
      <Text style={styles.errorTitulo}>✗ NO SE PUDO PROCESAR EL ARCHIVO</Text>
      <Text style={styles.errorBody}>{mensaje}</Text>
      <Pressable
        onPress={onReintentar}
        style={({ pressed }) => [styles.btnPrimary, { marginTop: SPACING.md }, pressed && styles.pressedDark]}
      >
        <MaterialIcons name="refresh" size={18} color={COLORS.onPrimary} />
        <Text style={styles.btnPrimaryText}>REINTENTAR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outline,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  headerTitle: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },

  // Scroll
  scroll: { padding: SPACING.margin, paddingBottom: SPACING.xl },

  // Card
  card: {
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
  },
  cardTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  cardBody: { ...TYPOGRAPHY.bodyMd, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  cardHint: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, opacity: 0.7 },
  bold: { fontWeight: '700' },
  bigCount: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },

  // Separador
  separador: { height: 1, backgroundColor: COLORS.outline, marginVertical: SPACING.md },

  // Botones
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
    minHeight: 48,
    marginTop: SPACING.md,
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...BORDERS.thin,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
    marginTop: SPACING.sm,
    minHeight: 44,
  },
  btnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btnDisabled: { backgroundColor: COLORS.textSecondary },
  botonesRow: { flexDirection: 'row', gap: SPACING.sm },
  flex1: { flex: 1 },

  // Loading
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.margin,
    gap: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  // Warning box
  warningBox: {
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginVertical: SPACING.sm,
  },
  warningText: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary },

  // Métricas
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValorOk: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  metricValorWarn: { ...TYPOGRAPHY.headlineSm, color: '#ef6c00' },
  metricValorErr: { ...TYPOGRAPHY.headlineSm, color: COLORS.error },

  // Error card
  errorCard: {
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.errorContainer,
    borderColor: COLORS.error,
    marginBottom: SPACING.md,
  },
  errorTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.error,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  errorBody: { ...TYPOGRAPHY.bodyMd, color: COLORS.error },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.margin,
  },
  modalCard: {
    backgroundColor: COLORS.background,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    width: '100%',
    gap: SPACING.md,
  },
  modalTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  modalCode: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    fontFamily: 'monospace',
  },
  modalBody: { ...TYPOGRAPHY.bodySm, color: COLORS.textSecondary, lineHeight: 20 },
  modalBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
    alignItems: 'center',
    marginTop: SPACING.sm,
    flex: 1,
  },
  modalBtnText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, textTransform: 'uppercase' },
  modalBtnSecondary: {
    backgroundColor: 'transparent',
    ...BORDERS.thin,
  },
  modalBtnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  modalBtnsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },

  // Brand footer
  brandFooter: {
    ...TYPOGRAPHY.labelSm,
    fontSize: 8,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  // Press states
  pressedLight: { opacity: 0.7 },
  pressedDark: { opacity: 0.85 },
});
