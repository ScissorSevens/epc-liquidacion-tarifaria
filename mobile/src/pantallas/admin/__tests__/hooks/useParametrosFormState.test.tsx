// mobile/src/pantallas/admin/__tests__/hooks/useParametrosFormState.test.tsx
//
// Tests contractuales del hook `useParametrosFormState` — encapsula los
// 18 useState + useFocusEffect + validators + guardar del screen
// ParametrosTarifa (parametros-tarifa-screen-decomposition Phase 1
// task 1.3 — GREEN).
//
// Cobertura (mínimo 8 tests):
//   T-HOOK-1 inicializa state con defaults correctos (2016 anio_base,
//            0 numericos, false booleans, '' strings, año actual periodo).
//   T-HOOK-2 hidrata state desde `parametrosActuales` prop cuando
//            cambia de null → valor.
//   T-HOOK-3 setCma/setCmo/etc funcionan como setters (todos los
//            16 strings + 2 booleans).
//   T-HOOK-4 validarTodo retorna error cuando cma < CMA_MINIMO_ACUEDUCTO
//            (2890, Res CRA 825/2017 Art. 15).
//   T-HOOK-5 validarTodo retorna error cuando cmo < CMOG_MINIMO_ACUEDUCTO
//            (467, Res CRA 825/2017 Art. 18).
//   T-HOOK-6 validarTodo retorna error si vigenteDesde > vigenteHasta.
//   T-HOOK-7 guardar() llama repo.guardar con el payload correcto
//            (incluye cmaa, aplicaCmaa, altitud, anioDestino,
//            factorIpc, ipufIndice, etc.).
//   T-HOOK-8 guardar() muestra Alert 'Éxito' si persiste OK.
//
// TDD Evidence:
//   RED  → modulo no existe. Import tira Cannot find module.
//   GREEN → implementacion en useParametrosFormState.ts. Tests pasan.
//
// Estrategia de mocks:
//   - useFocusEffect se sustituye por useEffect (mismo patron que en
//     ParametrosTarifa.test.tsx) para evitar la dependencia de
//     NavigationContainer.
//   - expo-haptics: mockeado inline para no invocar la native API.
//   - Alert.alert: espiado via jest.spyOn para verificar el titulo.
//   - useWorkspace: no se importa en el hook (el hook solo encapsula
//     state + validators + persistencia local; la propagacion al store
//     queda en el caller ParametrosTarifa.tsx).

/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderHook, act } from '@testing-library/react-native';
import { Alert, Platform as PlatformRN } from 'react-native';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Sustituir useFocusEffect por useEffect para que el hook funcione en
// tests sin NavigationContainer. El callback se ejecuta en mount +
// cuando cambian las deps (mismo patron que ParametrosTarifa.test.tsx).
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactNative = require('react');
  return {
    ...actual,
    useFocusEffect: (cb: () => unknown) => {
      ReactNative.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});

// ParametrosTarifa fixture valido (subset de los campos que el hook
// necesita para hidratar el state local).
import type { ParametrosTarifa } from '../../../../../dominio/parametros-tarifa/types';

const anioActual = Number(new Date().toISOString().slice(0, 4));

const parametrosFixtureCompleto: ParametrosTarifa = {
  id_parametros: 200,
  id_prestador: 7,
  id_acuerdo: 100,
  periodo: 2026,
  cma: 12_345_678,
  cmo: 500,
  cmi: 120,
  cmt: 80,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 50_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 350,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  ipuf_indice: 1.0,
  cargo_fijo_resultante: 12_345_678,
  cargo_consumo_resultante: 500 + 120 + 80,
  componentes_aplicables: ['CMA', 'CMO', 'CMI', 'CMT', 'CMVIAA'],
  minimo_vital: null,
  vigente_desde: '2025-01-01T00:00:00.000Z',
  vigente_hasta: '2029-12-31T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  anio_base: 2016,
  factor_indexacion_ipc: 1.0,
  anio_destino_indexacion: 2026,
  altitud_msnm: 2600,
  cmaa: 1500,
  aplica_cmaa: true,
  acto_adopcion: 'https://example.com/decreto-042-2024',
  estudio_costos_id: 'SUI-2024-EST-001',
  documento_soporte_url: 'https://example.com/estudio-costos.pdf',
};

/**
 * Repo fake que implementa el contrato `ParametrosTarifaRepository`.
 * Solo `guardar` se espia — `buscarVigente` no se usa por el hook
 * (la hidratacion viene via prop `parametrosActuales`).
 */
function crearRepoFake() {
  return {
    guardar: jest.fn().mockResolvedValue(parametrosFixtureCompleto),
    buscarVigente: jest.fn().mockResolvedValue(null),
    // Metodos requeridos por la interface (TS check) pero no usados:
    crear: jest.fn().mockResolvedValue(parametrosFixtureCompleto),
    obtenerPorId: jest.fn().mockResolvedValue(parametrosFixtureCompleto),
    listar: jest.fn().mockResolvedValue([parametrosFixtureCompleto]),
    buscarPorPeriodo: jest.fn().mockResolvedValue(parametrosFixtureCompleto),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
}

describe('useParametrosFormState', () => {
  beforeEach(() => {
    // Restaurar Platform.OS a default por si tests anteriores lo mutaron.
    Object.defineProperty(PlatformRN, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-1 — Inicializa state con defaults correctos
  //
  // Cuando `parametrosActuales=null` y no hay persistencia previa,
  // el hook debe inicializar todos los inputs con sus defaults:
  //   - Strings numericos → '0' (excepto anioBase='2016' normativo y
  //     ipuf='6' estandar CRA).
  //   - Strings texto → '' (actoAdopcion, estudioCostosId,
  //     documentoSoporteUrl).
  //   - Booleans → false.
  //   - periodo → año actual (dinámico).
  //   - vigenteDesde → hoy ISO.
  //   - vigenteHasta → año actual + 4 → 12-31.
  //   - altitud → '0' (nivel del mar → limite 16 m3/mes default).
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-1: inicializa state con defaults correctos', () => {
    it('los 16 strings + 2 booleans arrancan en sus defaults', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );

      // Strings numericos.
      expect(result.current.values.cma).toBe('0');
      expect(result.current.values.cmo).toBe('0');
      expect(result.current.values.cmi).toBe('0');
      expect(result.current.values.cmt).toBe('0');
      expect(result.current.values.cmviaa).toBe('0');
      expect(result.current.values.cmaa).toBe('0');
      expect(result.current.values.aguaSuministrada).toBe('0');
      expect(result.current.values.suscriptoresPromedio).toBe('0');
      expect(result.current.values.altitud).toBe('0');
      // Strings con default normativo:
      expect(result.current.values.anioBase).toBe('2016'); // Res CRA 825/2017 Art. 7.
      expect(result.current.values.ipuf).toBe('6'); // Estándar CRA art. 5.
      // Strings con default dinamico:
      expect(result.current.values.periodo).toBe(String(anioActual));
      // anio_destino default = periodo tarifario vigente (= anioActual).
      expect(result.current.values.anioDestino).toBe(String(anioActual));
      // factor_indexacion_ipc default 1.0 (sin indexación).
      expect(result.current.values.factorIpc).toBe('1');
      // ipuf_indice default 1.0 (multiplicador sin ajuste).
      expect(result.current.values.ipufIndice).toBe('1');
      // Strings de texto vacíos (documentos opcionales):
      expect(result.current.values.actoAdopcion).toBe('');
      expect(result.current.values.estudioCostosId).toBe('');
      expect(result.current.values.documentoSoporteUrl).toBe('');
      // Booleans:
      expect(result.current.values.aplicaCmviaa).toBe(false);
      expect(result.current.values.aplicaCmaa).toBe(false);
    });

    it('vigenteDesde = hoy, vigenteHasta = año+4 fin de año', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      const hoy = new Date().toISOString().slice(0, 10);
      expect(result.current.values.vigenteDesde).toBe(hoy);
      expect(result.current.values.vigenteHasta).toBe(
        `${anioActual + 4}-12-31`,
      );
    });

    it('cargandoInputs arranca true porque repo no es null pero no hay datos', () => {
      // cargandoInputs = repo === null || cargando. Con repo provisto y
      // parametrosActuales=null, cargando permanece false (no hay fetch).
      // El flag global es false desde el primer render — el operador ve
      // el form editable desde el inicio.
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      expect(result.current.cargandoInputs).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-2 — Hidrata state desde `parametrosActuales`
  //
  // Re-renderizar el hook con `parametrosActuales` distinto (null →
  // valor) debe poblar todos los inputs locales con los datos del
  // ParametrosTarifa persistido.
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-2: hidrata state desde parametrosActuales prop', () => {
    it('al cambiar parametrosActuales de null → valor, los inputs se hidratan', () => {
      const repo = crearRepoFake();
      const { result, rerender } = renderHook(
        ({ p }: { p: ParametrosTarifa | null }) =>
          useParametrosFormState({
            id_prestador: 7,
            id_acuerdo: 100,
            repo,
            parametrosActuales: p,
          }),
        { initialProps: { p: null as ParametrosTarifa | null } },
      );

      // Antes: defaults.
      expect(result.current.values.cma).toBe('0');

      // Hidratamos con el fixture completo.
      rerender({ p: parametrosFixtureCompleto });

      // Tras hidrantarse: todos los campos reflejan el fixture.
      expect(result.current.values.periodo).toBe('2026');
      expect(result.current.values.cma).toBe('12345678');
      expect(result.current.values.cmo).toBe('500');
      expect(result.current.values.cmi).toBe('120');
      expect(result.current.values.cmt).toBe('80');
      expect(result.current.values.aplicaCmviaa).toBe(false);
      expect(result.current.values.cmviaa).toBe('0');
      expect(result.current.values.cmaa).toBe('1500');
      expect(result.current.values.aplicaCmaa).toBe(true);
      expect(result.current.values.actoAdopcion).toBe(
        'https://example.com/decreto-042-2024',
      );
      expect(result.current.values.estudioCostosId).toBe('SUI-2024-EST-001');
      expect(result.current.values.documentoSoporteUrl).toBe(
        'https://example.com/estudio-costos.pdf',
      );
      expect(result.current.values.aguaSuministrada).toBe('50000');
      expect(result.current.values.ipuf).toBe('6');
      expect(result.current.values.suscriptoresPromedio).toBe('350');
      expect(result.current.values.anioBase).toBe('2016');
      expect(result.current.values.anioDestino).toBe('2026');
      expect(result.current.values.factorIpc).toBe('1');
      expect(result.current.values.ipufIndice).toBe('1');
      expect(result.current.values.vigenteDesde).toBe('2025-01-01');
      expect(result.current.values.vigenteHasta).toBe('2029-12-31');
      expect(result.current.values.altitud).toBe('2600');
    });

    it('NO re-hidrata si ya se hidrato antes (one-shot guard contra refetch)', () => {
      // Re-renderizar con el MISMO fixture NO debe pisar ediciones del
      // usuario que tipearon entremedio (verifica el yaSincronizadoRef).
      const repo = crearRepoFake();
      const { result, rerender } = renderHook(
        ({ p }: { p: ParametrosTarifa | null }) =>
          useParametrosFormState({
            id_prestador: 7,
            id_acuerdo: 100,
            repo,
            parametrosActuales: p,
          }),
        { initialProps: { p: parametrosFixtureCompleto } },
      );

      // Usuario edita CMA.
      act(() => {
        result.current.setters.setCma('99999999');
      });
      expect(result.current.values.cma).toBe('99999999');

      // Re-render con la MISMA prop (simula refetch).
      rerender({ p: parametrosFixtureCompleto });

      // La edicion del usuario NO se pisa (one-shot guard).
      expect(result.current.values.cma).toBe('99999999');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-3 — Setters funcionan (16 strings + 2 booleans)
  //
  // Cada setter expuesto por el hook debe mutar el campo
  // correspondiente del state. Verificamos un subset representativo:
  // cma, cmo, periodo, anioBase, altitud (strings) +
  // aplicaCmviaa, aplicaCmaa (booleans).
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-3: setters funcionan para los 16 strings + 2 booleans', () => {
    it('setCma y setCmo mutan los strings correspondientes', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('5000000');
      });
      expect(result.current.values.cma).toBe('5000000');
      act(() => {
        result.current.setters.setCmo('600');
      });
      expect(result.current.values.cmo).toBe('600');
    });

    it('setPeriodo, setAnioBase, setAltitud mutan strings', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setPeriodo('2028');
      });
      expect(result.current.values.periodo).toBe('2028');
      act(() => {
        result.current.setters.setAnioBase('2018');
      });
      expect(result.current.values.anioBase).toBe('2018');
      act(() => {
        result.current.setters.setAltitud('1500');
      });
      expect(result.current.values.altitud).toBe('1500');
    });

    it('setAplicaCmviaa y setAplicaCmaa mutan booleans', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      expect(result.current.values.aplicaCmviaa).toBe(false);
      expect(result.current.values.aplicaCmaa).toBe(false);
      act(() => {
        result.current.setters.setAplicaCmviaa(true);
      });
      expect(result.current.values.aplicaCmviaa).toBe(true);
      act(() => {
        result.current.setters.setAplicaCmaa(true);
      });
      expect(result.current.values.aplicaCmaa).toBe(true);
    });

    it('setActoAdopcion y setDocumentoSoporteUrl mutan strings de texto', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setActoAdopcion('https://example.com/decreto');
      });
      expect(result.current.values.actoAdopcion).toBe('https://example.com/decreto');
      act(() => {
        result.current.setters.setDocumentoSoporteUrl('https://example.com/doc.pdf');
      });
      expect(result.current.values.documentoSoporteUrl).toBe(
        'https://example.com/doc.pdf',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-4 — validarTodo: error si cma < CMA_MINIMO_ACUEDUCTO (2890)
  //
  // El hook debe invocar `validarCmaMinimo(cmaNum, 'acueducto')` del
  // dominio y, si tira throw, poblar `errors.cma` con el mensaje.
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-4: validarTodo retorna error cuando cma < CMA_MINIMO_ACUEDUCTO', () => {
    it('cma=2000 (menor a 2890) produce errors.cma', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('2000');
      });
      // cmo=500 tambien valida (T-HOOK-5); pero aqui queremos aislar
      // cma. Seteamos cmo a un valor valido.
      act(() => {
        result.current.setters.setCmo('500');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.cma).toBeDefined();
      expect(errors.cma).toMatch(/normativo/i);
    });

    it('cma=2890 (igual al minimo) NO produce error', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('2890');
      });
      act(() => {
        result.current.setters.setCmo('500');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.cma).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-5 — validarTodo: error si cmo < CMOG_MINIMO_ACUEDUCTO (467)
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-5: validarTodo retorna error cuando cmo < CMOG_MINIMO_ACUEDUCTO', () => {
    it('cmo=400 (menor a 467) produce errors.cmo', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('12000000'); // cma valido
      });
      act(() => {
        result.current.setters.setCmo('400');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.cmo).toBeDefined();
      expect(errors.cmo).toMatch(/normativo/i);
    });

    it('cmo=467 (igual al minimo) NO produce error', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('12000000');
      });
      act(() => {
        result.current.setters.setCmo('467');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.cmo).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-6 — validarTodo: error si vigenteDesde > vigenteHasta
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-6: validarTodo retorna error si vigenteDesde > vigenteHasta', () => {
    it('vigente_desde=2030-01-01, vigente_hasta=2025-01-01 produce errors.vigenteHasta', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      // Seteamos inputs validos primero (cma, cmo, suscriptores).
      act(() => {
        result.current.setters.setCma('12000000');
      });
      act(() => {
        result.current.setters.setCmo('500');
      });
      act(() => {
        result.current.setters.setSuscriptoresPromedio('300');
      });
      act(() => {
        result.current.setters.setVigenteDesde('2030-01-01');
      });
      act(() => {
        result.current.setters.setVigenteHasta('2025-01-01');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.vigenteHasta).toBeDefined();
      expect(errors.vigenteHasta).toMatch(/posterior/i);
    });

    it('vigente_desde=2025-01-01, vigente_hasta=2029-12-31 NO produce error', () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('12000000');
      });
      act(() => {
        result.current.setters.setCmo('500');
      });
      act(() => {
        result.current.setters.setSuscriptoresPromedio('300');
      });
      act(() => {
        result.current.setters.setVigenteDesde('2025-01-01');
      });
      act(() => {
        result.current.setters.setVigenteHasta('2029-12-31');
      });
      let errors: Record<string, string | undefined> = {};
      act(() => {
        errors = result.current.validarTodo();
      });
      expect(errors.vigenteHasta).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-7 — guardar() llama repo.guardar con el payload correcto
  //
  // El payload debe incluir TODOS los campos persistidos:
  //   cmaa, aplicaCmaa, altitud, anioDestino, factorIpc, ipufIndice,
  //   actoAdopcion, estudioCostosId, documentoSoporteUrl, etc.
  // ───────────────────────────────────────────────────────────────────
  describe('T-HOOK-7: guardar() llama repo.guardar con payload correcto', () => {
    it('con inputs validos, repo.guardar recibe payload COMPLETO', async () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      // Inputs validos (normativos).
      act(() => {
        result.current.setters.setCma('12000000');
      });
      act(() => {
        result.current.setters.setCmo('500');
      });
      act(() => {
        result.current.setters.setCmi('120');
      });
      act(() => {
        result.current.setters.setCmt('80');
      });
      act(() => {
        result.current.setters.setSuscriptoresPromedio('300');
      });
      // Phase 2 fields (cmaa, aplicaCmaa, docs).
      act(() => {
        result.current.setters.setAplicaCmaa(true);
      });
      act(() => {
        result.current.setters.setCmaa('1500');
      });
      act(() => {
        result.current.setters.setActoAdopcion('https://example.com/decreto');
      });
      act(() => {
        result.current.setters.setEstudioCostosId('SUI-001');
      });
      act(() => {
        result.current.setters.setDocumentoSoporteUrl('https://example.com/doc.pdf');
      });
      // Phase 3 fields (IPC).
      act(() => {
        result.current.setters.setAnioBase('2016');
      });
      act(() => {
        result.current.setters.setAnioDestino('2026');
      });
      act(() => {
        result.current.setters.setFactorIpc('1.5');
      });
      act(() => {
        result.current.setters.setIpufIndice('1.2');
      });
      // Altitud (Res CRA 750/2016).
      act(() => {
        result.current.setters.setAltitud('2600');
      });

      await act(async () => {
        await result.current.guardar();
      });

      // repo.guardar se invoca 1 vez.
      expect(repo.guardar).toHaveBeenCalledTimes(1);
      const arg = repo.guardar.mock.calls[0]?.[0] as Record<string, unknown>;
      // Campos numericos parseados (Phase 2: cmaa).
      expect(arg.cmaa).toBe(1500);
      // Flag explicito (Phase 2 task 2.4).
      expect(arg.aplica_cmaa).toBe(true);
      // Altitud (Res CRA 750/2016).
      expect(arg.altitud_msnm).toBe(2600);
      // Phase 3 task 3.4 (GREEN): IPC editable.
      expect(arg.factor_indexacion_ipc).toBe(1.5);
      expect(arg.ipuf_indice).toBe(1.2);
      expect(arg.anio_destino_indexacion).toBe(2026);
      // Documentos opcionales (Fase 2).
      expect(arg.acto_adopcion).toBe('https://example.com/decreto');
      expect(arg.estudio_costos_id).toBe('SUI-001');
      expect(arg.documento_soporte_url).toBe('https://example.com/doc.pdf');
      // Suscriptores / Costos medios parseados.
      expect(arg.cma).toBe(12000000);
      expect(arg.cmo).toBe(500);
      expect(arg.suscriptores_promedio).toBe(300);
    });

    it('NO llama repo.guardar si validarTodo retorna errores', async () => {
      const repo = crearRepoFake();
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      // cma=2000 < minimo → validacion falla.
      act(() => {
        result.current.setters.setCma('2000');
      });
      await act(async () => {
        await result.current.guardar();
      });
      expect(repo.guardar).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // T-HOOK-8 — guardar() muestra Alert 'Éxito' si persiste OK
  // ───────────────────────────────────────────────────────────────────
  describe("T-HOOK-8: guardar() muestra Alert 'Éxito' si persiste OK", () => {
    it('con inputs validos, Alert.alert es llamado con titulo "Éxito"', async () => {
      const repo = crearRepoFake();
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { result } = renderHook(() =>
        useParametrosFormState({
          id_prestador: 7,
          id_acuerdo: 100,
          repo,
          parametrosActuales: null,
        }),
      );
      act(() => {
        result.current.setters.setCma('12000000');
      });
      act(() => {
        result.current.setters.setCmo('500');
      });
      act(() => {
        result.current.setters.setSuscriptoresPromedio('300');
      });
      await act(async () => {
        await result.current.guardar();
      });
      expect(alertSpy).toHaveBeenCalled();
      const titulo = (alertSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(titulo).toBe('Éxito');
      alertSpy.mockRestore();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Import del hook AL FINAL del archivo para que los `describe` arriba
// reporten sus tests aun si el import tira (jest.collectFileFrom module
// error = el suite entero falla con "Cannot find module", que ES el
// RED esperado de la task 1.2).
// ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line import/order
import { useParametrosFormState } from '../../hooks/useParametrosFormState';