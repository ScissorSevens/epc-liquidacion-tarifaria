import { StyleSheet, View } from 'react-native';
import { Appbar, Text } from 'react-native-paper';

import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'ImportarCsv'>;

/** Esqueleto: el importador llega en sub-agente posterior. */
export default function ImportarCsv({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Importar CSV" />
      </Appbar.Header>

      <View style={styles.body}>
        <Text variant="bodyLarge">Importador (próximamente)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});
