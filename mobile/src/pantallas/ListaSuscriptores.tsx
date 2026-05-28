import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';

import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = LecturasStackScreenProps<'ListaSuscriptores'>;

type Filtro = 'todas' | 'pendientes' | 'capturadas';

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
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [fabAbierto, setFabAbierto] = useState(false);

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
    let lista = suscriptores;

    if (q !== '') {
      lista = lista.filter(
        (s) =>
          s.codigo.toLowerCase().includes(q) ||
          s.nombre_apellidos.toLowerCase().includes(q),
      );
    }

    // Por ahora todos los suscriptores se consideran "pendientes" si no tienen
    // lectura registrada — la lógica real de estado viene del dominio.
    // El filtro visual se aplica pero no filtra datos hasta que haya campo estado.
    return lista;
  }, [suscriptores, query]);

  const navegarACapturar = useCallback(
    async (item: Suscriptor) => {
      try {
        const { medidorRepo } = await getBootstrap();
        const medidores = await medidorRepo.listarPorSuscriptor(item.id_suscriptor);
        const medidor = medidores[0];
        if (medidor) {
          navigation.navigate('CapturarLectura', {
            id_medidor: medidor.id_medidor,
            id_suscriptor: item.id_suscriptor,
          });
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
        {/* Fila superior: ID + badge estado */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderTextos}>
            <Text style={styles.cardCodigo}>SUSCRIPTOR #{item.codigo.toUpperCase()}</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]}>
              {item.nombre_apellidos}
            </Text>
          </View>
          <View style={styles.badgePendiente}>
            <Text style={styles.badgePendienteTexto}>PENDIENTE</Text>
          </View>
        </View>

        {/* Dirección */}
        {item.direccion !== '' && (
          <View style={styles.cardDireccionRow}>
            <MaterialIcons name="location-on" size={16} color={COLORS.onSurfaceVariant} />
            <Text style={[TYPOGRAPHY.bodySm, styles.cardDireccion]}>
              {item.direccion}
            </Text>
          </View>
        )}

        {/* Botón ficha suscriptor */}
        <Pressable
          style={({ pressed }) => [styles.btnFicha, pressed && styles.pressed]}
          onPress={() =>
            navigation.navigate('DetalleSuscriptor', {
              id_suscriptor: item.id_suscriptor,
            })
          }
        >
          <MaterialIcons name="info-outline" size={16} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.labelLg, styles.btnFichaTexto]}>FICHA SUSCRIPTOR</Text>
        </Pressable>

        {/* Fila inferior: cámara + botón tomar lectura */}
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterIzq}>
            <MaterialIcons name="photo-camera" size={20} color={COLORS.onSurfaceVariant} />
            <Text style={[TYPOGRAPHY.labelMd, styles.cardFooterLabel]}>Requiere foto</Text>
          </View>
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
      <View style={styles.topBar}>
        <View style={styles.topBarIzq}>
          <Text style={styles.topBarTitulo}>Lecturas</Text>
        </View>
        <View style={styles.topBarDer}>
          <Pressable
            style={({ pressed }) => [styles.topBarIconBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Config', { screen: 'MiPerfil' })}
          >
            <MaterialIcons name="account-circle" size={24} color={COLORS.primary} />
          </Pressable>
        </View>
      </View>

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

        {/* Chips de filtro */}
        <View style={styles.filtrosRow}>
          {(['todas', 'pendientes', 'capturadas'] as Filtro[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, filtro === f && styles.chipActivo]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.chipTexto, filtro === f && styles.chipTextoActivo]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── TopAppBar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: SPACING.margin,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  topBarIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  topBarDer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  topBarTitulo: {
    fontFamily: undefined,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: COLORS.primary,
  },
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
    height: 56,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  buscadorIcono: {
    marginRight: SPACING.sm,
  },
  buscador: {
    flex: 1,
    color: COLORS.primary,
    paddingVertical: 0,
  },

  // ── Chips filtro ───────────────────────────────────────────────────────────
  filtrosRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  chip: {
    paddingHorizontal: SPACING.md + SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipTexto: {
    fontFamily: undefined,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.onSurface,
  },
  chipTextoActivo: {
    color: COLORS.onPrimary,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  lista: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    padding: SPACING.margin,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderTextos: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardCodigo: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardNombre: {
    color: COLORS.primary,
  },
  badgePendiente: {
    paddingHorizontal: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.errorContainer,
    borderRadius: RADIUS.full,
  },
  badgePendienteTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onErrorContainer,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardDireccionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardDireccion: {
    color: COLORS.onSurfaceVariant,
    flex: 1,
  },

  // ── Botón Ficha Suscriptor ─────────────────────────────────────────────────
  btnFicha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
  },
  btnFichaTexto: {
    color: COLORS.primary,
  },

  // ── Card Footer ────────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceContainer,
    marginTop: SPACING.xs,
  },
  cardFooterIzq: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    opacity: 0.7,
  },
  cardFooterLabel: {
    color: COLORS.onSurfaceVariant,
  },
  btnTomarLectura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
  },
  btnTomarLecturaTexto: {
    color: COLORS.onPrimary,
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
    backgroundColor: COLORS.primaryContainer,
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
});
