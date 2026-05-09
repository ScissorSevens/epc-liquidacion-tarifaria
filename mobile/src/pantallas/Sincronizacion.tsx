import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
// navigation no se usa en esta pantalla (era para goBack — eliminado al migrar
// Sincronizacion a tab raíz de SyncStack). Se mantiene en Props para
// compatibilidad de tipo con NativeStackScreenProps.
export default function Sincronizacion(_props: Props) {
  const [bootstrap, setBootstrap] = useState<BootstrapApp | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<null | 'health' | 'sync' | 'cola'>(
    null,
  );
  const [eventos, setEventos] = useState<EventoLog[]>([]);

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
    ) => {
      const evento: EventoLog = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: formatHora(new Date()),
        tipo,
        mensaje,
        ...(status !== undefined && { status }),
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
      agregarEvento(
        'health',
        ok ? 'Backend Healthy' : `Backend respondio: ${txt.slice(0, 80)}`,
        String(resp.status),
      );
    } catch (e) {
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

      // Detalle item por item — solo los no-EXITOSO para reducir ruido.
      // Los EXITOSO ya cumplieron su trabajo; solo interesan los que
      // siguen pendientes, bloqueados o fallidos.
      const idsEnCola = new Set(items.map((i) => i.id));
      const itemsActivos = items.filter((i) => i.estado !== 'EXITOSO');
      if (itemsActivos.length === 0) {
        agregarEvento('cola', 'Todos los items sincronizados ✓');
        return;
      }
      for (const it of itemsActivos) {
        const partes = [
          it.tipo,
          it.estado,
          `int:${it.intentos}`,
        ];
        if (it.dependeDe && it.dependeDe.length > 0) {
          const deps = it.dependeDe.map((dep) => {
            const enc = items.find((x) => x.id === dep);
            if (!enc) return `${dep.slice(0, 6)}=AUSENTE`;
            return `${dep.slice(0, 6)}=${enc.estado}`;
          });
          partes.push(`dep:[${deps.join(',')}]`);
          // Bloqueado si alguna dep no esta EXITOSO.
          const bloqueado = it.dependeDe.some((dep) => {
            const enc = items.find((x) => x.id === dep);
            return !enc || enc.estado !== 'EXITOSO';
          });
          if (bloqueado && it.estado === 'PENDIENTE') {
            partes.push('⚠ BLOQUEADO');
          }
        }
        if (it.ultimoError) {
          partes.push(`err:"${it.ultimoError.slice(0, 40)}"`);
        }
        agregarEvento('cola', partes.join(' '));
      }
      // Marcador para detectar IDs huerfanos faciles de leer.
      void idsEnCola;
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.headlineMd, styles.title]}>SINCRONIZACIÓN</Text>
        <Text style={[TYPOGRAPHY.bodySm, styles.muted]}>
          {bootstrap.apiBaseUrl}
        </Text>
      </View>

      <View style={styles.botones}>
        <Pressable
          onPress={probarConexion}
          disabled={cargando !== null}
          style={({ pressed }) => [
            styles.btnPrimario,
            pressed && styles.btnPressed,
            cargando !== null && styles.btnDisabled,
          ]}
        >
          <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>
            {cargando === 'health' ? 'PROBANDO…' : 'PROBAR CONEXIÓN'}
          </Text>
        </Pressable>

        <Pressable
          onPress={sincronizar}
          disabled={cargando !== null}
          style={({ pressed }) => [
            styles.btnPrimario,
            pressed && styles.btnPressed,
            cargando !== null && styles.btnDisabled,
          ]}
        >
          <Text style={[TYPOGRAPHY.labelLg, styles.btnPrimarioText]}>
            {cargando === 'sync' ? 'SINCRONIZANDO…' : 'SINCRONIZAR AHORA'}
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

      <View style={styles.logHeader}>
        <Text style={TYPOGRAPHY.labelLg}>EVENTOS</Text>
        <Text style={[TYPOGRAPHY.labelMd, styles.muted]}>
          {eventos.length === 0 ? 'sin eventos' : `${eventos.length} eventos`}
        </Text>
      </View>

      <FlatList
        data={eventos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.logList}
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
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.margin,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.margin,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  muted: {
    color: COLORS.textSecondary,
  },
  errorText: {
    ...TYPOGRAPHY.bodyMd,
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
  },
  btnPrimarioText: {
    color: COLORS.onPrimary,
  },
  btnSecundario: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.default,
    ...BORDERS.thick,
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
  logList: {
    paddingBottom: SPACING.xl,
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
});

// Helper de color por tipo de evento. Vive fuera de StyleSheet.create
// porque devuelve un estilo dinamico (no admite functions el create).
function colorPorTipo(tipo: EventoLog['tipo']): { color: string } {
  return {
    color:
      tipo === 'error'
        ? COLORS.error
        : tipo === 'sync'
        ? COLORS.primary
        : COLORS.textSecondary,
  };
}
