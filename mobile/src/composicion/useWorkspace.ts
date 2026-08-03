/**
 * Store Zustand para el workspace multi-tenant del operario.
 *
 * Permite al operario cambiar entre los prestadores rurales vinculados a EPC
 * (programa "Agua la Vereda"). El prestador en uso persiste en AsyncStorage
 * para sobrevivir reinicios de la app.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Sesion } from '../composition/constantes';
import type { Prestador } from '../../dominio/prestadores/types';
import type { AcuerdoMunicipal } from '../../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa/types';

interface WorkspaceState {
  readonly id_prestador_activo: number;
  readonly prestador: Prestador | null;
  readonly prestadores_disponibles: readonly Prestador[];
  readonly acuerdo_vigente: AcuerdoMunicipal | null;
  readonly parametros_vigentes: ParametrosTarifa | null;
  readonly cargando: boolean;
  setPrestadores: (prestadores: readonly Prestador[]) => void;
  /**
   * Actualiza `parametros_vigentes` en el store localmente.
   *
   * mi-perfil-unification-and-param-persistence Commit 2 — el setter
   * refleja el cache local del workspace Zustand. La persistencia real
   * a SQLite la hace `parametrosTarifaRepo.guardar()`. El screen
   * `admin/ParametrosTarifa.tsx` orquesta ambos: `await repo.guardar()`
   * PRIMERO persiste; luego `useWorkspace.getState().setParametrosVigentes(p)`
   * sincroniza el cache para que la liquidación use los valores nuevos.
   *
   * Contrato:
   *   - Caller: `admin/ParametrosTarifa.tsx guardar()` (tras `repo.guardar`).
   *   - Reads: `dominio/captura-lecturas/liquidar.ts` consume
   *     `parametros_vigentes` para calcular cargos.
   *
   * Acepta `null` para limpiar el slot (caso edge: edición cancelada
   * o reseteo manual). NO toca `prestador` ni `acuerdo_vigente` —
   * solo el chunk tarifario del contexto.
   */
  setParametrosVigentes: (p: ParametrosTarifa | null) => void;
  /**
   * Cambia el prestador en uso y recarga el contexto tarifario (COR-08).
   *
   * Reemplaza al buggy `setIdPrestadorActivo()` previo que solo mutaba
   * `id_prestador_activo` pero dejaba `prestador`, `acuerdo_vigente` y
   * `parametros_vigentes` apuntando al prestador ANTERIOR. Una liquidación
   * posterior usando esos datos calculaba contra los parámetros del
   * prestador equivocado.
   *
   * Flujo:
   *   1. Limpia contexto + `cargando: true` (T-WKS-5: nada del viejo queda).
   *   2. Setea `id_prestador_activo = id`.
   *   3. Recarga prestador / acuerdo_vigente / parametros_vigentes en
   *      paralelo via `Promise.all`.
   *   4. Si todo va bien: `cargando: false` y los 3 campos poblados.
   *   5. Si algo falla: `cargando: false`, contexto LIMPIO (no quedan
   *      datos a medio cargar), y se PROPAGA el error para que el caller
   *      (UI del WorkspaceSwitcher) decida si mostrar un toast / rollback.
   *
   * Los repositorios se inyectan como parámetro (no via `getBootstrap()`)
   * para mantener este store testable con mocks puros sin expo-sqlite.
   * El caller (WorkspaceSwitcher vía Admin) los pasa desde la BootstrapApp
   * cacheada.
   */
  cambiarPrestadorYCargarContexto: (
    id: number,
    repo: {
      // Alineado con los contratos reales:
      //   - PrestadorRepository.obtenerPorId
      //   - AcuerdoMunicipalRepository.buscarVigente(id, fecha).
      //   - ParametrosTarifaRepository.buscarVigente(id, fecha).
      prestador: { obtenerPorId: (id: number) => Promise<Prestador | null> };
      acuerdo: { buscarVigente: (id: number, fecha: string) => Promise<AcuerdoMunicipal | null> };
      parametros: { buscarVigente: (id: number, fecha: string) => Promise<ParametrosTarifa | null> };
    },
  ) => Promise<void>;
  /**
   * Sincroniza el workspace con la sesión recién autenticada.
   *
   * Disparado por AuthGate cuando `cargarSesion()` devuelve una sesión
   * válida al cold-boot, y por Login después de `guardarSesion()`. El
   * persist middleware persiste `id_prestador_activo` automáticamente,
   * por lo que no hace falta escribir a AsyncStorage manualmente.
   */
  setSesionCompleta: (sesion: Sesion) => Promise<void>;
  /**
   * Resetea el workspace a estado "sin prestador asignado" — usado en
   * logout (futuro) y cuando se invalida la sesión defensivamente.
   *
   * NO toca `prestadores_disponibles`: ese campo es el catálogo de
   * prestadores vinculados al operario y se popula por una capa superior
   * (no por la sesión). Limpiarlo acá sería incorrecto: significaría
   * "olvidar" con qué prestadores puede trabajar el operario.
   */
  limpiarWorkspace: () => Promise<void>;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,

      setPrestadores: (prestadores) => set({ prestadores_disponibles: prestadores }),

      /**
       * Ver bloque de docs en la interface arriba. Acepta null para
       * limpieza; no toca prestador/acuerdo_vigente.
       */
      setParametrosVigentes: (p) => set({ parametros_vigentes: p }),

      /**
       * Ver bloque de docs en la interface arriba (COR-08).
       *
       * Orden de operaciones (importa para no dejar la UI con estado
       * inconsistente):
       *   1. Clear atómico de contexto + set de cargando. Si la pantalla
       *      observa `cargando=true`, sabe que los datos viejos ya no son
       *      válidos y puede mostrar un spinner / deshabilitar inputs.
       *   2. Set del id (la intención del usuario ya está registrada).
       *   3. Promise.all para fetch paralelo — 3 latencias en vez de 3x.
       *   4. set final con resultados o catch con cleanup.
       */
      cambiarPrestadorYCargarContexto: async (id, repo) => {
        // (1) Limpiar contexto del prestador anterior. El id YA está a punto
        // de cambiar — si fallara el set siguiente, el estado intermedio
        // (id nuevo + datos viejos) sería PEOR que partir de null.
        set({
          prestador: null,
          acuerdo_vigente: null,
          parametros_vigentes: null,
          cargando: true,
        });
        // (2) Setear el id nuevo ANTES de tocar repos. Aunque la Promise.all
        // falle, el id refleja la intención del usuario (la UI puede
        // rollbackear si lo desea).
        set({ id_prestador_activo: id });
        try {
          // (3) Carga paralela de los 3 chunks del contexto tarifario.
          const [prestador, acuerdo, parametros] = await Promise.all([
            repo.prestador.obtenerPorId(id),
            repo.acuerdo.buscarVigente(id, new Date().toISOString()),
            repo.parametros.buscarVigente(id, new Date().toISOString()),
          ]);
          // (4) Set final — los 3 campos poblados, spinner off.
          set({
            prestador,
            acuerdo_vigente: acuerdo,
            parametros_vigentes: parametros,
            cargando: false,
          });
        } catch (err) {
          // (5) Limpiar spinner y dejar el contexto en null (NO repoblar
          // con datos del prestador anterior). Propagar para que el caller
          // decida: toast de error, rollback del id, reintento, etc.
          set({ cargando: false });
          throw err;
        }
      },

      setSesionCompleta: async (sesion) => {
        set({ id_prestador_activo: sesion.idPrestador });
        // Persist middleware escribe automáticamente
        // `id_prestador_activo` en AsyncStorage bajo 'workspace-storage'.
        // Sin embargo, dejamos el método como async para que el caller
        // (AuthGate, Login) pueda await-ear la promesa si lo desea.
        await Promise.resolve();
      },

      limpiarWorkspace: async () => {
        set({
          id_prestador_activo: 0,
          prestador: null,
          acuerdo_vigente: null,
          parametros_vigentes: null,
          // prestadores_disponibles NO se toca — ver doc del método arriba.
        });
        await Promise.resolve();
      },
    }),
    {
      name: 'workspace-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ id_prestador_activo: state.id_prestador_activo }),
    },
  ),
);
