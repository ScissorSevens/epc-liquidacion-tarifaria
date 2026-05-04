import { StatusBar } from 'expo-status-bar';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { bootstrapApp } from '../composition/bootstrap';

export default function HolaMediApp() {
  const probarBootstrap = () => {
    const resultado = bootstrapApp();
    Alert.alert('Bootstrap', JSON.stringify(resultado, null, 2));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>MediApp</Text>
      <Text style={styles.subtitulo}>EPC Lecturas Rurales</Text>
      <Text style={styles.version}>v0.1.0 - Domingo 4 mayo 2026</Text>
      <Button title="Probar Bootstrap del Dominio" onPress={probarBootstrap} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#0066cc' },
  subtitulo: { fontSize: 18, marginTop: 8, color: '#444' },
  version: { fontSize: 12, marginTop: 4, marginBottom: 30, color: '#888' },
});
