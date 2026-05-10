import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = LecturasStackScreenProps<'ListaSuscriptores'>;

/**
 * Lista de suscriptores con buscador in-memory.
 *
 * - Carga `suscriptorRepo.listar()` al montar.
 * - Filtra por `codigo` o `nombre_apellidos` (case-insensitive).
 * - Tap en item -> navega a DetalleSuscriptor con `id_suscriptor`.
 * - Empty state y error state con retry.
 */
export default function ListaSuscriptores({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return suscriptores;
    return suscriptores.filter(
      (s) =>
        s.codigo.toLowerCase().includes(q) ||
        s.nombre_apellidos.toLowerCase().includes(q),
    );
  }, [suscriptores, query]);

  const renderItem = useCallback(
    ({ item, index }: { item: Suscriptor; index: number }) => (
      <>
        {index > 0 && <View style={styles.separador} />}
        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() =>
            navigation.navigate('DetalleSuscriptor', {
              id_suscriptor: item.id_suscriptor,
            })
          }
        >
          <View style={styles.itemInfo}>
            <Text style={[TYPOGRAPHY.labelSm, styles.itemCodigo]}>
              {item.codigo.toUpperCase()}
            </Text>
            <Text style={[TYPOGRAPHY.bodyMd, styles.itemNombre]}>
              {item.nombre_apellidos}
            </Text>
            {item.direccion !== '' && (
              <Text style={[TYPOGRAPHY.bodySm, styles.itemDireccion]}>
                {item.direccion}
              </Text>
            )}
          </View>
          <View style={styles.itemDerecha}>
            <View style={styles.estratoChip}>
              <Text style={[TYPOGRAPHY.labelSm, styles.estratoText]}>
                E{item.estrato}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </>
    ),
    [navigation],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTexts}>
            <Text style={[TYPOGRAPHY.headlineMd, styles.titulo]}>SUSCRIPTORES</Text>
            <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>
              {suscriptores.length} registros
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.btnAgregar, pressed && styles.btnPressed]}
            onPress={() => navigation.navigate('Config', { screen: 'AltaSuscriptor' })}
          >
            <MaterialIcons name="add" size={24} color={COLORS.onPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.buscadorContainer}>
        <MaterialIcons name="search" size={20} color={COLORS.textSecondary} style={styles.buscadorIcono} />
        <TextInput
          style={[TYPOGRAPHY.bodyMd, styles.buscador]}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por código o nombre..."
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Acción rápida */}
      <View style={styles.accionesRow}>
        <Pressable
          style={({ pressed }) => [styles.btnSecundario, pressed && styles.btnPressed]}
          onPress={() => navigation.navigate('Config', { screen: 'ImportarCsv' })}
        >
          <MaterialIcons name="upload-file" size={16} color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.labelLg, styles.btnSecundarioText]}>IMPORTAR CSV</Text>
        </Pressable>
      </View>

      {/* Contenido principal */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error !== null ? (
        <View style={styles.center}>
          <Text style={[TYPOGRAPHY.bodyMd, styles.errorText]}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, pressed && styles.btnPressed]}
            onPress={() => void cargar()}
          >
            <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>REINTENTAR</Text>
          </Pressable>
        </View>
      ) : suscriptores.length === 0 ? (
        <View style={styles.center}>
          <Text style={[TYPOGRAPHY.bodyMd, styles.muted]}>
            No hay suscriptores. Agregá uno.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, pressed && styles.btnPressed]}
            onPress={() => navigation.navigate('Config', { screen: 'AltaSuscriptor' })}
          >
            <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>AGREGAR SUSCRIPTOR</Text>
          </Pressable>
        </View>
      ) : filtrados.length === 0 ? (
        <View style={styles.center}>
          <Text style={[TYPOGRAPHY.bodyMd, styles.muted]}>Sin resultados</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(item) => String(item.id_suscriptor)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.lista}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.margin,
    gap: SPACING.md,
  },
  header: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  titulo: {
    color: COLORS.primary,
  },
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },
  btnAgregar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buscadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  buscadorIcono: {
    marginRight: SPACING.sm,
  },
  buscador: {
    flex: 1,
    color: COLORS.primary,
    paddingVertical: 0,
  },
  accionesRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.margin,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  btnSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
    backgroundColor: COLORS.background,
  },
  btnSecundarioText: {
    color: COLORS.primary,
  },
  btnPrimario: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.default,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimarioText: {
    color: COLORS.onPrimary,
  },
  btnPressed: {
    opacity: 0.7,
  },
  lista: {
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.xl,
  },
  separador: {
    height: 1,
    backgroundColor: COLORS.primary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  itemCodigo: {
    color: COLORS.textSecondary,
  },
  itemNombre: {
    color: COLORS.primary,
  },
  itemDireccion: {
    color: COLORS.textSecondary,
  },
  itemDerecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  estratoChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.sm,
  },
  estratoText: {
    color: COLORS.primary,
  },
  chevron: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
});
