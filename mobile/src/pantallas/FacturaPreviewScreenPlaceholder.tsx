import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '../componentes/TopBar';
import type { InicioStackScreenProps } from '../navegacion/types';

type Props = InicioStackScreenProps<'FacturaPreview'>;

/**
 * Placeholder de la pantalla FacturaPreview. La implementacion real
 * llega en el commit 8. Este placeholder existe para que la pantalla
 * sea navegable y la `navigation.navigate('FacturaPreview', ...)` del
 * CTA de ResultadoCalculo no falle durante el ciclo de commits.
 */
export default function FacturaPreviewScreenPlaceholder({
  navigation,
}: Props): ReactElement {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <TopBar titulo="Factura" onBack={() => navigation.goBack()} />
      <View style={styles.body} testID="placeholder-factura-preview">
        <Text style={styles.texto}>Preview de factura (placeholder)</Text>
        <Text style={styles.detalle}>
          Implementacion completa en commit 8 de factura-preview-print-bluetooth.
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
