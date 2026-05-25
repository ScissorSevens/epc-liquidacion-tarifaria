import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { BootstrapApp, ResultadoSync } from '../composition/bootstrap';
import { getBootstrap } from '../composition/get-bootstrap';
import type { SyncStackScreenProps } from '../navegacion/types';
import {
  BORDERS,
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
 * Pantalla de sincronizacion manual con el backend MediApp.
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

      // Resumen agregado por estado.
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

      const itemsActivos = items.filter((i) => i.estado !== 'EXITOSO');
      if (itemsActivos.length === 0) {
        agregarEvento('cola', 'Todos los items sincronizados ✓');
        return;
      }
      for (const it of itemsActivos) {
        const detalles: Record<string, string | number> = {
          tipo_item: it.tipo,
          estado: it.estado,
          intentos: it.intentos,
        };
        if (it.ultimoError) {
          detalles.error = it.ultimoError.slice(0, 40);
        }
        agregarEvento('cola', it.tipo, undefined, detalles);
      }
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
    ? 'Sincronizando...'
    : eventos.some((e) => e.tipo === 'sync')
    ? 'Sync completado'
    : 'Listo para sincronizar';

  const estadoConexionTexto =
    estadoConexion === 'stable'
      ? 'Conexión estable'
      : estadoConexion === 'offline'
      ? 'Sin conexión'
      : 'Estado desconocido';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[TYPOGRAPHY.headlineMd, styles.title]}>SINCRONIZACIÓN</Text>
          <MaterialIcons name="account-circle" size={28} color={COLORS.primary} />
        </View>
      </View>

      <FlatList
        data={eventos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Ícono central */}
            <View style={styles.iconoCirculo}>
              <MaterialIcons name="cloud-upload" size={48} color={COLORS.primary} />
            </View>

            {/* Estado textual */}
            <View style={styles.estadoTextos}>
              <Text style={[TYPOGRAPHY.headlineSm, styles.estadoTitulo]}>
                {estadoTitulo}
              </Text>
              <Text style={[TYPOGRAPHY.labelMd, styles.estadoSubtitulo]}>
                OPERACIÓN {sincronizando ? 'EN CURSO' : 'EN ESPERA'}
              </Text>
            </View>

            {/* Indicador de progreso — solo visible mientras sincroniza */}
            {sincronizando && (
              <View style={styles.progresoSection}>
                <View style={styles.progresoRow}>
                  <Text style={[TYPOGRAPHY.labelLg]}>Progreso total</Text>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              </View>
            )}

            {/* Grid bento 2x2 */}
            <View style={styles.bentoGrid}>
              {/* ESTADO — col-span-2 */}
              <View style={[styles.bentoCard, styles.bentoCardFullWidth]}>
                <Text style={[TYPOGRAPHY.labelSm, styles.bentoLabel]}>ESTADO</Text>
                <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]}>
                  {estadoConexionTexto}
                </Text>
              </View>

              {/* EXITOSOS */}
              <View style={styles.bentoCard}>
                <MaterialIcons name="description" size={24} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.labelSm, styles.bentoLabel]}>EXITOSOS</Text>
                <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]}>
                  {contadores.exitosos}
                </Text>
              </View>

              {/* FALLIDOS */}
              <View style={[
                styles.bentoCard,
                contadores.fallidos > 0 && styles.bentoDashed,
              ]}>
                <MaterialIcons name="error" size={24} color={COLORS.error} />
                <Text style={[TYPOGRAPHY.labelSm, styles.bentoLabelError]}>FALLIDOS</Text>
                <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombreError]}>
                  {contadores.fallidos}
                </Text>
              </View>

              {/* PENDIENTES — col-span-2 */}
              <View style={[styles.bentoCard, styles.bentoCardFullWidth]}>
                <MaterialIcons name="hourglass-empty" size={24} color={COLORS.primary} />
                <Text style={[TYPOGRAPHY.labelSm, styles.bentoLabel]}>PENDIENTES</Text>
                <Text style={[TYPOGRAPHY.headlineSm, styles.cardNombre]}>
                  {contadores.pendientes}
                </Text>
              </View>
            </View>

            {/* Botones */}
            <View style={styles.botones}>
              <Pressable
                onPress={sincronizar}
                disabled={cargando !== null}
                style={({ pressed }) => [
                  styles.btnPrimario,
                  pressed && styles.btnPressed,
                  cargando !== null && styles.btnDisabled,
                ]}
              >
                <MaterialIcons name="sync" size={20} color={COLORS.onPrimary} />
                <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>
                  {cargando === 'sync' ? 'SINCRONIZANDO…' : 'SINCRONIZAR AHORA'}
                </Text>
              </Pressable>

              <Pressable
                onPress={probarConexion}
                disabled={cargando !== null}
                style={({ pressed }) => [
                  styles.btnSecundario,
                  pressed && styles.btnPressed,
                  cargando !== null && styles.btnDisabled,
                ]}
              >
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
                <Text style={[TYPOGRAPHY.labelLg, styles.btnSecundarioText]}>
                  {cargando === 'cola' ? 'LEYENDO…' : 'VER COLA'}
                </Text>
              </Pressable>
            </View>

            {/* Log header */}
            <View style={styles.logHeader}>
              <Text style={TYPOGRAPHY.labelLg}>EVENTOS</Text>
              <Text style={[TYPOGRAPHY.labelMd, styles.muted]}>
                {eventos.length === 0 ? 'sin eventos' : `${eventos.length} eventos`}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.logEmpty}>
            <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>
              Tocá un botón para empezar.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <View style={styles.logItemHeader}>
              <Text style={[TYPOGRAPHY.labelMd, colorPorTipo(item.tipo)]}>
                {item.tipo.toUpperCase()}
              </Text>
              <Text style={[TYPOGRAPHY.labelMd, styles.muted]}>
                {item.timestamp}
                {item.status ? ` · ${item.status}` : ''}
              </Text>
            </View>
            <Text style={TYPOGRAPHY.bodySm}>{item.mensaje}</Text>
            {item.detalles && (
              <View style={styles.chipsRow}>
                {Object.entries(item.detalles).map(([k, v]) => (
                  <View key={k} style={styles.chip}>
                    <Text style={[TYPOGRAPHY.labelSm, styles.chipText]}>{k}: {v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />
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
  header: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COLORS.primary,
  },
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.error,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.margin,
    paddingBottom: SPACING.xl,
  },
  iconoCirculo: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    ...BORDERS.thick,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  estadoTextos: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  estadoTitulo: {
    color: COLORS.primary,
    textAlign: 'center',
  },
  estadoSubtitulo: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  progresoSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  progresoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.gutter,
    marginBottom: SPACING.lg,
  },
  bentoCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  bentoCardFullWidth: {
    flexBasis: '100%',
    flex: 0,
    width: '100%',
  },
  bentoDashed: {
    borderStyle: 'dashed',
  },
  bentoLabel: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  bentoLabelError: {
    color: COLORS.error,
    textAlign: 'center',
  },
  cardNombre: {
    color: COLORS.primary,
    textAlign: 'center',
  },
  cardNombreError: {
    color: COLORS.error,
    textAlign: 'center',
  },
  botones: {
    gap: SPACING.gutter,
    marginBottom: SPACING.lg,
  },
  btnPrimario: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.default,
    ...BORDERS.thin,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 48,
  },
  btnPrimarioText: {
    color: COLORS.onPrimary,
  },
  btnSecundario: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.default,
    ...BORDERS.thin,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnSecundarioText: {
    color: COLORS.primary,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  logEmpty: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  logItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.gutter,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceLight,
    ...BORDERS.thin,
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.outline,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    backgroundColor: COLORS.surfaceLight,
  },
  chipText: {
    color: COLORS.textSecondary,
  },
});

// Helper de color por tipo de evento. Vive fuera de StyleSheet.create
// porque devuelve un estilo dinamico (no admite functions el create).
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
