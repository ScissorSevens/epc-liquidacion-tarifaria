import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
import { ANCHO_POR_PAPEL, type AnchoPapel } from '@dominio/impresion';
import { armarTicketEscPos } from '@dominio/impresion';
import { getBootstrap } from '../composition/get-bootstrap';
import { obtenerPapelDefault, invalidarPreferencias, obtenerUltimaImpresora } from '../persistencia/impresoras-preferencias';
import { obtenerAdaptadores } from '../adapters/impresion/factory';
import { compartirFactura } from '../hooks/compartir-factura';
import type { Factura } from '@dominio/factura/types';
import * as Haptics from 'expo-haptics';

type Props = LecturasStackScreenProps<'FacturaPreview'>;

type EstadoPreview = 'cargando' | 'listo' | 'error';

/**
 * Pantalla de preview de tiquete de factura (post-emision).
 *
 * Estados: cargando (skeleton) / listo (tiquete + CTAs) / error
 * (CTA Reintentar). CTAs: Imprimir (delega al adapter Bluetooth si
 * hay preferida, si no navega a SeleccionarImpresora) y Compartir
 * (invoca `compartirFactura` -> expo-sharing + expo-file-system).
 *
 * PaperWidth viene de la preferencia persistida (`obtenerPapelDefault`)
 * — NO de `useWindowDimensions`. Esto garantiza que el wrap del
 * tiquete sea determinista (32 cols en 58mm, 42 en 80mm).
 *
 * Spec: `factura-preview-ticket` REQ 1-6.
 */
export default function FacturaPreviewScreen({ navigation, route }: Props) {
  const { id_factura } = route.params;
  const [estado, setEstado] = useState<EstadoPreview>('cargando');
  const [factura, setFactura] = useState<Factura | null>(null);
  const [anchoPapel, setAnchoPapel] = useState<AnchoPapel>('58mm');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const bootstrap = await getBootstrap();
        const papel = await obtenerPapelDefault();
        const f = await bootstrap.repos.facturaRepo.buscarPorId(id_factura);
        if (cancelado) return;
        if (!f) {
          setEstado('error');
          setErrorMsg('Esta factura ya no esta disponible');
        } else {
          setFactura(f);
          setAnchoPapel(papel);
          setEstado('listo');
        }
      } catch (err) {
        if (cancelado) return;
        setEstado('error');
        setErrorMsg((err as Error).message ?? 'Error desconocido');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id_factura]);

  const handleImprimir = async () => {
    if (!factura) return;
    setCargandoAccion(true);
    try {
      const preferida = await obtenerUltimaImpresora();
      if (preferida) {
        const adapters = await obtenerAdaptadores();
        const adapter = adapters.find(
          (a) =>
            a.adapter.transporte === preferida.transporte &&
            a.adapter.id === preferida.id,
        );
        if (adapter) {
          try {
            await adapter.adapter.conectar(preferida.direccion);
            const ticket = armarTicketEscPos(factura, anchoPapel);
            await adapter.adapter.imprimir(ticket);
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
            return;
          } catch {
            // Conexion fallida: invalidar preferencias y dejar que el
            // caller navegue al selector.
            await invalidarPreferencias();
          }
        } else {
          await invalidarPreferencias();
        }
      }
      // Sin preferida (o conexion fallida) → selector.
      navigation.navigate('SeleccionarImpresora', {
        id_factura,
        modo: 'inicial',
      });
    } finally {
      setCargandoAccion(false);
    }
  };

  const handleCompartir = async () => {
    if (!factura) return;
    setCargandoAccion(true);
    try {
      const ticket = armarTicketEscPos(factura, anchoPapel);
      await compartirFactura(ticket, factura);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Error ya se propaga; UI feedback minimo via haptics warning.
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
    } finally {
      setCargandoAccion(false);
    }
  };

  if (estado === 'cargando') {
    return (
      <View style={styles.root}>
        <TopBar titulo="Factura" onBack={() => navigation.goBack()} />
        <View
          testID="skeleton-preview"
          accessibilityLabel="Cargando factura"
          style={styles.skeleton}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (estado === 'error') {
    return (
      <View style={styles.root}>
        <TopBar titulo="Factura" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {errorMsg ?? 'No se pudo cargar la factura'}
          </Text>
          <BotonPrimario
            texto="Reintentar"
            testID="btn-reintentar"
            onPress={() => {
              setEstado('cargando');
              setErrorMsg(null);
            }}
          />
        </View>
      </View>
    );
  }

  const cols = ANCHO_POR_PAPEL[anchoPapel];
  return (
    <View style={styles.root}>
      <TopBar titulo="Factura" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TicketFactura factura={factura!} anchoPapel={anchoPapel} />
        <View style={styles.actions}>
          <BotonPrimario
            texto="Imprimir en termica"
            testID="btn-imprimir"
            icono="print"
            tono="azul"
            cargando={cargandoAccion}
            onPress={handleImprimir}
          />
          <BotonPrimario
            texto="Compartir"
            testID="btn-compartir"
            icono="share"
            tono="amarillo"
            onPress={handleCompartir}
            disabled={cargandoAccion}
          />
        </View>
        <Text style={styles.colsHint}>
          Ancho: {anchoPapel} ({cols} cols)
        </Text>
      </ScrollView>
    </View>
  );
}

// ── TicketFactura ───────────────────────────────────────────────────────────

interface TicketFacturaProps {
  readonly factura: Factura;
  readonly anchoPapel: AnchoPapel;
}

function TicketFactura({ factura, anchoPapel }: TicketFacturaProps) {
  const lineas = armarTicketEscPos(factura, anchoPapel);
  return (
    <View style={styles.ticket} testID="ticket-factura">
      {lineas.map((linea, i) => (
        <Text key={i} style={styles.ticketLinea}>
          {linea || ' '}
        </Text>
      ))}
      <View style={styles.divisor} />
      <Text style={styles.ticketLinea}>Cod. Verificacion:</Text>
      <Text
        testID="codigo-verificacion"
        selectable
        style={[styles.ticketLinea, styles.ticketLineaMono]}
      >
        {factura.codigo_verificacion}
      </Text>
      <Text style={styles.ticketLinea}>Ref. pago:</Text>
      <Text
        testID="referencia-pago"
        selectable
        style={[styles.ticketLinea, styles.ticketLineaMono]}
      >
        {factura.referencia_pago ?? '—'}
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  skeleton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
    alignItems: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.error,
    textAlign: 'center',
  },
  ticket: {
    backgroundColor: COLORS.surfaceContainerLowest,
    ...BORDERS.thin,
    borderRadius: RADIUS.default,
    padding: SPACING.md,
  },
  ticketLinea: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.onSurface,
  },
  ticketLineaMono: {
    fontWeight: '700',
  },
  divisor: {
    height: 1,
    backgroundColor: COLORS.outlineVariant,
    marginVertical: SPACING.sm,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  colsHint: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
