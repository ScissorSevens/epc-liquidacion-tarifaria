import { useState } from 'react';
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
import { FooterApp } from '../componentes/FooterApp';
import type { ConfigStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = ConfigStackScreenProps<'ImportarCsv'>;

// Header nuevo (9 columnas, desde COR-09) — `cedula` y `municipio`
// son requeridos por el dominio `crearSuscriptor`. La constante DEBE
// coincidir token-a-token con `HEADER_NUEVO` en `parser-csv.ts`.
// El test de contrato `__tests__/pantallas/importar-csv-header.test.ts`
// enforce esa sincronía — si la UI promete un formato distinto al
// que el parser acepta, el test rompe.
export const HEADER_ESPERADO_TXT =
  'nombre_apellidos,cedula,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';

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
 * Contrato del header: la constante `HEADER_ESPERADO_TXT` (arriba) DEBE
 * coincidir token-a-token con `HEADER_NUEVO` en `parser-csv.ts`. El test
 * `__tests__/pantallas/importar-csv-header.test.ts` enforce esta sincronía.
 * Si la UI promete un header distinto al que el parser espera, el test
 * rompe (COR-09: bug histórico donde la UI mostraba "7 columnas" sin
 * cédula/municipio pero el dominio las exigía).
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
      {/* Top App Bar */}
      <View style={styles.header}>
        <View style={styles.headerIzq}>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={estado.fase === 'leyendo' || estado.fase === 'importando'}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressedDark]}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Importar CSV</Text>
        </View>
        <MaterialIcons name="account-circle" size={24} color={COLORS.primary} />
      </View>

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

        <FooterApp />
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Formato esperado</Text>
              <Pressable onPress={() => setDialogFormatoVisible(false)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color={COLORS.primary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalBody}>
                El archivo debe ser un CSV (separado por comas) con{'\n'}
                <Text style={{ fontWeight: '700' }}>9 columnas</Text> en este orden:
              </Text>
              <Text style={styles.modalCode}>{HEADER_ESPERADO_TXT}</Text>
              <Text style={styles.modalBody}>
                • Cédula y municipio son obligatorios (el dominio los exige NO vacíos).{'\n'}
                • Cédula: entre 6 y 12 dígitos numéricos.{'\n'}
                • Municipio: nombre real del municipio donde se presta el servicio.{'\n'}
                • Código de suscriptor y número de medidor se asignan automáticamente.{'\n'}
                • Encoding: UTF-8.{'\n'}
                • Estrato: entero entre 1 y 6.{'\n'}
                • Fecha de instalación: formato YYYY-MM-DD.{'\n'}
                • Campos opcionales (matrícula, catastral, observaciones) pueden venir vacíos.{'\n'}
                • También acepta el formato legado de 9 columnas con código y número de medidor (sin cédula/municipio).
              </Text>
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setDialogFormatoVisible(false)}
                style={styles.modalBtn}
              >
                <Text style={styles.modalBtnText}>Entendido</Text>
              </Pressable>
            </View>
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
            <Text style={styles.modalTitulo}>Archivo grande</Text>
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
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const a = dialogConfirmGrande.archivo;
                  setDialogConfirmGrande({ visible: false, archivo: null });
                  if (a) void ejecutarImporte(a);
                }}
                style={styles.modalBtn}
              >
                <Text style={styles.modalBtnText}>Continuar</Text>
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
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Importar suscriptores desde CSV</Text>
        <Text style={styles.cardBody}>
          Cargá un archivo .csv con tus suscriptores y medidores. El sistema
          valida cada fila y reporta duplicados y errores sin abortar el lote.
        </Text>
        <View style={styles.cardHint}>
          <MaterialIcons name="info" size={16} color={COLORS.secondary} />
          <Text style={styles.cardHintTexto}>9 columnas separadas por coma · UTF-8</Text>
        </View>
        <Pressable
          onPress={onSeleccionar}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedDark]}
        >
          <MaterialIcons name="upload-file" size={20} color={COLORS.onPrimary} />
          <Text style={styles.btnPrimaryText}>Seleccionar archivo CSV</Text>
        </Pressable>
        <Pressable
          onPress={onVerFormato}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressedLight]}
        >
          <Text style={styles.btnSecondaryText}>Ver formato esperado</Text>
        </Pressable>
      </View>
      {/* Status placeholder */}
      <View style={styles.statusPlaceholder}>
        <MaterialIcons name="cloud-upload" size={40} color={COLORS.primary} />
        <Text style={styles.statusPlaceholderTexto}>Esperando carga de datos...</Text>
      </View>
    </>
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
      <Text style={styles.cardTitulo}>Vista previa</Text>
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
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
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
          <Text style={styles.btnPrimaryText}>Importar suscriptores</Text>
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
      <Text style={styles.cardTitulo}>Resultado de la importación</Text>
      <Text style={styles.cardHint}>{archivoNombre}</Text>
      <View style={styles.separador} />

      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Suscriptores creados</Text>
        <Text style={styles.metricValorOk}>{reporte.suscriptoresCreados}</Text>
      </View>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Medidores creados</Text>
        <Text style={styles.metricValorOk}>{reporte.medidoresCreados}</Text>
      </View>

      {dupSus.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Suscriptores duplicados</Text>
          <Text style={styles.metricValorWarn}>{dupSus.length}</Text>
        </View>
      )}
      {dupMed.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Medidores duplicados</Text>
          <Text style={styles.metricValorWarn}>{dupMed.length}</Text>
        </View>
      )}
      {reporte.errores.length > 0 && (
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Errores</Text>
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
          <Text style={styles.btnSecondaryText}>Importar otro</Text>
        </Pressable>
        <Pressable
          onPress={onVolverInicio}
          style={({ pressed }) => [styles.btnPrimary, styles.flex1, pressed && styles.pressedDark]}
        >
          <MaterialIcons name="home" size={18} color={COLORS.onPrimary} />
          <Text style={styles.btnPrimaryText}>Ir al inicio</Text>
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
      <Text style={styles.errorTitulo}>No se pudo procesar el archivo</Text>
      <Text style={styles.errorBody}>{mensaje}</Text>
      <Pressable
        onPress={onReintentar}
        style={({ pressed }) => [styles.btnPrimary, { marginTop: SPACING.md }, pressed && styles.pressedDark]}
      >
        <MaterialIcons name="refresh" size={18} color={COLORS.onPrimary} />
        <Text style={styles.btnPrimaryText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  headerIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
  },

  // Scroll
  scroll: { padding: SPACING.margin, paddingBottom: SPACING.xl },

  // Card
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  cardBody: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, marginBottom: SPACING.sm },
  cardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  cardHintTexto: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  bold: { fontWeight: '700' },
  bigCount: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },

  // Separador
  separador: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: SPACING.md },

  // Botones
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    minHeight: 52,
    marginTop: SPACING.sm,
  },
  btnPrimaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onPrimary,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    minHeight: 48,
  },
  btnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  btnDisabled: { backgroundColor: COLORS.onSurfaceVariant, opacity: 0.4 },
  botonesRow: { flexDirection: 'row', gap: SPACING.sm },
  flex1: { flex: 1 },

  // Status placeholder
  statusPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    opacity: 0.4,
    gap: SPACING.sm,
  },
  statusPlaceholderTexto: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
  },

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
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  // Warning box
  warningBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginVertical: SPACING.sm,
  },
  warningText: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },

  // Métricas
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  metricValorOk: { ...TYPOGRAPHY.headlineSm, color: COLORS.primary },
  metricValorWarn: { ...TYPOGRAPHY.headlineSm, color: COLORS.warning },
  metricValorErr: { ...TYPOGRAPHY.headlineSm, color: COLORS.error },

  // Error card
  errorCard: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    backgroundColor: COLORS.errorContainer,
    marginBottom: SPACING.md,
  },
  errorTitulo: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorBody: { ...TYPOGRAPHY.bodyMd, color: COLORS.error },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.margin,
  },
  modalCard: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl * 2,
    width: '100%',
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  modalTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
  },
  modalScroll: {
    padding: SPACING.lg,
    maxHeight: 320,
  },
  modalCode: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.primary,
    backgroundColor: COLORS.surfaceContainerLow,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    fontFamily: 'monospace',
    marginVertical: SPACING.md,
  },
  modalBody: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, lineHeight: 20 },
  modalFooter: {
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  modalBtn: {
    backgroundColor: COLORS.primaryContainer,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    flex: 1,
  },
  modalBtnText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary },
  modalBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  modalBtnSecondaryText: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  modalBtnsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },

  // Press states
  pressedLight: { opacity: 0.7 },
  pressedDark: { opacity: 0.85 },
});
