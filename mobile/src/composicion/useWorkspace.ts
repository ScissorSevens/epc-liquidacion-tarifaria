/**
 * Store Zustand para el workspace multi-tenant del operario.
 *
 * Permite al operario cambiar entre los prestadores rurales vinculados a EPC
 * (programa "Agua la Vereda"). El prestador activo persiste en AsyncStorage
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
  setIdPrestadorActivo: (id: number) => Promise<void>;
  cargarContexto: (repo: {
    prestador: { buscarPorId: (id: number) => Promise<Prestador | null> };
    acuerdo: { buscarVigente: (id: number, fecha: string) => Promise<AcuerdoMunicipal | null> };
    parametros: { buscarVigente: (id: number, periodo: number) => Promise<ParametrosTarifa | null> };
  }) => Promise<void>;
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
   * Resetea el workspace a estado "sin prestador activo" — usado en
   * logout (futuro) y cuando se invalida la sesión defensivamente.
   *
   * NO toca `prestadores_disponibles`: ese campo es el catálogo de
   * prestadores vinculados al operario y se popula por una capa superior
   * (no por la sesión). Limpiarlo acá sería incorrecto: significaría
   * "olvidar" con qué prestadores puede trabajar el operario.
   */
  limpiarWorkspace: () => Promise<void>;
}

const periodoActual = (): number => Number(new Date().toISOString().slice(0, 4));

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      id_prestador_activo: 0,
      prestador: null,
      prestadores_disponibles: [],
      acuerdo_vigente: null,
      parametros_vigentes: null,
      cargando: false,

      setPrestadores: (prestadores) => set({ prestadores_disponibles: prestadores }),

      setIdPrestadorActivo: async (id) => {
        set({ id_prestador_activo: id });
        // El cargarContexto lo invoca el caller tras esto
      },

      cargarContexto: async (repo) => {
        const id = get().id_prestador_activo;
        set({ cargando: true });
        try {
          const prestador = await repo.prestador.buscarPorId(id);
          const acuerdo = await repo.acuerdo.buscarVigente(id, new Date().toISOString());
          const parametros = await repo.parametros.buscarVigente(id, periodoActual());
          set({
            prestador,
            acuerdo_vigente: acuerdo,
            parametros_vigentes: parametros,
            cargando: false,
          });
        } catch (err) {
          set({ cargando: false });
          throw err;
        }
      },

      setSesionCompleta: async (sesion) => {
        set({ id_prestador_activo: sesion.idPrestador });
        // Persist middleware (línea 92) escribe automáticamente
        // `id_prestador_activo` en AsyncStorage bajo 'workspace-storage'.
        // Sin embargo, dejamos el método como async para que el caller
        // (AuthGate, Login) pueda await-ear la promesa si lo desea y
        // mantener consistencia con `setIdPrestadorActivo`.
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
