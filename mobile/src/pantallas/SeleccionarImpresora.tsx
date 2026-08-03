import { useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { BotonPrimario } from '../componentes/BotonPrimario';
import { TopBar } from '../componentes/TopBar';
import type { LecturasStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';
import type { Impresora } from '@dominio/impresion';
import { ExcepcionImpresora } from '@dominio/impresion';
import { obtenerAdaptadores } from '../adapters/impresion/factory';
import {
  guardarUltimaImpresora,
  obtenerUltimaImpresora,
} from '../persistencia/impresoras-preferencias';

type Props = LecturasStackScreenProps<'SeleccionarImpresora'>;

type EstadoScan = 'inactivo' | 'escaneando' | 'error';

interface AdaptadorConId {
  readonly id: string;
  readonly adapter: {
    readonly id: string;
    readonly transporte: 'BLE' | 'SPP';
    escanear(timeoutMs: number): Promise<readonly Impresora[]>;
    emparejar(impresora: Impresora): Promise<void>;
    conectar(direccion: string): Promise<void>;
  };
}

const TIMEOUT_SCAN_MS = 10_000;

/**
 * Pantalla de seleccion/cambio de impresora Bluetooth (BLE + SPP).
 *
 * Flujo:
 *  1. Lee `obtenerUltimaImpresora()` (preferida persistida).
 *  2. Lanza `obtenerAdaptadores()` para conseguir adapters BLE/SPP.
 *  3. Por cada adapter, llama `escanear(10000)` y mergea resultados.
 *  4. Renderiza FlatList de dispositivos con badge de transporte.
 *  5. Tap en dispositivo: emparejar + conectar + guardarUltimaImpresora
 *     + goBack. Fallo: mensaje accionable, sin navegar.
 *  6. PERMISO_DENEGADO: CTA Configurar permisos (Linking.openSettings).
 *
 * Spec: `factura-impresion-termica` REQ 1 + `factura-preview-ticket` REQ 5.
 */
export default function SeleccionarImpresora({ navigation, route }: Props) {
  const { id_factura, modo } = route.params;
  const [estado, setEstado] = useState<EstadoScan>('escaneando');
  const [dispositivos, setDispositivos] = useState<readonly Impresora[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [preferida, setPreferida] = useState<Impresora | null>(null);
  const [adapters, setAdapters] = useState<readonly AdaptadorConId[]>([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [pref, adaptersDisponibles] = await Promise.all([
          obtenerUltimaImpresora(),
          obtenerAdaptadores(),
        ]);
        if (cancelado) return;
        setPreferida(pref);
        setAdapters(
          adaptersDisponibles.map((a) => ({
            id: a.adapter.id,
            adapter: a.adapter as AdaptadorConId['adapter'],
          })),
        );
        await lanzarScan(adaptersDisponibles.map((a) => a.adapter as AdaptadorConId['adapter']));
      } catch (err) {
        if (cancelado) return;
        setEstado('error');
        setErrorMsg((err as Error).message ?? 'Error desconocido');
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lanzarScan = async (lista: readonly AdaptadorConId['adapter'][]) => {
    setEstado('escaneando');
    setErrorMsg(null);
    setPermisoDenegado(false);
    try {
      const resultados = await Promise.all(
        lista.map((a) => a.escanear(TIMEOUT_SCAN_MS)),
      );
      const merge: Impresora[] = [];
      const vistos = new Set<string>();
      for (const arr of resultados) {
        for (const d of arr) {
          if (!vistos.has(d.direccion)) {
            vistos.add(d.direccion);
            merge.push(d);
          }
        }
      }
      setDispositivos(merge);
      setEstado('inactivo');
    } catch (err) {
      if (err instanceof ExcepcionImpresora && err.codigo === 'PERMISO_DENEGADO') {
        setPermisoDenegado(true);
        setErrorMsg(err.message);
      } else {
        setErrorMsg((err as Error).message ?? 'Error escaneando');
      }
      setEstado('error');
    }
  };

  const handleTapDispositivo = async (disp: Impresora) => {
    setErrorMsg(null);
    const adapter = adapters.find((a) => a.adapter.transporte === disp.transporte);
    if (!adapter) {
      setErrorMsg('No hay adapter disponible para este transporte');
      return;
    }
    try {
      await adapter.adapter.emparejar(disp);
      await adapter.adapter.conectar(disp.direccion);
      await guardarUltimaImpresora(disp);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof ExcepcionImpresora
        ? err.message
        : (err as Error).message;
      setErrorMsg(msg ?? 'Error al emparejar');
    }
  };

  const titulo = modo === 'cambio' ? 'Cambiar impresora' : 'Selecciona impresora';

  return (
    <View style={styles.root}>
      <TopBar titulo={titulo} onBack={() => navigation.goBack()} />
      {preferida && modo === 'cambio' && (
        <View style={styles.preferidaBanner}>
          <Text style={styles.preferidaLabel}>Preferida actual:</Text>
          <Text style={styles.preferidaNombre}>{preferida.nombre}</Text>
          <Text style={styles.preferidaDireccion}>{preferida.direccion}</Text>
        </View>
      )}
      {estado === 'escaneando' && (
        <View style={styles.center}>
          <Text>Escaneando dispositivos…</Text>
        </View>
      )}
      {estado === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorMsg}>{errorMsg ?? 'Error desconocido'}</Text>
          <BotonPrimario
            texto="Reintentar"
            testID="btn-reintentar"
            onPress={() => lanzarScan(adapters.map((a) => a.adapter))}
          />
          {permisoDenegado && (
            <BotonPrimario
              texto="Configurar permisos"
              testID="btn-configurar-permisos"
              tono="amarillo"
              onPress={() => {
                void Linking.openSettings();
              }}
            />
          )}
        </View>
      )}
      {estado === 'inactivo' && (
        <>
          {errorMsg && (
            <View style={styles.inlineErrorBox}>
              <Text style={styles.errorMsg}>{errorMsg}</Text>
            </View>
          )}
          <FlatList
            data={dispositivos}
            keyExtractor={(item) => item.direccion}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text testID="lista-dispositivos-vacia">
                  No se encontraron dispositivos
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                testID={`dispositivo-${item.direccion}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.nombre}, ${item.transporte}, ${item.direccion}`}
                onPress={() => {
                  void handleTapDispositivo(item);
                }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemNombre}>{item.nombre}</Text>
                  <Text style={styles.itemDireccion}>{item.direccion}</Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    item.transporte === 'BLE'
                      ? styles.badgeBle
                      : styles.badgeSpp,
                  ]}
                >
                  <Text style={styles.badgeTexto}>{item.transporte}</Text>
                </View>
              </Pressable>
            )}
          />
        </>
      )}
      <View style={styles.footer}>
        <BotonPrimario
          texto="Detener scan"
          testID="btn-detener-scan"
          tono="amarillo"
          onPress={() => {
            setEstado('inactivo');
          }}
          disabled={estado !== 'escaneando'}
        />
      </View>
      <Text style={styles.idHint} testID="id-factura-hint">
        Factura: {id_factura}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  preferidaBanner: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    gap: SPACING.xs,
  },
  preferidaLabel: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
  },
  preferidaNombre: {
    ...TYPOGRAPHY.bodyMd,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  preferidaDireccion: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  list: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: 56,
    backgroundColor: COLORS.surfaceContainerLowest,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
  },
  pressed: {
    opacity: 0.85,
  },
  itemLeft: {
    flex: 1,
    gap: 2,
  },
  itemNombre: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  itemDireccion: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeBle: { backgroundColor: COLORS.brandAzulDigital },
  badgeSpp: { backgroundColor: COLORS.brandAmarillo },
  badgeTexto: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  errorBox: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
  },
  inlineErrorBox: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.errorContainer,
    ...BORDERS.thin,
    borderColor: COLORS.error,
    borderRadius: RADIUS.default,
    marginHorizontal: SPACING.margin,
    marginTop: SPACING.sm,
  },
  errorMsg: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.error,
  },
  footer: {
    paddingHorizontal: SPACING.margin,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  idHint: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingBottom: SPACING.md,
  },
});
