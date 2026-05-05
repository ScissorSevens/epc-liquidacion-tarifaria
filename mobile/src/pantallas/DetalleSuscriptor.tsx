import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Divider,
  FAB,
  Snackbar,
  Text,
} from 'react-native-paper';

import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { getBootstrap } from '../composition/get-bootstrap';
import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'DetalleSuscriptor'>;

/** Fila label/valor reutilizable dentro de la card de datos. */
function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <View style={styles.campo}>
      <Text variant="labelSmall" style={styles.campoLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.campoValor}>
        {valor}
      </Text>
    </View>
  );
}

/**
 * Detalle read-only de un suscriptor + sus medidores asociados.
 *
 * - Carga `suscriptor` y `medidores` en paralelo via Promise.all.
 * - Muestra dos Cards: datos del suscriptor + lista de medidores.
 * - FAB "Volver" siempre visible.
 */
export default function DetalleSuscriptor({ navigation, route }: Props) {
  const { id_suscriptor } = route.params;

  const [loading, setLoading] = useState(true);
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);
  const [medidores, setMedidores] = useState<Medidor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { suscriptorRepo, medidorRepo } = await getBootstrap();
      const [s, m] = await Promise.all([
        suscriptorRepo.buscarPorId(id_suscriptor),
        medidorRepo.listarPorSuscriptor(id_suscriptor),
      ]);
      setSuscriptor(s);
      setMedidores(m);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DetalleSuscriptor] error al cargar:', e);
      setError('Error al cargar el detalle. Reintentar.');
    } finally {
      setLoading(false);
    }
  }, [id_suscriptor]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Detalle" />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : suscriptor === null ? (
        <View style={styles.center}>
          <Text variant="bodyLarge" style={styles.notFoundText}>
            Suscriptor no encontrado
          </Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Volver
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Card 1 — Datos del suscriptor */}
          <Card style={styles.card}>
            <Card.Title title="Datos del suscriptor" />
            <Card.Content>
              <Campo label="Código" valor={suscriptor.codigo} />
              <Campo label="Nombre y apellidos" valor={suscriptor.nombre_apellidos} />
              <Campo label="Dirección" valor={suscriptor.direccion} />
              <Campo label="Estrato" valor={String(suscriptor.estrato)} />
              <Campo
                label="Matrícula inmobiliaria"
                valor={suscriptor.matricula_inmobiliaria ?? '—'}
              />
              <Campo
                label="Número catastral"
                valor={suscriptor.numero_catastral ?? '—'}
              />
              <Campo label="Estado" valor={suscriptor.estado} />
              <Campo label="Fecha de alta" valor={suscriptor.created_at} />
            </Card.Content>
          </Card>

          {/* Card 2 — Medidores asociados */}
          <Card style={styles.card}>
            <Card.Title title={`Medidores asociados (${medidores.length})`} />
            <Card.Content>
              {medidores.length === 0 ? (
                <Text variant="bodyMedium">Sin medidores asociados</Text>
              ) : (
                medidores.map((m, idx) => (
                  <View key={m.id_medidor}>
                    {idx > 0 && <Divider style={styles.medidorDivider} />}
                    <View style={styles.medidor}>
                      <Campo label="Número" valor={m.numero_medidor} />
                      <Campo
                        label="Fecha instalación"
                        valor={m.fecha_instalacion}
                      />
                      <Campo label="Estado" valor={m.estado} />
                      {m.observaciones !== undefined &&
                        m.observaciones !== '' && (
                          <Campo label="Observaciones" valor={m.observaciones} />
                        )}
                      <Button
                        mode="contained-tonal"
                        icon="gauge"
                        onPress={() =>
                          navigation.navigate('CapturarLectura', {
                            id_medidor: m.id_medidor,
                            id_suscriptor,
                          })
                        }
                        style={styles.medidorAccion}
                      >
                        Capturar lectura
                      </Button>
                    </View>
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {!loading && (
        <FAB
          icon="arrow-left"
          label="Volver"
          onPress={() => navigation.goBack()}
          style={styles.fab}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  notFoundText: { marginBottom: 16 },
  scroll: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 12 },
  campo: { marginBottom: 10 },
  campoLabel: { color: '#666', marginBottom: 2 },
  campoValor: {},
  medidor: { paddingVertical: 4 },
  medidorDivider: { marginVertical: 8 },
  medidorAccion: { marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
