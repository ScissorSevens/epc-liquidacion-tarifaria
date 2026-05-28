import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { BootstrapApp, ResultadoSync } from '../composition/bootstrap';
import { getBootstrap } from '../composition/get-bootstrap';
import { FooterApp } from '../componentes/FooterApp';
import { TopBar } from '../componentes/TopBar';
import type { SyncStackScreenProps } from '../navegacion/types';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../theme/skeletal-tokens';

type Props = SyncStackScreenProps<'Sincronizacion'>;

interface EventoLog {
  readonly id: string;
  readonly timestamp: string;
  readonly tipo: 'health' | 'sync' | 'cola' | 'error';
  readonly mensaje: string;
  readonly status?: string;
  readonly detalles?: Record<string, string | number>;
}

interface ContadoresSync {
  exitosos: number;
  fallidos: number;
  pendientes: number;
}

const formatHora = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

/**
 * Pantalla de sincronizacion manual con el backend AquaRuta.
 *
 * Permite al operario:
 *  - Probar la conectividad contra `${baseUrl}/health`.
 *  - Disparar `procesadorCola()` (invoca `procesarCola()` del dominio).
 *  - Ver el conteo de items pendientes en la cola SQLite local.
 *  - Revisar el log de los ultimos eventos en la sesion actual (no
 *    persiste cross-launch — es solo feedback inmediato).
 */
export default function Sincronizacion(_props: Props) {
  const [bootstrap, setBootstrap] = useState<BootstrapApp | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<null | 'health' | 'sync' | 'cola'>(
    null,
  );
  const [eventos, setEventos] = useState<EventoLog[]>([]);
  const [contadores, setContadores] = useState<ContadoresSync>({
    exitosos: 0,
    fallidos: 0,
    pendientes: 0,
  });
  const [estadoConexion, setEstadoConexion] = useState<'stable' | 'offline' | 'unknown'>('unknown');

  useEffect(() => {
    let activo = true;
    getBootstrap()
      .then((b) => {
        if (activo) setBootstrap(b);
      })
      .catch((e: unknown) => {
        if (activo) {
          setBootError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      activo = false;
    };
  }, []);

  const agregarEvento = useCallback(
    (
      tipo: EventoLog['tipo'],
      mensaje: string,
      status?: string,
      detalles?: Record<string, string | number>,
    ) => {
      const evento: EventoLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: formatHora(new Date()),
        tipo,
        mensaje,
        ...(status !== undefined && { status }),
        ...(detalles !== undefined && { detalles }),
      };
      setEventos((prev) => [evento, ...prev].slice(0, 50));
    },
    [],
  );

  const probarConexion = useCallback(async () => {
    if (!bootstrap) return;
    setCargando('health');
    const url = `${bootstrap.apiBaseUrl}/health`;
    try {
      const resp = await fetch(url);
      const txt = await resp.text();
      const ok = resp.ok && txt.toLowerCase().includes('healthy');
      setEstadoConexion(ok ? 'stable' : 'offline');
      agregarEvento(
        'health',
        ok ? 'Backend Healthy' : `Backend respondio: ${txt.slice(0, 80)}`,
        String(resp.status),
      );
    } catch (e) {
      setEstadoConexion('offline');
      agregarEvento(
        'error',
        `No se pudo conectar a ${url}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setCargando(null);
    }
  }, [bootstrap, agregarEvento]);

  const sincronizar = useCallback(async () => {
    if (!bootstrap) return;
    setCargando('sync');
    try {
      const r: ResultadoSync = await bootstrap.procesadorCola();
      setContadores({
        exitosos: r.enviados,
        fallidos: r.fallidos,
        pendientes: r.pendientes,
      });
      agregarEvento(
        'sync',
        `Sync OK — exitosos:${r.enviados} conflictos:${r.conflictos} fallidos:${r.fallidos} pendientes:${r.pendientes}`,
      );
    } catch (e) {
      agregarEvento(
        'error',
        `Error al sincronizar: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setCargando(null);
    }
  }, [bootstrap, agregarEvento]);

  const verCola = useCallback(async () => {
    if (!bootstrap) return;
    setCargando('cola');
    try {
      const items = await bootstrap.colaRepo.listar();
      if (items.length === 0) {
        agregarEvento('cola', 'Cola vacia');
        return;
      }

      const porEstado = items.reduce<Record<string, number>>((acc, it) => {
        acc[it.estado] = (acc[it.estado] ?? 0) + 1;
        return acc;
      }, {});
      const detalle = Object.entries(porEstado)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      agregarEvento('cola', `Total ${items.length} — ${detalle}`);

      const pendientesCount = porEstado['PENDIENTE'] ?? 0;
      const exitososCount = porEstado['EXITOSO'] ?? 0;
      const fallidosCount = porEstado['FALLIDO'] ?? 0;
      setContadores({
        exitosos: exitososCount,
        fallidos: fallidosCount,
        pendientes: pendientesCount,
      });
    } catch (e) {
      agregarEvento(
        'error',
        `Error al leer cola: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setCargando(null);
    }
  }, [bootstrap, agregarEvento]);

  if (bootError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error al inicializar: {bootError}</Text>
      </View>
    );
  }

  if (!bootstrap) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[TYPOGRAPHY.bodyMd, styles.muted]}>Inicializando…</Text>
      </View>
    );
  }

  const sincronizando = cargando === 'sync';

  const estadoTitulo = sincronizando
    ? 'Sincronizando datos...'
    : eventos.some((e) => e.tipo === 'sync')
    ? 'Sync completado'
    : 'Listo para sincronizar';

  const estadoConexionTexto =
    estadoConexion === 'stable'
      ? 'Conexión Estable'
      : estadoConexion === 'offline'
      ? 'Sin Conexión'
      : 'Estado Desconocido';

  // Progreso aproximado basado en exitosos vs total conocido
  const totalConocido = contadores.exitosos + contadores.fallidos + contadores.pendientes;
  const porcentajeProgreso =
    totalConocido > 0
      ? Math.round((contadores.exitosos / totalConocido) * 100)
      : sincronizando ? 0 : 0;

  return (
    <View style={styles.container}>
      {/* TopAppBar */}
      <TopBar titulo="AquaRuta" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ícono central animado */}
        <View style={styles.iconoWrapper}>
          <View style={styles.iconoCirculo}>
            <MaterialIcons name="cloud-upload" size={56} color={COLORS.onPrimary} />
          </View>
          {/* Badge sync */}
          <View style={styles.iconoBadge}>
            {sincronizando ? (
              <ActivityIndicator size="small" color={COLORS.onSecondaryContainer} />
            ) : (
              <MaterialIcons name="sync" size={20} color={COLORS.onSecondaryContainer} />
            )}
          </View>
        </View>

        {/* Estado textual */}
        <View style={styles.estadoTextos}>
          <Text style={[TYPOGRAPHY.headlineMd, styles.estadoTitulo]}>
            {estadoTitulo}
          </Text>
          <View style={styles.estadoPill}>
            <Text style={[TYPOGRAPHY.labelLg, styles.estadoPillText]}>
              OPERACIÓN {sincronizando ? 'EN CURSO' : 'EN ESPERA'}
            </Text>
          </View>
        </View>

        {/* Sección de progreso */}
        <View style={styles.progresoCard}>
          <View style={styles.progresoRow}>
            <Text style={[TYPOGRAPHY.labelLg, styles.progresoLabel]}>Progreso total</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.progresoNum]}>{porcentajeProgreso}%</Text>
          </View>
          <View style={styles.barraContainer}>
            <View style={[styles.barraFill, { width: `${porcentajeProgreso}%` as `${number}%` }]} />
          </View>
        </View>

        {/* Stats grid 3-col */}
        <View style={styles.statsGrid}>
          {/* Exitosos */}
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={22} color={COLORS.secondary} />
            <Text style={[TYPOGRAPHY.labelLg, styles.statLabel]}>EXITOSOS</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.statValor]}>{contadores.exitosos}</Text>
          </View>
          {/* Fallidos */}
          <View style={styles.statCard}>
            <MaterialIcons name="error" size={22} color={COLORS.error} />
            <Text style={[TYPOGRAPHY.labelLg, styles.statLabelError]}>FALLIDOS</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.statValorError]}>{contadores.fallidos}</Text>
          </View>
          {/* Pendientes */}
          <View style={styles.statCard}>
            <MaterialIcons name="pending" size={22} color={COLORS.onSurfaceVariant} />
            <Text style={[TYPOGRAPHY.labelLg, styles.statLabel]}>PENDIENTE</Text>
            <Text style={[TYPOGRAPHY.headlineSm, styles.statValor]}>{contadores.pendientes}</Text>
          </View>
        </View>

        {/* Tarjeta estado conexión */}
        <View style={styles.conexionCard}>
          <View style={styles.conexionIconBox}>
            <MaterialIcons name="wifi" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.conexionTexts}>
            <Text style={[TYPOGRAPHY.labelLg, styles.conexionLabel]}>Estado del Proceso</Text>
            <Text style={[TYPOGRAPHY.bodyMd, styles.conexionValor]}>{estadoConexionTexto}</Text>
          </View>
        </View>

        {/* Tarjeta archivos fallidos */}
        <View style={[styles.fallidosCard, contadores.fallidos > 0 && styles.fallidosCardActiva]}>
          <View style={styles.fallidosLeft}>
            <View style={styles.fallidosIconBox}>
              <MaterialIcons name="warning" size={20} color={COLORS.error} />
            </View>
            <Text style={[TYPOGRAPHY.labelLg, styles.fallidosLabel]}>Archivos Fallidos</Text>
          </View>
          <Text style={[TYPOGRAPHY.headlineSm, styles.fallidosNum]}>{contadores.fallidos}</Text>
        </View>

        {/* Botones */}
        <View style={styles.botones}>
          {/* Sincronizar ahora — full width */}
          <Pressable
            onPress={sincronizar}
            disabled={cargando !== null}
            style={({ pressed }) => [
              styles.btnPrimario,
              pressed && styles.btnPressed,
              cargando !== null && styles.btnDisabled,
            ]}
          >
            <MaterialIcons name="sync" size={22} color={COLORS.onPrimary} />
            <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>
              {sincronizando ? 'SINCRONIZANDO…' : 'SINCRONIZAR AHORA'}
            </Text>
          </Pressable>

          {/* Grid 2-col */}
          <View style={styles.btnGrid}>
            <Pressable
              onPress={probarConexion}
              disabled={cargando !== null}
              style={({ pressed }) => [
                styles.btnSecundario,
                pressed && styles.btnPressed,
                cargando !== null && styles.btnDisabled,
              ]}
            >
              <MaterialIcons name="signal-cellular-alt" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.labelLg, styles.btnSecundarioText]}>
                {cargando === 'health' ? 'PROBANDO…' : 'PROBAR CONEXIÓN'}
              </Text>
            </Pressable>

            <Pressable
              onPress={verCola}
              disabled={cargando !== null}
              style={({ pressed }) => [
                styles.btnSecundario,
                pressed && styles.btnPressed,
                cargando !== null && styles.btnDisabled,
              ]}
            >
              <MaterialIcons name="list-alt" size={20} color={COLORS.primary} />
              <Text style={[TYPOGRAPHY.labelLg, styles.btnSecundarioText]}>
                {cargando === 'cola' ? 'LEYENDO…' : 'VER COLA'}
              </Text>
            </Pressable>
          </View>
        </View>

        <FooterApp />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.margin,
  },
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.error,
    textAlign: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: SPACING.margin,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.md,
    alignItems: 'center',
  },

  // ── Ícono central ─────────────────────────────────────────────────────────
  iconoWrapper: {
    position: 'relative',
    width: 128,
    height: 128,
    marginBottom: SPACING.sm,
  },
  iconoCirculo: {
    width: 128,
    height: 128,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.background,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  // ── Estado textual ────────────────────────────────────────────────────────
  estadoTextos: {
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  estadoTitulo: {
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 32,
  },
  estadoPill: {
    backgroundColor: 'rgba(0,204,249,0.15)', // secondaryContainer/20
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  estadoPillText: {
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // ── Progreso ──────────────────────────────────────────────────────────────
  progresoCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  progresoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  progresoLabel: {
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  progresoNum: {
    color: COLORS.primary,
  },
  barraContainer: {
    height: 12,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barraFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
  },

  // ── Stats 3-col ───────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  statLabel: {
    color: COLORS.onSurfaceVariant,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statLabelError: {
    color: COLORS.error,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statValor: {
    color: COLORS.primary,
    textAlign: 'center',
  },
  statValorError: {
    color: COLORS.error,
    textAlign: 'center',
  },

  // ── Conexión ──────────────────────────────────────────────────────────────
  conexionCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceLight, // surface-container-low
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
  },
  conexionIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceVariant,
  },
  conexionTexts: {
    flex: 1,
  },
  conexionLabel: {
    color: COLORS.onSurfaceVariant,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  conexionValor: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── Fallidos ──────────────────────────────────────────────────────────────
  fallidosCard: {
    width: '100%',
    backgroundColor: 'rgba(255,218,214,0.1)', // error-container/10
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(186,26,26,0.3)', // error/30
  },
  fallidosCardActiva: {
    backgroundColor: 'rgba(255,218,214,0.3)',
  },
  fallidosLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fallidosIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallidosLabel: {
    color: COLORS.error,
    textTransform: 'uppercase',
  },
  fallidosNum: {
    color: COLORS.error,
  },

  // ── Botones ───────────────────────────────────────────────────────────────
  botones: {
    width: '100%',
    gap: SPACING.sm,
  },
  btnPrimario: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  btnPrimarioText: {
    color: COLORS.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btnGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btnSecundario: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  btnSecundarioText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

// Helper de color por tipo de evento — se mantiene por si se reactiva el log.
function colorPorTipo(tipo: EventoLog['tipo']): { color: string } {
  return {
    color:
      tipo === 'error'
        ? COLORS.error
        : tipo === 'sync'
        ? COLORS.secondary
        : tipo === 'health'
        ? COLORS.primary
        : COLORS.textSecondary,
  };
}
// Suprimir warnings de variables no usadas (lógica preservada para futura reactivación)
void colorPorTipo;
