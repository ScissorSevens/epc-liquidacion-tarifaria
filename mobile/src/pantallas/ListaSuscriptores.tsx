import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  List,
  Searchbar,
  Snackbar,
  Text,
} from 'react-native-paper';

import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import type { LecturasStackScreenProps } from '../navegacion/types';

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
      // Mensaje generico — el detalle tecnico se loguea en consola para debug.
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
    ({ item }: { item: Suscriptor }) => (
      <List.Item
        title={item.nombre_apellidos}
        description={`${item.codigo} · estrato ${item.estrato} · ${item.estado}`}
        left={(props) => <List.Icon {...props} icon="account" />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        onPress={() =>
          navigation.navigate('DetalleSuscriptor', {
            id_suscriptor: item.id_suscriptor,
          })
        }
      />
    ),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Suscriptores" />
      </Appbar.Header>

      <Searchbar
        placeholder="Buscar por código o nombre"
        value={query}
        onChangeText={setQuery}
        style={styles.searchbar}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : suscriptores.length === 0 ? (
        // Empty state real (sin datos en DB).
        <View style={styles.center}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No hay suscriptores. Agregá uno desde Home.
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Config', { screen: 'AltaSuscriptor' })}
            style={styles.emptyButton}
          >
            Agregar suscriptor
          </Button>
        </View>
      ) : filtrados.length === 0 ? (
        // Empty state filtrado (hay datos pero el query no matchea).
        <View style={styles.center}>
          <Text variant="bodyLarge">Sin resultados</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(item) => String(item.id_suscriptor)}
          renderItem={renderItem}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Snackbar
        visible={error !== null}
        onDismiss={() => setError(null)}
        action={{ label: 'Reintentar', onPress: () => void cargar() }}
        duration={Number.POSITIVE_INFINITY}
      >
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyText: { textAlign: 'center', marginBottom: 16 },
  emptyButton: { marginTop: 8 },
});
