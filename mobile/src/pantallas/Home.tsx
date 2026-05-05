import { StyleSheet, View } from 'react-native';
import { Appbar, Button } from 'react-native-paper';

import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'Home'>;

/**
 * Pantalla raíz: enruta a las funcionalidades principales.
 * Por ahora es solo navegación; la lógica vive dentro de cada pantalla destino.
 */
export default function Home({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="MediApp" />
      </Appbar.Header>

      <View style={styles.botones}>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate('ListaSuscriptores')}
        >
          Lista de Suscriptores
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate('AltaSuscriptor')}
        >
          Agregar Suscriptor
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate('ImportarCsv')}
        >
          Importar CSV
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate('HolaMediApp')}
        >
          Demo Persistencia
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  botones: { padding: 16, gap: 12 },
});
