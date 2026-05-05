import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Divider,
  List,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';

import type { RootStackScreenProps } from '../navegacion/RootStack';

type Props = RootStackScreenProps<'ResultadoCalculo'>;

/**
 * Formatea pesos colombianos sin decimales con `Intl.NumberFormat`.
 *
 * Hermes (engine de RN) soporta `Intl.NumberFormat` desde RN 0.70 con
 * `jsEngine: hermes` y la opcion `intl` habilitada en el build (Expo SDK
 * 50+ trae intl-locale-data ya cableado). Si en algun celu cae al string
 * crudo, la app no rompe — pero el numero se muestra sin formato.
 */
function formatearCOP(monto: number): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(monto);
  } catch {
    // Fallback defensivo si Intl no esta disponible.
    return `$ ${Math.round(monto).toLocaleString('es-CO')}`;
  }
}

/** Fila label/valor reutilizable en cards (alinea derecha el valor). */
function Fila({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <View style={styles.fila}>
      <Text variant={destacado ? 'titleMedium' : 'bodyMedium'} style={styles.filaLabel}>
        {label}
      </Text>
      <Text
        variant={destacado ? 'titleMedium' : 'bodyMedium'}
        style={styles.filaValor}
      >
        {valor}
      </Text>
    </View>
  );
}

/**
 * Muestra el desglose del calculo tarifario producido por el motor CRA.
 *
 * Recibe TODO por params (no consulta repos): `lectura`, `resultado`,
 * `parametros` aplicados y `estrato` elegido. Tambien `id_suscriptor`
 * para el header y `id_medidor` (sacado de `lectura.id_medidor`) para
 * permitir "Capturar otra".
 *
 * Pantalla es pura presentacion: no escribe en DB. La persistencia de
 * la lectura/calculo se hara en una tarea futura cuando exista el flujo
 * "Confirmar y guardar".
 */
export default function ResultadoCalculo({ navigation, route }: Props) {
  const { lectura, resultado, parametros, estrato, id_suscriptor } = route.params;
  const theme = useTheme();

  const subsidioMostrar = resultado.subsidio > 0;
  const contribMostrar = resultado.contribucion > 0;

  const subtitulo = useMemo(
    () => `Suscriptor #${id_suscriptor} — Medidor #${lectura.id_medidor} — Periodo ${lectura.id_periodo}`,
    [id_suscriptor, lectura.id_medidor, lectura.id_periodo],
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Resultado de liquidación" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="bodySmall" style={styles.subtitulo}>
          {subtitulo}
        </Text>

        {/* Card 1 - Consumo */}
        <Card style={styles.card}>
          <Card.Title title="Consumo" left={(p) => <List.Icon {...p} icon="water" />} />
          <Card.Content>
            <Fila label="Total del periodo" valor={`${resultado.consumo} m³`} />
            <Fila label="Dentro del básico" valor={`${resultado.consumoBasico} m³`} />
            <Fila label="Excedente" valor={`${resultado.consumoExcedente} m³`} />
            <Divider style={styles.divider} />
            <Text variant="bodySmall" style={styles.muted}>
              Lectura anterior: {lectura.lectura_anterior} m³ — actual: {lectura.lectura_actual} m³
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              Umbral básico aplicado: {parametros.consumoBasico} m³
            </Text>
          </Card.Content>
        </Card>

        {/* Card 2 - Cargos */}
        <Card style={styles.card}>
          <Card.Title
            title="Cargos"
            left={(p) => <List.Icon {...p} icon="cash-multiple" />}
          />
          <Card.Content>
            <Fila label="Cargo fijo" valor={formatearCOP(resultado.cargoFijo)} />
            <Fila
              label="Cargo consumo básico"
              valor={formatearCOP(resultado.cargoConsumo)}
            />
            <Fila
              label="Cargo excedente"
              valor={formatearCOP(resultado.cargoExcedente)}
            />
          </Card.Content>
        </Card>

        {/* Card 3 - Subsidio / Contribucion */}
        <Card style={styles.card}>
          <Card.Title
            title="Subsidio / Contribución"
            left={(p) => <List.Icon {...p} icon="scale-balance" />}
          />
          <Card.Content>
            <Fila label="Estrato aplicado" valor={String(estrato)} />
            {subsidioMostrar && (
              <Fila label="Subsidio" valor={`- ${formatearCOP(resultado.subsidio)}`} />
            )}
            {contribMostrar && (
              <Fila
                label="Contribución"
                valor={`+ ${formatearCOP(resultado.contribucion)}`}
              />
            )}
            {!subsidioMostrar && !contribMostrar && (
              <Text variant="bodySmall" style={styles.muted}>
                Estrato neutro: sin subsidio ni contribución.
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Total destacado */}
        <Surface
          style={[styles.totalSurface, { backgroundColor: theme.colors.primaryContainer }]}
          elevation={2}
        >
          <Text variant="labelLarge" style={styles.totalLabel}>
            Total a facturar
          </Text>
          <Text
            variant="headlineMedium"
            style={[styles.totalValor, { color: theme.colors.primary }]}
          >
            {formatearCOP(resultado.total)}
          </Text>
        </Surface>

        <View style={styles.botones}>
          <Button
            mode="contained-tonal"
            icon="home"
            onPress={() => navigation.popToTop()}
            style={styles.boton}
          >
            Volver al inicio
          </Button>
          <Button
            mode="contained"
            icon="plus"
            onPress={() =>
              navigation.replace('CapturarLectura', {
                id_medidor: lectura.id_medidor,
                id_suscriptor,
              })
            }
            style={styles.boton}
          >
            Capturar otra
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  subtitulo: { marginBottom: 12, color: '#666' },
  card: { marginBottom: 12 },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  filaLabel: { flex: 1 },
  filaValor: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  divider: { marginVertical: 8 },
  muted: { color: '#666', marginTop: 4 },
  totalSurface: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },
  totalLabel: { marginBottom: 4 },
  totalValor: { fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  botones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  boton: { flex: 1 },
});
