import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '../componentes/TopBar';
import type { InicioStackScreenProps } from '../navegacion/types';

type Props = InicioStackScreenProps<'SeleccionarImpresora'>;

/**
 * Placeholder de la pantalla SeleccionarImpresora. La implementacion
 * real (scan/pair/connect/persist) llega en el commit 12. Este
 * placeholder existe para que la pantalla sea navegable y el deep-link
 * desde FacturaPreview no falle durante el ciclo de commits.
 */
export default function SeleccionarImpresoraPlaceholder({
  navigation,
  route,
}: Props): ReactElement {
  const titulo = route.params?.modo === 'cambio'
    ? 'Cambiar impresora'
    : 'Selecciona impresora';
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <TopBar titulo={titulo} onBack={() => navigation.goBack()} />
      <View style={styles.body} testID="placeholder-seleccionar-impresora">
        <Text style={styles.texto}>{titulo} (placeholder)</Text>
        <Text style={styles.detalle}>
          Scan BLE/SPP llega en commit 12 de factura-preview-print-bluetooth.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FF' },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  texto: { fontSize: 18, fontWeight: '600', color: '#0B1C30' },
  detalle: { fontSize: 14, color: '#44474D', textAlign: 'center' },
});
