import { StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'ListaSuscriptores'>;

/** Esqueleto: la lógica de listado llega en sub-agente posterior. */
export default function ListaSuscriptores({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Suscriptores" />
      </Appbar.Header>

      <View style={styles.body}>
        <Text variant="bodyLarge">Lista de suscriptores (próximamente)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});
