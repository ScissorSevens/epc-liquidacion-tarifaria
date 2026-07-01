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

import type { Prestador } from '../dominio/prestadores/types';
import type { AcuerdoMunicipal } from '../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa } from '../dominio/parametros-tarifa/types';

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
    }),
    {
      name: 'workspace-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ id_prestador_activo: state.id_prestador_activo }),
    },
  ),
);
