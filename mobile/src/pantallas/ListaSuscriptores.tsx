import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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

  const renderItem = useCallback(
    ({ item }: { item: Suscriptor }) => (
      <View style={styles.card}>
        {/* Código + Nombre */}
        <Text style={styles.cardCodigo}>#{item.codigo}</Text>
        <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]} numberOfLines={1}>
          {item.nombre_apellidos}
        </Text>

        {/* Dirección */}
        {item.direccion !== '' && (
          <View style={styles.cardDireccionRow}>
            <MaterialIcons name="location-on" size={14} color={COLORS.onSurfaceVariant} />
            <Text style={[TYPOGRAPHY.labelMd, styles.cardDireccion]} numberOfLines={1}>
              {item.direccion}
            </Text>
          </View>
        )}

        {/* Acciones: Ficha (ghost) + Tomar lectura (pill) */}
        <View style={styles.cardAcciones}>
          <Pressable
            style={({ pressed }) => [styles.btnFicha, pressed && styles.pressed]}
            onPress={() =>
              navigation.navigate('DetalleSuscriptor', {
                id_suscriptor: item.id_suscriptor,
              })
            }
          >
            <MaterialIcons name="info-outline" size={14} color={COLORS.secondary} />
            <Text style={[TYPOGRAPHY.labelMd, styles.btnFichaTexto]}>Ver ficha</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnTomarLectura, pressed && styles.pressed]}
            onPress={() => { void navegarACapturar(item); }}
          >
            <MaterialIcons name="add-a-photo" size={14} color={COLORS.onPrimary} />
            <Text style={[TYPOGRAPHY.labelLg, styles.btnTomarLecturaTexto]}>TOMAR LECTURA</Text>
          </Pressable>
        </View>
      </View>
    ),
    [navigation, navegarACapturar],
  );

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <TopBar
        titulo="Lecturas"
        accionDerecha={
          <Pressable
            style={({ pressed }) => [styles.topBarIconBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Config', { screen: 'MiPerfil' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.primary} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Buscador (siempre visible) */}
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

        {/* Contenido */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error !== null ? (
          <View style={styles.center}>
            <Text style={[TYPOGRAPHY.bodyMd, styles.errorText]}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.btnTomarLectura, pressed && styles.pressed]}
              onPress={() => void cargar()}
            >
              <Text style={[TYPOGRAPHY.labelLg, styles.btnTomarLecturaTexto]}>REINTENTAR</Text>
            </Pressable>
          </View>
        ) : suscriptores.length === 0 ? (
          <View style={styles.center}>
            <Text style={[TYPOGRAPHY.bodyMd, { color: COLORS.textSecondary }]}>
              No hay suscriptores. Usá el botón + para agregar uno.
            </Text>
          </View>
        ) : filtrados.length === 0 ? (
          <View style={styles.center}>
            <Text style={[TYPOGRAPHY.bodyMd, { color: COLORS.textSecondary }]}>Sin resultados</Text>
          </View>
        ) : (
          <FlatList
            data={filtrados}
            keyExtractor={(item) => String(item.id_suscriptor)}
            renderItem={renderItem}
            scrollEnabled={false}
            contentContainerStyle={styles.lista}
          />
        )}

        <FooterApp />
      </ScrollView>

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
                navigation.navigate('Config', { screen: 'AltaSuscriptor' });
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
                navigation.navigate('Config', { screen: 'ImportarCsv' });
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

  // ── Cards ─────────────────────────────────────────────────────────────────
  lista: {
    gap: SPACING.sm + 4,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm + 4,
    gap: SPACING.xs,
    ...SHADOWS.card,
  },
  cardCodigo: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  cardNombre: {
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  cardDireccionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  cardDireccion: {
    color: COLORS.onSurfaceVariant,
    flex: 1,
  },

  // ── Acciones en una sola fila ──────────────────────────────────────────────
  cardAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs + 2,
  },
  btnFicha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  btnFichaTexto: {
    color: COLORS.secondary,
  },
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
