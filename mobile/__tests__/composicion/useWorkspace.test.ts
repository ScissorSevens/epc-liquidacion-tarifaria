// mobile/__tests__/composicion/useWorkspace.test.ts
//
// Tests contractuales del store useWorkspace (Fase 4 Tarea 4.2.1).
//
// Nuevos métodos bajo cobertura:
//   - setSesionCompleta(sesion): sincroniza id_prestador_activo con sesion.idPrestador
//   - limpiarWorkspace(): resetea id_prestador_activo + limpia prestador / acuerdo_vigente / parametros_vigentes
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
});