import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { FilaSuscriptor } from '../componentes/FilaSuscriptor';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

// PER-02 — virtualización óptima para 300+ prestadores × N suscriptores.
// Sin ScrollView padre que fuerce eager mount, FlatList perezosa es la que
// controla qué filas se montan.
const FLATLIST_INITIAL_NUM_TO_RENDER = 10;
const FLATLIST_MAX_TO_RENDER_PER_BATCH = 10;
const FLATLIST_WINDOW_SIZE = 10;

type Props = LecturasStackScreenProps<'ListaSuscriptores'>;

/**
 * Listado de suscriptores con cards verticales enriquecidas (wireframe v3.0).
 *
 * - Card con estado Pendiente / Capturada.
 * - Chips de filtro: Todas / Pendientes / Capturadas.
 * - FAB speed dial: Nuevo Suscriptor / Importar CSV.
 * - Buscador por código o nombre.
 */
export default function ListaSuscriptores({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fabAbierto, setFabAbierto] = useState(false);

  // ── Selector de medidor ───────────────────────────────────────────────────
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [medidoresSelector, setMedidoresSelector] = useState<Medidor[]>([]);
  const [suscriptorSelector, setSuscriptorSelector] = useState<{ id: number; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { suscriptorRepo } = await getBootstrap();
      const lista = await suscriptorRepo.listar();
      setSuscriptores(lista);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ListaSuscriptores] error al listar:', e);
      setError('Error al cargar suscriptores. Reintentar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return suscriptores;
    return suscriptores.filter(
      (s) =>
        s.codigo.toLowerCase().includes(q) ||
        s.nombre_apellidos.toLowerCase().includes(q),
    );
  }, [suscriptores, query]);

  const navegarACapturar = useCallback(
    async (item: Suscriptor) => {
      try {
        const { medidorRepo } = await getBootstrap();
        const medidores = await medidorRepo.listarPorSuscriptor(item.id_suscriptor);
        if (medidores.length === 0) return;
        if (medidores.length === 1 && medidores[0]) {
          navigation.navigate('CapturarLectura', {
            id_medidor: medidores[0].id_medidor,
            id_suscriptor: item.id_suscriptor,
          });
        } else {
          setMedidoresSelector(medidores);
          setSuscriptorSelector({ id: item.id_suscriptor, nombre: item.nombre_apellidos });
          setSelectorVisible(true);
        }
      } catch (e) {
        console.warn('[ListaSuscriptores] error navegando a CapturarLectura:', e);
      }
    },
    [navigation],
  );

  const keyExtractor = useCallback(
    (item: Suscriptor) => String(item.id_suscriptor),
    [],
  );

  const handleVerFicha = useCallback(
    (id: number) => navigation.navigate('DetalleSuscriptor', { id_suscriptor: id }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Suscriptor }) => (
      <FilaSuscriptor
        item={item}
        onVerFicha={handleVerFicha}
        onCapturarLectura={navegarACapturar}
      />
    ),
    [handleVerFicha, navegarACapturar],
  );

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <TopBar
        titulo="Lecturas"
        accionDerecha={
          <Pressable
            style={({ pressed }) => [styles.topBarIconBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Config', { screen: 'Configuracion' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.onPrimary} />
          </Pressable>
        }
      />

      {/*
       * PER-02: FlatList como contenedor raíz del scroll.
       * Sin ScrollView padre, la virtualización de RN funciona: solo se montan
       * las filas visibles (initialNumToRender + windowSize).
       * ListHeaderComponent → buscador (siempre arriba).
       * ListFooterComponent → FooterApp (slot reservado).
       * ListEmptyComponent → estados loading / error / vacío / sin resultados.
       */}
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        data={filtrados}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.buscadorContainer}>
            <MaterialIcons name="search" size={20} color={COLORS.outline} style={styles.buscadorIcono} />
            <TextInput
              style={[TYPOGRAPHY.bodyMd, styles.buscador]}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre o ID de suscriptor..."
              placeholderTextColor={COLORS.outline}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        ListFooterComponent={<FooterApp />}
        ListEmptyComponent={
          <View style={styles.center}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : error !== null ? (
              <>
                <Text style={[TYPOGRAPHY.bodyMd, styles.errorText]}>{error}</Text>
                <Pressable
                  style={({ pressed }) => [styles.btnTomarLectura, pressed && styles.pressed]}
                  onPress={() => void cargar()}
                >
                  <Text style={[TYPOGRAPHY.labelLg, styles.btnTomarLecturaTexto]}>REINTENTAR</Text>
                </Pressable>
              </>
            ) : suscriptores.length === 0 ? (
              <Text style={[TYPOGRAPHY.bodyMd, { color: COLORS.textSecondary }]}>
                No hay suscriptores. Usá el botón + para agregar uno.
              </Text>
            ) : (
              <Text style={[TYPOGRAPHY.bodyMd, { color: COLORS.textSecondary }]}>Sin resultados</Text>
            )}
          </View>
        }
        keyboardShouldPersistTaps="handled"
        initialNumToRender={FLATLIST_INITIAL_NUM_TO_RENDER}
        maxToRenderPerBatch={FLATLIST_MAX_TO_RENDER_PER_BATCH}
        windowSize={FLATLIST_WINDOW_SIZE}
        removeClippedSubviews
      />

      {/* FAB Speed Dial */}
      {fabAbierto && (
        <View style={styles.fabMenu}>
          {/* Opción: Nuevo Suscriptor */}
          <View style={styles.fabOpcion}>
            <View style={styles.fabEtiqueta}>
              <Text style={[TYPOGRAPHY.labelLg, styles.fabEtiquetaTexto]}>Nuevo Suscriptor</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.fabOpcionBtn, pressed && styles.pressed]}
              onPress={() => {
                setFabAbierto(false);
                navigation.navigate('AltaSuscriptor');
              }}
            >
              <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
            </Pressable>
          </View>
          {/* Opción: Importar CSV */}
          <View style={styles.fabOpcion}>
            <View style={styles.fabEtiqueta}>
              <Text style={[TYPOGRAPHY.labelLg, styles.fabEtiquetaTexto]}>Importar CSV</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.fabOpcionBtn, pressed && styles.pressed]}
              onPress={() => {
                setFabAbierto(false);
                navigation.navigate('ImportarCsv');
              }}
            >
              <MaterialIcons name="file-upload" size={24} color={COLORS.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* FAB principal */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={() => setFabAbierto((v) => !v)}
      >
        <MaterialIcons
          name={fabAbierto ? 'close' : 'add'}
          size={28}
          color={COLORS.onPrimary}
        />
      </Pressable>

      {/* ── Modal selector de medidor ───────────────────────────────────────── */}
      <Modal
        visible={selectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectorVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.handleBar} />
            <Text style={styles.sheetTitulo}>Seleccionar medidor</Text>
            {suscriptorSelector && (
              <Text style={styles.sheetSubtitulo}>{suscriptorSelector.nombre}</Text>
            )}
            {medidoresSelector.map((med) => (
              <Pressable
                key={med.id_medidor}
                style={({ pressed }) => [styles.medidorItem, pressed && styles.medidorItemPressed]}
                onPress={() => {
                  setSelectorVisible(false);
                  if (suscriptorSelector) {
                    navigation.navigate('CapturarLectura', {
                      id_medidor: med.id_medidor,
                      id_suscriptor: suscriptorSelector.id,
                    });
                  }
                }}
              >
                <MaterialIcons name="speed" size={20} color={COLORS.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medidorNro}>Medidor #{med.id_medidor}</Text>
                  <Text style={styles.medidorSerie}>{med.numero_medidor}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.onSurfaceVariant} />
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.btnCancelar, pressed && { opacity: 0.6 }]}
              onPress={() => setSelectorVisible(false)}
            >
              <Text style={styles.btnCancelarTexto}>CANCELAR</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── TopAppBar (accionDerecha) ──────────────────────────────────────────────
  topBarIconBtn: {
    padding: SPACING.xs,
  },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.margin,
    paddingBottom: 120, // espacio para FAB
    rowGap: SPACING.sm + 4, // gap entre filas (PER-02)
  },

  // ── Buscador ───────────────────────────────────────────────────────────────
  buscadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  buscadorIcono: {
    marginRight: SPACING.sm,
  },
  buscador: {
    flex: 1,
    color: COLORS.primary,
    paddingVertical: 0,
  },

  // ── Botones compartidos (usados también en el estado de error/retry) ────────
  btnTomarLectura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  btnTomarLecturaTexto: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Estados centro ─────────────────────────────────────────────────────────
  center: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 88,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.float,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 88 + 56 + SPACING.md,
    right: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'flex-end',
  },
  fabOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fabEtiqueta: {
    paddingHorizontal: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
  },
  fabEtiquetaTexto: {
    color: COLORS.primary,
  },
  fabOpcionBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },

  // ── Util ───────────────────────────────────────────────────────────────────
  pressed: {
    opacity: 0.7,
  },

  // ── Modal selector de medidor ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.outlineVariant,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetTitulo: {
    ...TYPOGRAPHY.headlineSm,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  sheetSubtitulo: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    marginBottom: SPACING.lg,
  },
  medidorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: SPACING.sm,
  },
  medidorItemPressed: {
    backgroundColor: COLORS.surfaceContainer,
  },
  medidorNro: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.primary,
  },
  medidorSerie: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
  btnCancelar: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  btnCancelarTexto: {
    ...TYPOGRAPHY.labelLg,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 0.5,
  },
});
