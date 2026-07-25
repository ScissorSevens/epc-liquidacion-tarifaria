import './__mocks__/use-focus-effect-mock';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RutaDeHoy from '../../src/pantallas/RutaDeHoy';
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

  mockGetBootstrap.mockResolvedValue({
    suscriptorRepo: { listar: jest.fn().mockResolvedValue(suscriptores) },
    lecturaRepo: { listar: jest.fn().mockResolvedValue(lecturas) },
    colaRepo: { listar: jest.fn().mockResolvedValue(cola) },
    medidorRepo: { listar: jest.fn().mockResolvedValue(medidores) },
    prestadorRepo: { obtenerPorId: prestadorPorId },
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
    // 1) NO debe quedar el fallback "Sin prestador activo" en ningún lado.
    expect(screen.queryByText(/Sin prestador activo/i)).toBeNull();
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
    // Sin "Sin prestador activo" como subtítulo.
    expect(screen.queryByText(/Sin prestador activo/i)).toBeNull();
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
});

/** Helper: aplana arrays de style a un solo objeto. */
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
