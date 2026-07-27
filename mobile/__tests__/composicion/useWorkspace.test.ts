// mobile/__tests__/composicion/useWorkspace.test.ts
//
// Tests contractuales del store useWorkspace (Fase 4 Tarea 4.2.1 +
// Mobile fix item #3 del SDD setup-inicial-multi-tenant-auth).
//
// Métodos bajo cobertura:
//   - setSesionCompleta(sesion): sincroniza id_prestador_activo con sesion.idPrestador
//   - limpiarWorkspace(): resetea id_prestador_activo + limpia prestador / acuerdo_vigente / parametros_vigentes
//   - cambiarPrestadorYCargarContexto(id, repos): COR-08. Reemplaza el buggy
//     setIdPrestadorActivo() que solo cambiaba el id pero dejaba el contexto
//     tarifario apuntando al prestador anterior. Ahora limpia + setea + recarga
//     prestador / acuerdo_vigente / parametros_vigentes en paralelo.
//
// Estrategia: mockeamos AsyncStorage porque zustand/persist escribe en el
// en cada `set` del store. No necesitamos ejercitar la serialización real —
// solo que la operación de mutación del estado ocurre y que persist
// (middleware) la dispare. Tests del comportamiento del store, no de zustand.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useWorkspace } from '../../src/composicion/useWorkspace';
import type { Sesion } from '../../src/composition/constantes';
import type { Prestador } from '../../dominio/prestadores/types';
import type { AcuerdoMunicipal } from '../../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

/** Sesion válida de fixture para los tests. */
function crearSesionValida(overrides: Partial<Sesion> = {}): Sesion {
  return {
    token: 'tok-' + 'b'.repeat(32),
    cedula: '1234567890',
    nombre: 'Operario Demo',
    idOperario: 42, // auditoria legal (CRA 825/2017) — obligatorio
    idPrestador: 42,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

/** Estado base del store. Coincide con `useWorkspace.ts` initial. */
const ESTADO_INICIAL = {
  id_prestador_activo: 0,
  prestador: null,
  prestadores_disponibles: [] as never[],
  acuerdo_vigente: null,
  parametros_vigentes: null,
  cargando: false,
};

describe('useWorkspace (Fase 4.2.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset del store a su estado inicial entre tests para que cada uno
    // arranque limpio. Coincide con los initial values del create().
    useWorkspace.setState(ESTADO_INICIAL);
  });

  // ─────────────────────────────────────────────────────────────
  // setSesionCompleta
  // ─────────────────────────────────────────────────────────────
  describe('setSesionCompleta', () => {
    it('W1.1 setea id_prestador_activo con sesion.idPrestador', () => {
      const sesion = crearSesionValida({ idPrestador: 7 });

      useWorkspace.getState().setSesionCompleta(sesion);

      expect(useWorkspace.getState().id_prestador_activo).toBe(7);
    });

    it('W1.2 acepta sesion con idPrestador 1 (caso edge: prestador legacy en bootstrap)', () => {
      const sesion = crearSesionValida({ idPrestador: 1 });

      useWorkspace.getState().setSesionCompleta(sesion);

      expect(useWorkspace.getState().id_prestador_activo).toBe(1);
    });

    it('W1.3 persiste el nuevo id_prestador_activo en AsyncStorage (vía middleware persist)', () => {
      const sesion = crearSesionValida({ idPrestador: 99 });

      void useWorkspace.getState().setSesionCompleta(sesion);

      // zustand/persist escribe en AsyncStorage tras cada set; sincronico
      // porque el setItem del mock resuelve inmediatamente.
      expect(mockedSetItem).toHaveBeenCalled();
      // Buscamos la escritura cuya payload incluya el id 99
      const escrituras = mockedSetItem.mock.calls;
      const escrituraId99 = escrituras.find(([, payload]) => {
        const txt = typeof payload === 'string' ? payload : '';
        return txt.includes('99');
      });
      expect(escrituraId99).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // limpiarWorkspace
  // ─────────────────────────────────────────────────────────────
  describe('limpiarWorkspace', () => {
    it('W2.1 resetea id_prestador_activo a 0', () => {
      // Sembramos un estado "con sesión activa"
      useWorkspace.setState({ id_prestador_activo: 42 });

      void useWorkspace.getState().limpiarWorkspace();

      expect(useWorkspace.getState().id_prestador_activo).toBe(0);
    });

    it('W2.2 limpia prestador a null', () => {
      // Sembramos un prestador "vivo" en el estado (lo que cargaría cargarContexto)
      useWorkspace.setState({
        prestador: {
          id_prestador: 1,
          codigo: 'P001',
          nombre: 'ASOCIACIÓN FICTICIA',
          nit: '900000000',
          representante_legal: 'Fulano',
          representante_legal_cedula: '123456',
          municipio: 'Bogotá',
          departamento: 'Cundinamarca',
          segmento: 2,
          num_suscriptores_urbanos: 0,
          num_suscriptores_rurales: 100,
          contacto: null,
          estado: 'activo',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        } as never,
      });

      void useWorkspace.getState().limpiarWorkspace();

      expect(useWorkspace.getState().prestador).toBeNull();
    });

    it('W2.3 limpia acuerdo_vigente y parametros_vigentes a null', () => {
      // Sembramos ambos como "no-null" para verificar el reset
      useWorkspace.setState({
        acuerdo_vigente: { id_acuerdo: 1 } as never,
        parametros_vigentes: { id_parametros: 1 } as never,
      });

      void useWorkspace.getState().limpiarWorkspace();

      expect(useWorkspace.getState().acuerdo_vigente).toBeNull();
      expect(useWorkspace.getState().parametros_vigentes).toBeNull();
    });

    it('W2.4 deja prestadores_disponibles intacto (lista de prestadores vinculados del operario)', () => {
      // El catálogo de prestadores_disponibles NO es parte de la sesión
      // — limpiarWorkspace no debe tocarlo. Solo resetea la "vista" del
      // prestador activo, no el catálogo.
      useWorkspace.setState({
        prestadores_disponibles: [{ id_prestador: 5 } as never],
      });

      void useWorkspace.getState().limpiarWorkspace();

      expect(useWorkspace.getState().prestadores_disponibles).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // cambiarPrestadorYCargarContexto  (Mobile fix item #3 — COR-08)
  // ─────────────────────────────────────────────────────────────────────
  // Bug original: el método `setIdPrestadorActivo(id)` solo cambiaba el
  // id_prestador_activo. Los campos prestador / acuerdo_vigente /
  // parametros_vigentes quedaban apuntando al prestador anterior, por lo
  // que cualquier captura de lectura o liquidación posterior usaba los
  // parámetros tarifarios del prestador equivocado.
  //
  // El nuevo método limpia el contexto, setea el id y recarga las 3
  // entidades en paralelo (Promise.all). Si alguna falla, deja
  // `cargando: false` y propaga el error para que el caller decida.
  // ─────────────────────────────────────────────────────────────────────
  describe('cambiarPrestadorYCargarContexto', () => {
    /** Prestador "anterior" sembrado en el estado. Nos sirve para verificar
     *  que el método LIMPIA el contexto antes de cargar el nuevo. */
    const prestadorAnterior = {
      id_prestador: 1,
      codigo: 'LEGACY',
      nombre: 'PRESTADOR ANTERIOR',
      nit: '000',
      representante_legal: 'X',
      representante_legal_cedula: '0',
      municipio: 'M',
      departamento: 'D',
      segmento: 2 as const,
      num_suscriptores_urbanos: 0,
      num_suscriptores_rurales: 100,
      contacto: null,
      estado: 'activo' as const,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    /** Prestador nuevo devuelto por el mock de prestadorRepo. */
    const prestadorNuevo = {
      ...prestadorAnterior,
      id_prestador: 7,
      codigo: 'P007',
      nombre: 'ASOCIACIÓN NUEVA',
    };

    /** Acuerdo vigente de fixture.
     *  Shape real de `AcuerdoMunicipal` (ver
     *  dominio/acuerdo-municipal/types.ts): factores de subsidio /
     *  contribución por estrato + categoría + fechas de vigencia. */
    const acuerdoFixture: AcuerdoMunicipal = {
      id_acuerdo: 100,
      id_prestador: 7,
      factor_subsidio_e1: -0.70,
      factor_subsidio_e2: -0.55,
      factor_subsidio_e3: -0.45,
      factor_contribucion_e5: 0.20,
      factor_contribucion_e6: 0.50,
      factor_contribucion_comercial: 0.50,
      factor_contribucion_industrial: 0.30,
      fecha_vigencia_desde: '2025-01-01',
      fecha_vigencia_hasta: '2025-12-31',
      acto_administrativo_url: null,
      observaciones: 'Acuerdo de prueba',
      created_at: '2025-01-01T00:00:00.000Z',
    };

    /** Parámetros tarifarios vigentes de fixture.
     *  Shape real de `ParametrosTarifa`: CMAs + datos de agua + mínimo vital. */
    const parametrosFixture: ParametrosTarifa = {
      id_parametros: 200,
      id_prestador: 7,
      id_acuerdo: 100,
      periodo: new Date().getUTCFullYear(),
      cma: 12_345_678,
      cmo: 450,
      cmi: 120,
      cmt: 80,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 50_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 350,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
      vigente_desde: '2025-01-01',
      vigente_hasta: '2029-12-31',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    /** Mock de los 3 repos del contexto tarifario. Cada uno expone
     *  únicamente el método que el store invoca, alineado con los
     *  contratos reales:
     *    - prestador.obtenerPorId
     *    - acuerdo.buscarVigente(id, fecha)
     *    - parametros.buscarVigente(id, fecha) */
    function crearMocksRepos() {
      // Tipamos via `as` (no `jest.fn<T>()`) porque la sobrecarga del jest
      // instalado no acepta un único argumento de tipo y `mock.calls[]`
      // ya expone la forma correcta vía inferencia.
      return {
        prestador: {
          obtenerPorId: jest.fn(
            async (_id: number): Promise<Prestador | null> => null,
          ),
        },
        acuerdo: {
          buscarVigente: jest.fn(
            async (_id: number, _fecha: string): Promise<AcuerdoMunicipal | null> => null,
          ),
        },
        parametros: {
          buscarVigente: jest.fn(
            async (_id: number, _fecha: string): Promise<ParametrosTarifa | null> => null,
          ),
        },
      };
    }

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-1: setea id_prestador_activo al nuevo id antes de cargar.
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-1 setea id_prestador_activo al id solicitado', async () => {
      const repos = crearMocksRepos();
      repos.prestador.obtenerPorId.mockResolvedValue(prestadorNuevo);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      await useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos);

      expect(useWorkspace.getState().id_prestador_activo).toBe(7);
    });

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-2: carga prestador desde prestador.obtenerPorId(id).
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-2 carga prestador desde prestador.obtenerPorId con el id solicitado', async () => {
      const repos = crearMocksRepos();
      repos.prestador.obtenerPorId.mockResolvedValue(prestadorNuevo);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      await useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos);

      // Verificamos: el repo fue invocado con el id solicitado Y el store
      // guarda el resultado que devolvió.
      expect(repos.prestador.obtenerPorId).toHaveBeenCalledWith(7);
      expect(useWorkspace.getState().prestador).toEqual(prestadorNuevo);
    });

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-3: carga acuerdo_vigente con la fecha actual.
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-3 carga acuerdo_vigente desde acuerdo.buscarVigente(id, fecha actual)', async () => {
      const repos = crearMocksRepos();
      repos.prestador.obtenerPorId.mockResolvedValue(prestadorNuevo);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      const fechaAntes = new Date().toISOString();
      await useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos);
      const fechaDespues = new Date().toISOString();

      // El segundo arg de buscarVigente debe ser un ISO timestamp del
      // momento de la llamada (entre fechaAntes y fechaDespues).
      expect(repos.acuerdo.buscarVigente).toHaveBeenCalledTimes(1);
      const [, fechaArg] = repos.acuerdo.buscarVigente.mock.calls[0]!;
      expect(typeof fechaArg).toBe('string');
      const t = Date.parse(fechaArg as string);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(Date.parse(fechaAntes));
      expect(t).toBeLessThanOrEqual(Date.parse(fechaDespues));

      expect(useWorkspace.getState().acuerdo_vigente).toEqual(acuerdoFixture);
    });

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-4: carga parametros_vigentes pasando la fecha actual.
    //  (ParametrosTarifaRepository.buscarVigente(id, fecha: string)
    //   — el método NO recibe `periodo: number`, contrary to the legacy
    //   cargarContexto type-lie.)
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-4 carga parametros_vigentes desde parametros.buscarVigente(id, fecha actual)', async () => {
      const repos = crearMocksRepos();
      repos.prestador.obtenerPorId.mockResolvedValue(prestadorNuevo);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      const fechaAntes = new Date().toISOString();
      await useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos);
      const fechaDespues = new Date().toISOString();

      // El segundo arg de buscarVigente debe ser un ISO timestamp.
      expect(repos.parametros.buscarVigente).toHaveBeenCalledTimes(1);
      const [idArg, fechaArg] = repos.parametros.buscarVigente.mock.calls[0]!;
      expect(idArg).toBe(7);
      expect(typeof fechaArg).toBe('string');
      const t = Date.parse(fechaArg as string);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(Date.parse(fechaAntes));
      expect(t).toBeLessThanOrEqual(Date.parse(fechaDespues));

      expect(useWorkspace.getState().parametros_vigentes).toEqual(parametrosFixture);
    });

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-5: limpia contexto anterior antes de cargar (estados
    //   intermedios consistentes — sin "mezcla" entre prestadores).
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-5 limpia prestador / acuerdo_vigente / parametros_vigentes del prestador anterior', async () => {
      // Sembramos el estado con datos de un prestador "viejo".
      useWorkspace.setState({
        id_prestador_activo: 1,
        prestador: prestadorAnterior as never,
        acuerdo_vigente: { id_acuerdo: 1 } as never,
        parametros_vigentes: { id_parametros: 1 } as never,
      });

      const repos = crearMocksRepos();
      repos.prestador.obtenerPorId.mockResolvedValue(prestadorNuevo);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      await useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos);

      // Tras la operación, el store ya no debe contener los datos del
      // prestador viejo. La liquidación posterior NO puede usar datos
      // del prestador equivocado.
      expect(useWorkspace.getState().prestador).toEqual(prestadorNuevo);
      expect(useWorkspace.getState().prestador).not.toEqual(prestadorAnterior);
      expect(useWorkspace.getState().acuerdo_vigente).toEqual(acuerdoFixture);
      expect(useWorkspace.getState().parametros_vigentes).toEqual(parametrosFixture);
    });

    // ─────────────────────────────────────────────────────────────────
    // T-WKS-6: si alguna query falla, deja `cargando: false` y propaga.
    //   (El store NO debe quedar en estado intermedio tras un fallo de red.)
    // ─────────────────────────────────────────────────────────────────
    it('T-WKS-6 si una query falla, deja cargando=false, propaga error y NO deja estado intermedio', async () => {
      // Sembramos estado con datos de un prestador viejo para verificar
      // que el CLEAR inicial ocurrió (sino quedaría colgado el viejo).
      useWorkspace.setState({
        id_prestador_activo: 1,
        prestador: prestadorAnterior as never,
        acuerdo_vigente: { id_acuerdo: 1 } as never,
        parametros_vigentes: { id_parametros: 1 } as never,
      });

      const repos = crearMocksRepos();
      // El prestador falla con un error de red típico.
      const errorRed = new Error('NetworkError: prestador.obtenerPorId failed');
      repos.prestador.obtenerPorId.mockRejectedValue(errorRed);
      repos.acuerdo.buscarVigente.mockResolvedValue(acuerdoFixture);
      repos.parametros.buscarVigente.mockResolvedValue(parametrosFixture);

      await expect(
        useWorkspace.getState().cambiarPrestadorYCargarContexto(7, repos),
      ).rejects.toThrow('NetworkError');

      // Estado post-fallo: cargando debe estar en false (para no trabar
      // la UI con un spinner permanente). El id_prestador_activo YA fue
      // seteado por el método antes de invocar los repos (esa es la
      // semántica "el usuario YA clickeó el switcher; el rollback queda
      // a una capa superior si hace falta").
      expect(useWorkspace.getState().cargando).toBe(false);
      // El contexto quedó LIMPIO, no con datos viejos colgados.
      expect(useWorkspace.getState().prestador).toBeNull();
      expect(useWorkspace.getState().acuerdo_vigente).toBeNull();
      expect(useWorkspace.getState().parametros_vigentes).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // T-WKS-7: setParametrosVigentes (TAREA 11 commit 3)
  //
  // El MiPerfil modal de edición de parámetros tarifarios actualiza
  // el store localmente para reflejar el cambio en la UI sin tener
  // que recargar el contexto via cambiarPrestadorYCargarContexto.
  // La persistencia real a SQLite queda fuera de scope de este commit
  // (el repo no expone `actualizar`; ver
  // parametros-tarifa-repository-expo-sqlite.ts).
  // ─────────────────────────────────────────────────────────────────
  describe('setParametrosVigentes', () => {
    /** Parámetros tarifarios de fixture (definido LOCAL al describe —
     *  los fixtures del describe padre están scoped al bloque de
     *  cambiarPrestadorYCargarContexto). */
    const parametrosSeed: ParametrosTarifa = {
      id_parametros: 200,
      id_prestador: 7,
      id_acuerdo: 100,
      periodo: new Date().getUTCFullYear(),
      cma: 12_345_678,
      cmo: 450,
      cmi: 120,
      cmt: 80,
      cmviaa: 0,
      aplica_cmviaa: false,
      agua_suministrada_m3_anio: 50_000,
      ipuf_m3_suscriptor_mes: 6,
      suscriptores_promedio: 350,
      aplica_minimo_vital: true,
      m3_gratis_minimo_vital: 6,
      vigente_desde: '2025-01-01',
      vigente_hasta: '2029-12-31',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    it('T-WKS-7.1 setea parametros_vigentes al objeto provisto', () => {
      const nuevosParametros = {
        ...parametrosSeed,
        cma: 99_999_999,
      };

      useWorkspace.getState().setParametrosVigentes(nuevosParametros);

      expect(useWorkspace.getState().parametros_vigentes).toEqual(
        nuevosParametros,
      );
    });

    it('T-WKS-7.2 acepta null (caso edge: edición cancelada / limpieza)', () => {
      // Sembramos con parámetros "viejos" para verificar que setParametrosVigentes(null)
      // los limpia.
      useWorkspace.setState({
        parametros_vigentes: parametrosSeed,
      });

      useWorkspace.getState().setParametrosVigentes(null);

      expect(useWorkspace.getState().parametros_vigentes).toBeNull();
    });

    it('T-WKS-7.3 NO toca prestador / acuerdo_vigente (solo actualiza parámetros)', () => {
      // Sembramos prestador y acuerdo_vigente para verificar que el
      // setter NO los limpia accidentalmente.
      const prestadorSeed = { id_prestador: 7, nombre: 'PRESTADOR SEED' };
      const acuerdoSeed = { id_acuerdo: 100 };
      useWorkspace.setState({
        prestador: prestadorSeed as never,
        acuerdo_vigente: acuerdoSeed as never,
      });

      useWorkspace
        .getState()
        .setParametrosVigentes({ ...parametrosSeed, cmo: 999 });

      // prestador y acuerdo_vigente deben quedar intactos.
      expect(useWorkspace.getState().prestador).toEqual(prestadorSeed);
      expect(useWorkspace.getState().acuerdo_vigente).toEqual(acuerdoSeed);
      // Solo parametros_vigentes cambió.
      expect(useWorkspace.getState().parametros_vigentes?.cmo).toBe(999);
    });
  });
});