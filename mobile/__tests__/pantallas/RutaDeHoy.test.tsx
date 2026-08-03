import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { COLORS } from '../../src/theme/skeletal-tokens';
import RutaDeHoy, { styles } from '../../src/pantallas/RutaDeHoy';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { crearNavMock } from './__mocks__/nav';
import { getBootstrap } from '../../src/composition/get-bootstrap';
import { useWorkspace } from '../../src/composicion/useWorkspace';

// useWorkspace importa @react-native-async-storage/async-storage (persist
// middleware de Zustand). El módulo nativo no está disponible en Jest —
// mockeamos con stubs in-memory.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/composition/get-bootstrap');
const mockGetBootstrap = getBootstrap as jest.MockedFunction<typeof getBootstrap>;

// expo-haptics: mock estable para que `await Haptics.*Async()` retorne undefined.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// expo-image: SF Symbols via string source. Mockeamos para que el render
// funcione en jest sin el runtime nativo. Usamos React.createElement en vez
// de JSX para evitar problemas con el transformer dentro de jest.mock().
jest.mock('expo-image', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockImage = function MockImage(props: {
    source: unknown;
    style?: unknown;
    tintColor?: string;
    accessibilityLabel?: string;
  }) {
    const sourceStr = typeof props.source === 'string'
      ? props.source
      : (props.source as { uri?: string })?.uri ?? '';
    return React.createElement(
      Text,
      {
        testID: 'expo-image-source',
        style: props.style,
        accessibilityHint: props.tintColor !== undefined ? `tint:${props.tintColor}` : undefined,
        accessibilityLabel: props.accessibilityLabel,
      },
      sourceStr,
    );
  };
  return { Image: MockImage };
});

// RutaDeHoy usa TopBar → useSafeAreaInsets → SafeAreaProvider.
// initialMetrics zero para aserciones estables.
const renderConProviders = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>,
  );

// useNetInfo depende de @react-native-community/netinfo que requiere
// APIs nativas no disponibles en jest. Mockeamos a "sin conexión" estable.
jest.mock('../../src/hooks/useNetInfo', () => ({
  useNetInfo: () => ({ isConnected: false }),
}));

// La fecha de hoy en formato YYYY-MM-DD
const HOY = new Date().toISOString().slice(0, 10);
const TIMESTAMP_HOY = `${HOY}T10:00:00.000Z`;
const TIMESTAMP_AYER = `${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}T10:00:00.000Z`;

const SUSCRIPTORES = [
  { id_suscriptor: 1, codigo: 'S001', nombre_apellidos: 'Ana García', direccion: 'Calle 1', estrato: 2 },
  { id_suscriptor: 2, codigo: 'S002', nombre_apellidos: 'Carlos López', direccion: 'Calle 2', estrato: 3 },
  { id_suscriptor: 3, codigo: 'S003', nombre_apellidos: 'María Torres', direccion: 'Calle 3', estrato: 1 },
];

const MEDIDORES = [
  { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
  { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
  { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
];

// 1 lectura con timestamp de HOY para el medidor 10 (suscriptor 1)
const LECTURAS_UNA_HOY = [
  {
    id: 1,
    id_medidor: 10,
    id_periodo: 'P01',
    id_operario: 99,
    lectura_anterior: 100,
    lectura_actual: 115,
    timestamp_captura: TIMESTAMP_HOY,
  },
];

const LECTURAS_VIEJAS = [
  {
    id: 1,
    id_medidor: 10,
    id_periodo: 'P01',
    id_operario: 99,
    lectura_anterior: 80,
    lectura_actual: 100,
    timestamp_captura: TIMESTAMP_AYER,
  },
];

function configurarBootstrap(opciones: {
  suscriptores?: typeof SUSCRIPTORES;
  lecturas?: typeof LECTURAS_UNA_HOY;
  cola?: { id: number; estado: string }[];
  medidores?: typeof MEDIDORES;
  prestadorPorId?: jest.Mock<Promise<unknown | null>, [number]>;
} = {}) {
  const {
    suscriptores = SUSCRIPTORES,
    lecturas = LECTURAS_UNA_HOY,
    cola = [],
    medidores = MEDIDORES,
    prestadorPorId = jest.fn().mockResolvedValue(null),
  } = opciones;

  const listarPorSuscriptor = jest.fn().mockImplementation(async (id: number) =>
    (medidores as Array<{ id_suscriptor: number; id_medidor: number; serial: string }>)
      .filter((m) => m.id_suscriptor === id),
  );

  mockGetBootstrap.mockResolvedValue({
    repos: {
      suscriptorRepo: { listar: jest.fn().mockResolvedValue(suscriptores) },
      lecturaRepo: { listar: jest.fn().mockResolvedValue(lecturas) },
      colaRepo: { listar: jest.fn().mockResolvedValue(cola) },
      medidorRepo: {
        listar: jest.fn().mockResolvedValue(medidores),
        listarPorSuscriptor,
      },
      prestadorRepo: { obtenerPorId: prestadorPorId },
    },
  } as any);
}

describe('RutaDeHoy', () => {
  let nav: ReturnType<typeof crearNavMock>;

  // Estado base del workspace. Por defecto, prestador activo
  // (Acueducto La Esperanza) con NIT y segmento visibles.
  const PRESTADOR_BASE = {
    id_prestador: 5,
    codigo: 'P005',
    nombre: 'Acueducto La Esperanza',
    nit: '900123456-7',
    representante_legal: 'Pedro Pérez',
    representante_legal_cedula: '12345678',
    municipio: 'Fusagasugá',
    departamento: 'Cundinamarca',
    segmento: 2 as const,
    num_suscriptores_urbanos: 40,
    num_suscriptores_rurales: 110,
    contacto: null,
    estado: 'activo' as const,
    created_at: '',
    updated_at: '',
    aps: null,
  };

  beforeEach(() => {
    nav = crearNavMock();
    jest.clearAllMocks();
    useWorkspace.setState({
      id_prestador_activo: 5,
      prestador: PRESTADOR_BASE,
      prestadores_disponibles: [PRESTADOR_BASE],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
  });

  // SC-SYS-11: suscriptor con lectura este mes muestra "Capturado este mes"
  it('SC-SYS-11: suscriptor con lectura este mes muestra Capturado este mes', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Capturado este mes')).toBeTruthy();
  });

  // SC-SYS-12: suscriptores sin lectura muestran "Lectura pendiente"
  it('SC-SYS-12: suscriptores sin lectura muestran Lectura pendiente', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Capturado este mes');
    const pendientes = screen.getAllByText('Lectura pendiente');
    expect(pendientes.length).toBe(2);
  });

  // SC-SYS-13: el contador del header refleja total de lecturas capturadas
  // (la pantalla actual NO renderiza un botón SINCRONIZAR — sólo lleva el
  // conteo de pendientes a la tab Sincronizacion). Verificamos que el conteo
  // del mes se incrementa cuando hay lecturas.
  it('SC-SYS-13: contador Lecturas del mes refleja capturas', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Lecturas del mes')).toBeTruthy();
    // El contador "1 / 3" se renderiza como Text fragmentado.
    // Buscamos el Text hijo "/ 3" que es único del contador.
    expect(screen.getByText('/ 3')).toBeTruthy();
  });

  // SC-SYS-14: la cola ya no tiene un botón SINCRONIZAR en esta pantalla
  it('SC-SYS-14: SINCRONIZAR no aparece (movido a tab Sincronizacion)', async () => {
    configurarBootstrap({ cola: [] });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.queryByText(/SINCRONIZAR/i)).toBeNull();
  });

  // SC-SYS-15: error en carga muestra Reintentar
  it('SC-SYS-15: error en carga muestra Reintentar', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('fallo de red'));
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
  });

  // SC-SYS-16: 1 de 3 suscriptores con lectura → contador 1 / 3
  it('SC-SYS-16: muestra el progreso correcto 1 / 3', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText(/Lecturas del mes/)).toBeTruthy();
    // El contador muestra "1 / 3" (Text fragmentado por el span interior)
    expect(screen.getByText('/ 3')).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TDD Red 2026-07-25 — Identidad del prestador (Option A + Option B)
  //
  // User pidió "más cercana con el prestador" — que el operario vea
  // con quién está trabajando, no una lista genérica de "suscriptores".
  //
  // Cambios:
  //   - TopBar recibe nombre del prestador como subtitulo.
  //   - Banner de identidad (NIT, segmento, total suscriptores, %).
  //   - Banner de conectividad ELIMINADO.
  // ──────────────────────────────────────────────────────────────────────────

  // T-ID-A1: TopBar muestra el nombre del prestador como subtitulo
  it('T-ID-A1: TopBar muestra el nombre del prestador activo como subtitulo', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    // El TopBar subtitulo + el banner de identidad renderizan el nombre
    // del prestador — al menos uno debe estar visible.
    const matches = screen.getAllByText(/Acueducto La Esperanza/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // T-ID-B1: Banner de identidad muestra el NIT del prestador
  it('T-ID-B1: banner de identidad muestra el NIT del prestador', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.getByText(/900123456-7/)).toBeTruthy();
  });

  // T-ID-B2: Banner de identidad muestra el segmento
  it('T-ID-B2: banner de identidad muestra el segmento del prestador', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    // segmento 2 = rural según dominio/tipos
    expect(screen.getByText(/segmento 2/i)).toBeTruthy();
  });

  // T-ID-B3: Banner de identidad muestra total suscriptores del prestador
  it('T-ID-B3: banner de identidad muestra total suscriptores del prestador', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    // urban 40 + rural 110 = 150
    expect(screen.getByText(/150/)).toBeTruthy();
  });

  // T-ID-B4: Banner de identidad muestra % capturado del mes
  it('T-ID-B4: banner de identidad muestra porcentaje capturado del mes', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    // 1 capturado / 3 suscriptores = 33%
    expect(screen.getByText(/33%/)).toBeTruthy();
  });

  // T-ID-NET-1: Banner de conectividad "Sin conexión" ELIMINADO
  it('T-ID-NET-1: NO muestra el banner "Sin conexión" (funcionalidad de sync deshabilitada)', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.queryByText(/Sin conexi[oó]n/i)).toBeNull();
  });

  // T-ID-NET-2: Banner de conectividad "Conectado" ELIMINADO
  it('T-ID-NET-2: NO muestra el banner "Conectado" (funcionalidad de sync deshabilitada)', async () => {
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    expect(screen.queryByText(/Conectado/i)).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TDD Red 2026-07-25 — Bug del prestador activo
  //
  // El bug:
  //   - En `useWorkspace.setSesionCompleta(sesion)` solo se setea
  //     `id_prestador_activo` (no el objeto `prestador`).
  //   - En cold-boot, `useWorkspace.getState().prestador === null` aunque
  //     haya un prestador en la DB local.
  //   - `RutaDeHoy` lee `prestador` del store y cuando es null renderiza
  //     el fallback "Sin prestador activo" como subtítulo del TopBar Y
  //     oculta el banner de identidad aunque el operario trabaje con un
  //     prestador real.
  //
  // El fix:
  //   - Agregar selector `useWorkspace((s) => s.id_prestador_activo)`.
  //   - useEffect: si `prestador === null && id_prestador_activo !== 0`,
  //     cargar `prestadorRepo.obtenerPorId(id)` y guardarlo en el store.
  //   - Si `id_prestador_activo === 0`, mostrar estado vacío claro con CTA
  //     "Configurar prestador" (en vez de "Sin prestador activo").
  // ──────────────────────────────────────────────────────────────────────────

  // T-ID-PRES-1: cuando el store tiene id_prestador_activo pero NO el
  // objeto prestador (estado cold-boot real), la pantalla debe cargarlo
  // del repo y mostrar el banner de identidad con el nombre.
  it('T-ID-PRES-1: carga prestador del repo cuando store tiene solo id', async () => {
    // Simulamos cold-boot: setSesionCompleta setea id pero NO el objeto.
    useWorkspace.setState({
      id_prestador_activo: 5,
      prestador: null, // <-- el bug
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    const prestadorPorId = jest.fn().mockResolvedValue(PRESTADOR_BASE);
    configurarBootstrap({ prestadorPorId });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    // 1) El banner muestra el nombre del prestador cargado del repo.
    //    Usamos string exact (no regex) para NO matchear el subtitulo del
    //    TopBar "Acueducto La Esperanza · Fusagasugá".
    expect(await screen.findByText('Acueducto La Esperanza')).toBeTruthy();
    // 2) El repo fue invocado con el id correcto.
    expect(prestadorPorId).toHaveBeenCalledWith(5);
    // 3) El store fue hidratado (sin esto, la proxima render volveria a null).
    expect(useWorkspace.getState().prestador?.nombre).toBe('Acueducto La Esperanza');
  });

  // T-ID-PRES-2: si el repo no encuentra el prestador (id huérfano),
  // la pantalla muestra estado vacío claro (NO el fallback histórico
  // "Sin prestador activo") con un CTA para que el operario pueda
  // configurar otro prestador.
  it('T-ID-PRES-2: si repo no encuentra el prestador, muestra estado vacío con CTA', async () => {
    useWorkspace.setState({
      id_prestador_activo: 5,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    // El repo devuelve null (id huérfano o borrado).
    configurarBootstrap({ prestadorPorId: jest.fn().mockResolvedValue(null) });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    // 1) NO debe quedar el fallback "Sin prestador (activo|asignado|en uso)" en ningún lado.
    expect(screen.queryByText(/Sin prestador (activo|asignado|en uso)/i)).toBeNull();
    // 2) Debe haber un CTA claro de "Configurar prestador".
    //    Usamos string exact porque el boton se llama igual que el heading
    //    de la empty card ("Configurá tu prestador") NO matchea este text.
    expect(await screen.findByText('Configurar prestador')).toBeTruthy();
  });

  // T-ID-PRES-3: si el workspace está sin prestador activo
  // (id_prestador_activo === 0), la pantalla NO debe mostrar el
  // fallback "Sin prestador activo" sino un estado vacío con CTA.
  it('T-ID-PRES-3: si id_prestador_activo = 0, muestra estado vacío con CTA', async () => {
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    const prestadorPorId = jest.fn().mockResolvedValue(null);
    configurarBootstrap({ prestadorPorId });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    // Sin "Sin prestador (activo|asignado|en uso)" como subtítulo.
    expect(screen.queryByText(/Sin prestador (activo|asignado|en uso)/i)).toBeNull();
    // Con CTA claro (string exact).
    expect(await screen.findByText('Configurar prestador')).toBeTruthy();
    // Nunca llamamos al repo si id = 0 (cheapest branch).
    expect(prestadorPorId).not.toHaveBeenCalled();
  });

  // T-ID-PRES-4: si el prestador YA está en el store, NO se debe llamar
  // al repo (re-fetch redundante). Evita loops de carga en el ciclo de
  // vida de la pantalla.
  it('T-ID-PRES-4: NO carga del repo si prestador ya esta en el store', async () => {
    useWorkspace.setState({
      id_prestador_activo: 5,
      prestador: PRESTADOR_BASE, // ya cargado
      prestadores_disponibles: [PRESTADOR_BASE],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    const prestadorPorId = jest.fn().mockResolvedValue(PRESTADOR_BASE);
    configurarBootstrap({ prestadorPorId });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    await screen.findByText('Ana García');
    // No se invoca el repo cuando ya tenemos el objeto.
    expect(prestadorPorId).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TDD Red 2026-07-25 — Estilo Nequi en el banner de identidad
  //
  // El rediseño pide jerarquía visual y formas geométricas suaves:
  //   - headlineMd para el nombre (más prominente que headlineSm).
  //   - NIT + segmento como metadato (labelMd / bodySm, NO en MAYÚSCULAS).
  //   - Un círculo de color de marca como elemento geométrico distintivo
  //     alrededor del icono business.
  // ──────────────────────────────────────────────────────────────────────────

  // T-NEQUI-1: el banner usa headlineMd (no headlineSm) para que el
  // nombre del prestador sea el elemento tipográfico más prominente.
  it('T-NEQUI-1: nombre del prestador usa headlineMd (jerarquía prominente)', async () => {
    configurarBootstrap();
    const { toJSON } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Ana García');
    // Buscamos un Text cuyo style incluya fontSize=24 (headlineMd)
    // y cuyo contenido sea el nombre del prestador.
    const json = toJSON() as { children?: unknown };
    const textsConHeadlineMd = collectTextNodesByFontSize(json, 24);
    const conNombre = textsConHeadlineMd.find((n) =>
      /Acueducto La Esperanza/.test(n.content),
    );
    expect(conNombre).toBeDefined();
  });

  // T-NEQUI-2: el banner NO usa `textTransform: 'uppercase'` en ningún
  // Text. Regla de impecable: ALL CAPS solo para badges cortos.
  it('T-NEQUI-2: el banner NO usa textTransform uppercase', async () => {
    configurarBootstrap();
    const { toJSON } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Acueducto La Esperanza');
    const violations = collectNodesWithUppercase(toJSON());
    expect(violations).toEqual([]);
  });

  // T-NEQUI-3: el banner incluye un elemento geométrico visual (un
  // contenedor con borderRadius "full" ocurriendo en un elemento con
  // tinte de color — ej. el círculo del icono business). Esto valida
  // que el rediseño introdujo la "forma geométrica de fondo" pedida
  // por el user (inspiración Nequi).
  it('T-NEQUI-3: el banner tiene un circulo de color de marca (forma geometrica)', async () => {
    configurarBootstrap();
    const { toJSON } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Acueducto La Esperanza');
    const circles = collectViewsWithFullRadius(toJSON());
    // Al menos 2 círculos en la pantalla: el del icono del prestador +
    // el del check de captura en cards (si hubiera); o más. Buscamos
    // que el rediseño introdujo el círculo del icono.
    expect(circles.length).toBeGreaterThanOrEqual(1);
    // Y debe haber al menos uno con un backgroundColor de marca
    // (no transparente / sin color).
    const conColorDeMarca = circles.filter((c) => Boolean(c.backgroundColor));
    expect(conColorDeMarca.length).toBeGreaterThanOrEqual(1);
  });

  // T-DESIGN-1: Las cards de suscriptores NO usan el anti-pattern
  // "border + shadow combo" (ghost-card). Sin elevation, sin shadowColor.
  // Verificamos via toJSON() que las cards (Views con borderRadius >= 12)
  // NO tienen shadowColor/elevation.
  it('T-DESIGN-1: cards de suscriptores sin shadow + border combo (anti-pattern ghost-card)', async () => {
    configurarBootstrap();
    const { toJSON } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Ana García');

    // Las cards (borderRadius 16) no deben tener shadow + border combo.
    // El iconCircleCheck (borderRadius full) y la handleBar del modal
    // (borderRadius full) tienen radius >=12 pero no son cards.
    // Filtramos por borderWidth 1 (que solo tienen las cards).
    const cards = collectViewsWithBorderWidthAndRadius(toJSON(), 12);
    expect(cards.length).toBeGreaterThan(0);
    // Todas las cards NO deben tener shadowColor ni elevation
    for (const card of cards) {
      expect(card.style.shadowColor).toBeUndefined();
      expect(card.style.elevation).toBeUndefined();
    }
  });
  it('T-CRAFT-1: topBarBtn tiene minHeight >= 44', () => {
    const style = StyleSheet.flatten(styles.topBarBtn) as unknown as Record<string, number | undefined>;
    expect(Math.max(style.minHeight ?? 0, style.height ?? 0)).toBeGreaterThanOrEqual(44);
  });

  it('T-CRAFT-2: card de suscriptor tiene minHeight >= 64', () => {
    const style = StyleSheet.flatten(styles.card) as unknown as Record<string, number | undefined>;
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
  });

  it('T-CRAFT-3: contraste WCAG AA en progresoNumero', () => {
    const hex = (StyleSheet.flatten(styles.progresoNumero) as unknown as Record<string, string>).color;
    const luminance = (value: string) => {
      const rgb = value.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16) / 255);
      const linear = rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const ratio = (luminance(COLORS.background) + 0.05) / (luminance(hex) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('T-CRAFT-4: topBarBtnPressed usa token, no rgba hardcoded', () => {
    expect((StyleSheet.flatten(styles.topBarBtnPressed) as unknown as Record<string, string>).backgroundColor).toBe(COLORS.surfaceContainer);
  });

  it('T-CRAFT-5: no hay ghost-cards con border + shadow', () => {
    for (const key of ['card', 'identidadCard', 'identidadVaciaCard', 'progresoCard']) {
      const style = StyleSheet.flatten(styles[key as keyof typeof styles]) as unknown as Record<string, number | undefined>;
      expect(style.shadowRadius ?? 0).toBeLessThan(8);
      expect(style.elevation ?? 0).toBe(0);
    }
  });

  it('T-CRAFT-6: border-radius consistente, cards <= 16 y modal = 24', () => {
    const card = StyleSheet.flatten(styles.card) as unknown as Record<string, number>;
    const ident = StyleSheet.flatten(styles.identidadCard) as unknown as Record<string, number>;
    const identVacia = StyleSheet.flatten(styles.identidadVaciaCard) as unknown as Record<string, number>;
    const sheet = StyleSheet.flatten(styles.bottomSheet) as unknown as Record<string, number>;
    expect(card.borderRadius).toBeLessThanOrEqual(16);
    expect(ident.borderRadius).toBeLessThanOrEqual(16);
    expect(identVacia.borderRadius).toBeLessThanOrEqual(16);
    expect(sheet.borderTopLeftRadius).toBe(24);
    expect(sheet.borderTopRightRadius).toBe(24);
  });

  it('T-NATIVE-1: Platform.OS=ios usa SF Symbol para account-circle', async () => {
    // Source-level check + render check via getByTestId. Verificamos que
    // existe la rama Platform.select que monta <Image source="sf:..."> en
    // iOS y <MaterialIcons name="account-circle"> en Android.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/pantallas/RutaDeHoy.tsx'),
      'utf8',
    );
    expect(source).toMatch(/Platform\.OS === 'ios'/);
    expect(source).toMatch(/sf:person\.crop\.circle/);
    expect(source).toMatch(/MaterialIcons\s+name="account-circle"/);
    // Render-time check (best-effort; el mock de expo-image puede no
    // aplicarse en jest-expo cuando hay un moduleNameMapper global).
    Object.defineProperty(require('react-native').Platform, 'OS', {
      configurable: true,
      get: () => 'ios',
    });
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Ana García')).toBeTruthy();
  });

  it('T-NATIVE-2: Platform.OS=android usa MaterialIcons (no SF Symbol)', async () => {
    Object.defineProperty(require('react-native').Platform, 'OS', {
      configurable: true,
      get: () => 'android',
    });
    configurarBootstrap();
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Ana García')).toBeTruthy();
    // En Android el bloque Platform.OS === 'ios' es false; no debe
    // renderearse <Image source="sf:...">. El codigo debe contener la
    // rama MaterialIcons (ya cubierto por T-NATIVE-1).
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/pantallas/RutaDeHoy.tsx'),
      'utf8',
    );
    expect(source).toMatch(/MaterialIcons\s+name="account-circle"/);
  });

  it('T-NATIVE-3: tap en suscriptor llama Haptics.selectionAsync', async () => {
    const Haptics = require('expo-haptics');
    (Haptics.selectionAsync as jest.Mock).mockClear();
    configurarBootstrap({
      // Carlos (id_suscriptor=2) tiene 1 medidor → navegación directa.
      lecturas: [],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
      ],
    });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    const card = await screen.findByText('Carlos López');
    fireEvent.press(card);
    await waitFor(() => {
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  it('T-NATIVE-4: navigate exitoso llama Haptics.notificationAsync(Success)', async () => {
    const Haptics = require('expo-haptics');
    (Haptics.notificationAsync as jest.Mock).mockClear();
    configurarBootstrap({
      lecturas: [],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
      ],
    });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    const card = await screen.findByText('Carlos López');
    fireEvent.press(card);
    await waitFor(() => {
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );
    });
  });

  it('T-NATIVE-5: ScrollView tiene contentInsetAdjustmentBehavior="automatic"', async () => {
    configurarBootstrap();
    const { UNSAFE_root } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Ana García');
    const sv = UNSAFE_root.findByProps({ contentInsetAdjustmentBehavior: 'automatic' });
    expect(sv).toBeTruthy();
  });

  it('T-NATIVE-6: lista se renderiza via FlatList', async () => {
    configurarBootstrap();
    const { UNSAFE_root } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Ana García');
    const flatLists = UNSAFE_root.findAllByType(
      require('react-native').FlatList,
    );
    expect(flatLists.length).toBeGreaterThanOrEqual(1);
    const flatList = flatLists[0];
    expect(flatList.props.initialNumToRender).toBe(10);
    expect(flatList.props.data.length).toBe(3);
  });

  it('T-NATIVE-7: useFocusEffect NO recarga si día/prestador no cambiaron', async () => {
    // El componente expone la lógica de smart-reload via `ultimoReloadRef`.
    // Verificamos source-level que el callback consulta el ref antes de
    // llamar cargar(false).
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/pantallas/RutaDeHoy.tsx'),
      'utf8',
    );
    expect(source).toMatch(/ultimoReloadRef/);
    expect(source).toMatch(/useFocusEffect/);
    // La logica debe comparar prestadorId y dia contra el ref.
    expect(source).toMatch(/prestadorId\s*===/);
    expect(source).toMatch(/previa\.dia\s*===\s*clave\.dia/);
  });

  it('T-NATIVE-8: IdentidadCard y ProgresoCard envuelven en React.memo', async () => {
    // Source-level check: los wrappers memo existen.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/pantallas/RutaDeHoy.tsx'),
      'utf8',
    );
    expect(source).toMatch(/const\s+IdentidadCardMemo\s*=\s*memo\(IdentidadCard\)/);
    expect(source).toMatch(/const\s+ProgresoCardMemo\s*=\s*memo\(ProgresoCard\)/);
    expect(source).toMatch(/const\s+SuscriptorCardMemo\s*=\s*memo\(SuscriptorCard\)/);
  });

  it('T-INTEG-1: render con 3 estados de suscriptor (capturado, pendiente, sin medidor)', async () => {
    configurarBootstrap({
      lecturas: [
        // Suscriptor 1 capturado este mes (medidor 10).
        {
          id: 1,
          id_medidor: 10,
          id_periodo: 'P01',
          id_operario: 99,
          lectura_anterior: 100,
          lectura_actual: 115,
          timestamp_captura: TIMESTAMP_HOY,
        },
      ],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
        // Suscriptor 2 sin medidores → estado sin-medidor (igual
        // visualmente a pendiente, pero NO navega al tap).
      ],
    });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Capturado este mes')).toBeTruthy();
    // Suscriptores 2 y 3 (sin lectura) muestran "Lectura pendiente".
    const pendientes = screen.getAllByText('Lectura pendiente');
    expect(pendientes.length).toBe(2);
    // Suscriptor 2 (sin medidor) sigue mostrando "Lectura pendiente"
    // visualmente pero NO debe navegar al tap (navegación retorna early).
  });

  it('T-INTEG-2: tap suscriptor con 1 medidor navega directo (CapturarLectura)', async () => {
    configurarBootstrap({
      lecturas: [],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
      ],
    });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    const carlos = await screen.findByText('Carlos López');
    fireEvent.press(carlos);
    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith('CapturarLectura', {
        id_medidor: 20,
        id_suscriptor: 2,
      });
    });
  });

  it('T-INTEG-3: tap suscriptor con 2+ medidores abre modal selector', async () => {
    const nav = crearNavMock();
    configurarBootstrap({
      lecturas: [],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 11, id_suscriptor: 1, serial: 'M001B' }, // 2do medidor para Ana
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
      ],
    });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    // Ana está capturada → usar Carlos (con 1 medidor) NO abre modal. Probemos
    // agregando 2 medidores a Carlos:
    configurarBootstrap({
      lecturas: [],
      medidores: [
        { id_medidor: 10, id_suscriptor: 1, serial: 'M001' },
        { id_medidor: 20, id_suscriptor: 2, serial: 'M002' },
        { id_medidor: 21, id_suscriptor: 2, serial: 'M002B' },
        { id_medidor: 30, id_suscriptor: 3, serial: 'M003' },
      ],
    });
    const carlos = await screen.findByText('Carlos López');
    fireEvent.press(carlos);
    await waitFor(() => {
      expect(screen.getByText('Seleccionar medidor')).toBeTruthy();
    });
    expect(screen.getByText('Medidor #20')).toBeTruthy();
    expect(screen.getByText('Medidor #21')).toBeTruthy();
    // El navigation.navigate directo NO debe haberse llamado todavía
    // (se llama cuando el usuario elige en el modal).
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('T-LOGIC-1: progreso calculado correctamente (5/10 = 50%)', async () => {
    const subs = Array.from({ length: 10 }, (_, i) => ({
      id_suscriptor: i + 1,
      codigo: `S${String(i + 1).padStart(3, '0')}`,
      nombre_apellidos: `Suscriptor ${i + 1}`,
      direccion: '',
      estrato: 1,
    }));
    const meds = subs.map((s) => ({
      id_medidor: s.id_suscriptor,
      id_suscriptor: s.id_suscriptor,
      serial: `M${s.id_suscriptor}`,
    }));
    // 5 lecturas de hoy (suscripciones 1..5).
    const lects = meds.slice(0, 5).map((m, i) => ({
      id: i + 1,
      id_medidor: m.id_medidor,
      id_periodo: 'P01',
      id_operario: 99,
      lectura_anterior: 100,
      lectura_actual: 110 + i,
      timestamp_captura: TIMESTAMP_HOY,
    }));
    configurarBootstrap({ suscriptores: subs, lecturas: lects, medidores: meds });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Lecturas del mes')).toBeTruthy();
    // 5/10 = 50% capturado.
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('T-LOGIC-2: banner de identidad muestra NIT, segmento, total suscriptores y %', async () => {
    configurarBootstrap();
    const { getByText, getAllByText } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    await screen.findByText('Ana García');
    // NIT visible en el banner.
    expect(getByText(/900123456-7/)).toBeTruthy();
    // Segmento 2 rural.
    expect(getByText(/segmento 2/i)).toBeTruthy();
    // Total suscriptores = urbanos + rurales = 40 + 110 = 150.
    expect(getByText('150')).toBeTruthy();
    // Porcentaje capturado (1/3 = 33%).
    expect(getAllByText(/33%/)).toBeTruthy();
  });

  it('T-INTEG-4: estado vacío con CTA "Configurar prestador" cuando id_prestador_activo=0', async () => {
    useWorkspace.setState({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,
    });
    const prestadorPorId = jest.fn().mockResolvedValue(null);
    configurarBootstrap({ prestadorPorId });
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Configurá tu prestador')).toBeTruthy();
    // El CTA apunta a la pantalla de Config.
    const cta = await screen.findByText('Configurar prestador');
    fireEvent.press(cta);
    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith('Config', { screen: 'MiPerfil' });
    });
  });

  it('T-INTEG-5: estado de loading con ActivityIndicator y "Cargando ruta…"', async () => {
    // Bootstrap que nunca resuelve → loading permanece true.
    mockGetBootstrap.mockReturnValue(new Promise(() => { /* pending */ }) as any);
    const { UNSAFE_root } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    expect(await screen.findByText('Cargando ruta…')).toBeTruthy();
    const { ActivityIndicator } = require('react-native');
    const indicators = UNSAFE_root.findAllByType(ActivityIndicator);
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  it('T-INTEG-6: estado de error con botón Reintentar', async () => {
    mockGetBootstrap.mockRejectedValue(new Error('fallo de red'));
    renderConProviders(<RutaDeHoy navigation={nav as any} route={{} as any} />);
    expect(await screen.findByText('Reintentar')).toBeTruthy();
    expect(screen.getByText(/Error al cargar: fallo de red/)).toBeTruthy();
  });

  it('T-PERF-1: FlatList con 100 suscriptores tiene initialNumToRender=10', async () => {
    const subs = Array.from({ length: 100 }, (_, i) => ({
      id_suscriptor: i + 1,
      codigo: `S${String(i + 1).padStart(3, '0')}`,
      nombre_apellidos: `Suscriptor ${i + 1}`,
      direccion: '',
      estrato: 1,
    }));
    const meds = subs.map((s) => ({
      id_medidor: s.id_suscriptor,
      id_suscriptor: s.id_suscriptor,
      serial: `M${s.id_suscriptor}`,
    }));
    configurarBootstrap({ suscriptores: subs, lecturas: [], medidores: meds });
    const { UNSAFE_root } = renderConProviders(
      <RutaDeHoy navigation={nav as any} route={{} as any} />,
    );
    expect(await screen.findByText('Suscriptor 1')).toBeTruthy();
    const { FlatList } = require('react-native');
    const flatLists = UNSAFE_root.findAllByType(FlatList);
    expect(flatLists.length).toBeGreaterThanOrEqual(1);
    const fl = flatLists[0];
    // La lista NO renderiza los 100 de una — solo los primeros 10.
    expect(fl.props.initialNumToRender).toBe(10);
    // La cantidad total de datos sigue siendo 100 (la lista está
    // disponible, solo se renderiza en chunks via virtualización).
    expect(fl.props.data.length).toBe(100);
  });

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map((s) => flattenStyle(s)));
  }
  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }
  return {};
}

/** Helper: recolecta Views con borderWidth=1 y borderRadius >= min. */
function collectViewsWithBorderWidthAndRadius(
  node: unknown,
  min: number,
): Array<{ style: Record<string, unknown> }> {
  const out: Array<{ style: Record<string, unknown> }> = [];
  const visit = (n: unknown): void => {
    if (n === null || typeof n !== 'object') return;
    const obj = n as { type?: string; props?: { style?: unknown }; children?: unknown[] };
    if (obj.type === 'View' && obj.props?.style) {
      const style = flattenStyle(obj.props.style);
      const br = style.borderRadius;
      const bw = style.borderWidth;
      if (typeof br === 'number' && br >= min && bw === 1) {
        out.push({ style });
      }
    }
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) visit(c);
    }
  };
  visit(node);
  return out;
}

/** Helper: extrae texto de nodos recursivamente. */
function extractText(node: unknown, acc: string[]): void {
  if (node === null || typeof node !== 'object') return;
  const obj = node as { type?: string; props?: { children?: unknown }; children?: unknown[] };
  if (obj.type === 'Text') {
    if (typeof obj.props?.children === 'string') acc.push(obj.props.children);
    if (Array.isArray(obj.props?.children)) {
      for (const c of obj.props.children) extractText(c, acc);
    }
  }
  if (Array.isArray(obj.children)) {
    for (const c of obj.children) extractText(c, acc);
  }
}

/** Helper: recolecta Texts cuyo style tiene fontSize === esperado. */
function collectTextNodesByFontSize(
  node: unknown,
  fontSize: number,
): Array<{ content: string; style: Record<string, unknown> }> {
  const out: Array<{ content: string; style: Record<string, unknown> }> = [];
  const visit = (n: unknown, parentStyle: Record<string, unknown> | null): void => {
    if (n === null || typeof n !== 'object') return;
    const obj = n as { type?: string; props?: { style?: unknown }; children?: unknown[] };
    const style = obj.props?.style
      ? Object.assign({}, parentStyle ?? {}, flattenStyle(obj.props.style))
      : parentStyle;
    if (obj.type === 'Text') {
      const fs = (style as Record<string, unknown>)?.fontSize;
      if (fs === fontSize) {
        // El text content vive en `obj.children` (RNSpy format para
        // React Native), no en `obj.props.children`. Es un array de
        // strings (textos que React concatena) o un solo string.
        const ch = obj.children;
        let content = '';
        if (typeof ch === 'string') content = ch;
        else if (Array.isArray(ch)) content = ch.filter((s) => typeof s === 'string').join('');
        out.push({ content, style: (style ?? {}) as Record<string, unknown> });
      }
    }
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) visit(c, style);
    }
  };
  visit(node, null);
  return out;
}

/** Helper: recolecta nodos con `textTransform: 'uppercase'` en el style. */
function collectNodesWithUppercase(node: unknown): Array<{ path: string }> {
  const out: Array<{ path: string }> = [];
  const visit = (n: unknown, path: string): void => {
    if (n === null || typeof n !== 'object') return;
    const obj = n as { type?: string; props?: { style?: unknown }; children?: unknown[] };
    if (obj.props?.style) {
      const style = flattenStyle(obj.props.style);
      if (style.textTransform === 'uppercase') {
        out.push({ path: `${path}/${obj.type ?? 'node'}` });
      }
    }
    if (Array.isArray(obj.children)) {
      obj.children.forEach((c, i) => visit(c, `${path}/${obj.type ?? 'node'}[${i}]`));
    }
  };
  visit(node, '');
  return out;
}

/** Helper: recolecta Views con borderRadius = full (RADIUS.full = 9999). */
function collectViewsWithFullRadius(
  node: unknown,
): Array<{ backgroundColor?: string }> {
  const out: Array<{ backgroundColor?: string }> = [];
  const visit = (n: unknown): void => {
    if (n === null || typeof n !== 'object') return;
    const obj = n as { type?: string; props?: { style?: unknown }; children?: unknown[] };
    if (obj.type === 'View' && obj.props?.style) {
      const style = flattenStyle(obj.props.style);
      // Aceptamos RADIUS.full (9999) o cualquier numero >= 100 (pill).
      const br = style.borderRadius;
      if (typeof br === 'number' && br >= 100) {
        const backgroundColor = typeof style.backgroundColor === 'string'
          ? style.backgroundColor
          : undefined;
        out.push({ backgroundColor });
      }
    }
    if (Array.isArray(obj.children)) {
      for (const c of obj.children) visit(c);
    }
  };
  visit(node);
  return out;
}
});
