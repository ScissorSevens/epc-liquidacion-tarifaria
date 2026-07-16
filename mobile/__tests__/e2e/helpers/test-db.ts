/**
 * Helpers de DB in-memory para los E2E tests del flujo completo
 * (`__tests__/e2e/flujo-completo.test.ts`).
 *
 * QUE HACE:
 *   Construye un "DB seed" en memoria con los 4 repos que ejercitan las
 *   capas de `bootstrapCompleto`, `loginLocal` y `limpiarDatosLegacyBypass`
 *   sin tocar expo-sqlite nativo. Cada test construye su propio fixture
 *   via `buildE2EFixture()` en `beforeEach` — los Maps no se comparten
 *   entre tests, garantizando aislamiento.
 *
 * POR QUE IN-MEMORY Y NO expo-sqlite:
 *   Los tests de bootstrapCompleto / login-local / limpiar-datos-legacy
 *   ya cubren los adapters expo-sqlite con mocks por separado. Los E2E
 *   tests quieren verificar que las COMPOSICIONES (bootstrapCompleto +
 *   guardarSesion + setSesionCompleta + limpiarSesion, etc.) encajan
 *   entre sí. Para eso sirve una DB plana en memoria.
 *
 * COMPATIBILIDAD:
 *   - prestadorRepo + acuerdoRepo + parametrosRepo satisfacen los ports
 *     que `bootstrapCompleto()` requiere.
 *   - operarioRepo implementa `crear()` para bootstrap y todos los métodos
 *     de `OperarioRepositoryExpoSqlite` para login/limpieza legacy. `guardar()`
 *     queda disponible como UPSERT de compatibilidad para semillas remotas.
 *
 * HASHER + ID GENERATOR:
 *   - `hasher.sha256(input)` => `'sha256(' + input + ')'`. Determinístico:
 *     los tests pueden asserir el hash exacto que se persiste.
 *   - `idGenerator.uuid()` => `'uuid-N'` con N correlativo por invocación.
 *
 * EJEMPLO DE USO:
 *
 *   import { buildE2EFixture } from './helpers/test-db';
 *
 *   beforeEach(() => {
 *     fixture = buildE2EFixture();
 *   });
 *
 *   it('...', async () => {
 *     const { prestadorRepo, hasher } = fixture;
 *     const p = await prestadorRepo.crear({ codigo: '0001', ... });
 *     // ...
 *   });
 */

import type { CrearPrestadorInput, Prestador } from '../../../dominio/prestadores/types';
import type { AcuerdoMunicipal } from '../../../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa } from '../../../dominio/parametros-tarifa/types';
/**
 * Hay DOS `Operario` en el proyecto:
 *   - `src/operarios/types.ts` (mobile-local, `rol: string` permisivo)
 *   - `dominio/operarios/types.ts` (dominio puro, `rol: RolOperario` enum)
 *
 * El fixture usa el tipo de dominio porque es el contrato que consume
 * `bootstrapCompleto`. El método `guardar` de compatibilidad recibe el tipo
 * mobile-local completo, igual que el adapter real.

 */
import type {
  ActualizarOperarioInput,
  Operario,
  OperarioBorrador,
} from '../../../dominio/operarios/types';
import type { Operario as OperarioMobile } from '../../../src/operarios/types';
import type { Hasher, IdGenerator } from '../../../dominio/shared/ports';

/**
 * Hasher determinista: `sha256('mi-clave')` => `'sha256(mi-clave)'`.
 * Misma convención que usan los tests de `bootstrap-completo` y
 * `login-local` — un solo helper para todos los flujos E2E.
 */
function buildHasher(): Hasher {
  return { sha256: (input: string) => `sha256(${input})` };
}

/** Generador de UUIDs determinista para ids secundarios. */
function buildIdGenerator(): IdGenerator {
  let counter = 0;
  return { uuid: () => `uuid-${++counter}` };
}

/** Estado mutable de los repos. NO se comparte entre fixtures. */
export interface E2EState {
  prestadores: Map<number, Prestador>;
  acuerdos: Map<number, AcuerdoMunicipal>;
  parametros: Map<number, ParametrosTarifa>;
  operarios: Map<number, Operario>;
  prestadorIdSeq: number;
  acuerdoIdSeq: number;
  parametrosIdSeq: number;
  operarioIdSeq: number;
}

/** El fixture completo de un test E2E. */
export interface E2EFixture {
  /** Estado mutable de las 4 tablas. */
  readonly state: E2EState;
  /** Repo de prestadores — satisface `bootstrapCompleto.PrestadorRepoPort`. */
  readonly prestadorRepo: {
    crear(data: CrearPrestadorInput): Promise<Prestador>;
    listar(): Promise<readonly Prestador[]>;
    eliminar(id_prestador: number): Promise<void>;
    withTransactionAsync(task: () => Promise<void>): Promise<void>;
  };
  /** Repo de acuerdos — satisface `bootstrapCompleto.AcuerdoRepoPort`. */
  readonly acuerdoRepo: {
    crear(data: Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>): Promise<AcuerdoMunicipal>;
    eliminar(id_acuerdo: number): Promise<void>;
  };
  /** Repo de parámetros — satisface `bootstrapCompleto.ParametrosRepoPort`. */
  readonly parametrosRepo: {
    crear(data: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>): Promise<ParametrosTarifa>;
    eliminar(id_parametros: number): Promise<void>;
  };
  /**
   * Repo de operarios — satisface `OperarioRepositoryExpoSqlite` y el
   * `OperarioRepoPort` de `bootstrapCompleto`.
   *
   * `crear()` recibe un borrador y asigna el id; `guardar()` se conserva como
   * UPSERT de compatibilidad para las semillas de login/legacy.
   */
  readonly operarioRepo: {
    inicializar(): Promise<void>;
    crear(borrador: OperarioBorrador): Promise<Operario>;
    listar(): Promise<Operario[]>;
    listarPorPrestador(idPrestador: number): Promise<Operario[]>;
    buscarPorId(id: number): Promise<Operario | null>;
    buscarPorCedula(cedula: string): Promise<Operario | null>;
    buscarPorDispositivoId(id: string): Promise<Operario | null>;
    buscarPorDispositivo(dispositivoId: string, idPrestador: number): Promise<Operario | null>;
    guardar(operario: OperarioMobile): Promise<void>;
    actualizar(id: number, cambios: ActualizarOperarioInput): Promise<Operario>;
    eliminar(id_operario: number): Promise<void>;
    eliminarPorCedula(cedula: string): Promise<void>;
  };
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
}

/** Construye un fixture fresco. Cada llamada crea Maps nuevos — sin leakage entre tests. */
export function buildE2EFixture(): E2EFixture {
  const state: E2EState = {
    prestadores: new Map(),
    acuerdos: new Map(),
    parametros: new Map(),
    operarios: new Map(),
    prestadorIdSeq: 1,
    acuerdoIdSeq: 1,
    parametrosIdSeq: 1,
    operarioIdSeq: 1,
  };

  const prestadorRepo = {
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      const snapshot = {
        prestadores: new Map(state.prestadores),
        acuerdos: new Map(state.acuerdos),
        parametros: new Map(state.parametros),
        operarios: new Map(state.operarios),
        prestadorIdSeq: state.prestadorIdSeq,
        acuerdoIdSeq: state.acuerdoIdSeq,
        parametrosIdSeq: state.parametrosIdSeq,
        operarioIdSeq: state.operarioIdSeq,
      };

      try {
        await task();
      } catch (error) {
        state.prestadores = snapshot.prestadores;
        state.acuerdos = snapshot.acuerdos;
        state.parametros = snapshot.parametros;
        state.operarios = snapshot.operarios;
        state.prestadorIdSeq = snapshot.prestadorIdSeq;
        state.acuerdoIdSeq = snapshot.acuerdoIdSeq;
        state.parametrosIdSeq = snapshot.parametrosIdSeq;
        state.operarioIdSeq = snapshot.operarioIdSeq;
        throw error;
      }
    },
    async crear(data: CrearPrestadorInput): Promise<Prestador> {
      const id = state.prestadorIdSeq++;
      const now = new Date().toISOString();
      const p: Prestador = {
        id_prestador: id,
        codigo: data.codigo,
        nombre: data.nombre,
        nit: data.nit,
        representante_legal: data.representante_legal,
        representante_legal_cedula: data.representante_legal_cedula,
        municipio: data.municipio,
        departamento: data.departamento,
        segmento: data.segmento,
        num_suscriptores_urbanos: data.num_suscriptores_urbanos,
        num_suscriptores_rurales: data.num_suscriptores_rurales,
        contacto: data.contacto ?? null,
        estado: data.estado ?? 'activo',
        created_at: now,
        updated_at: now,
      };
      state.prestadores.set(id, p);
      return p;
    },
    async listar(): Promise<readonly Prestador[]> {
      return Array.from(state.prestadores.values());
    },
    async eliminar(id_prestador: number): Promise<void> {
      state.prestadores.delete(id_prestador);
    },
  };

  const acuerdoRepo = {
    async crear(data: Omit<AcuerdoMunicipal, 'id_acuerdo' | 'created_at'>): Promise<AcuerdoMunicipal> {
      const id = state.acuerdoIdSeq++;
      const a: AcuerdoMunicipal = {
        ...data,
        id_acuerdo: id,
        created_at: new Date().toISOString(),
      };
      state.acuerdos.set(id, a);
      return a;
    },
    async eliminar(id_acuerdo: number): Promise<void> {
      state.acuerdos.delete(id_acuerdo);
    },
  };

  const parametrosRepo = {
    async crear(data: Omit<ParametrosTarifa, 'id_parametros' | 'created_at'>): Promise<ParametrosTarifa> {
      const id = state.parametrosIdSeq++;
      const p: ParametrosTarifa = {
        ...data,
        id_parametros: id,
        created_at: new Date().toISOString(),
      };
      state.parametros.set(id, p);
      return p;
    },
    async eliminar(id_parametros: number): Promise<void> {
      state.parametros.delete(id_parametros);
    },
  };

  /** Repo in-memory: crea con id correlativo y expone guardar para compatibilidad. */
  const crearOperarioEnMemoria = async (borrador: OperarioBorrador): Promise<Operario> => {
    const id = state.operarioIdSeq++;
    const op: Operario = {
      id_operario: id,
      id_prestador: borrador.id_prestador,
      numero_cedula: borrador.numero_cedula,
      nombre: borrador.nombre,
      email: borrador.email,
      password_hash: borrador.password_hash,
      rol: borrador.rol,
      estado: borrador.estado,
      ...(borrador.dispositivo_id !== undefined
        ? { dispositivo_id: borrador.dispositivo_id }
        : {}),
      created_at: new Date().toISOString(),
    };
    state.operarios.set(id, op);
    return op;
  };

  const operarioRepo = {
    async inicializar(): Promise<void> {
      // noop en in-memory — no hay schema que crear.
    },
    async listar(): Promise<Operario[]> {
      return Array.from(state.operarios.values());
    },
    async listarPorPrestador(idPrestador: number): Promise<Operario[]> {
      return Array.from(state.operarios.values()).filter(
        (op) => op.id_prestador === idPrestador,
      );
    },
    async buscarPorId(id: number): Promise<Operario | null> {
      return state.operarios.get(id) ?? null;
    },
    async buscarPorCedula(cedula: string): Promise<Operario | null> {
      const trim = cedula.trim();
      for (const op of state.operarios.values()) {
        if (op.numero_cedula === trim) return op;
      }
      return null;
    },
    async buscarPorDispositivoId(id: string): Promise<Operario | null> {
      for (const op of state.operarios.values()) {
        if (op.dispositivo_id === id) return op;
      }
      return null;
    },
    async buscarPorDispositivo(
      dispositivoId: string,
      idPrestador: number,
    ): Promise<Operario | null> {
      for (const op of state.operarios.values()) {
        if (op.dispositivo_id === dispositivoId && op.id_prestador === idPrestador) return op;
      }
      return null;
    },
    async crear(borrador: OperarioBorrador): Promise<Operario> {
      return crearOperarioEnMemoria(borrador);
    },
    async guardar(operario: OperarioMobile): Promise<void> {
      state.operarios.set(operario.id_operario, {
        ...operario,
        rol: operario.rol as Operario['rol'],
        estado: operario.estado as Operario['estado'],
        created_at: operario.created_at ?? new Date().toISOString(),
      });
    },
    async actualizar(id: number, cambios: ActualizarOperarioInput): Promise<Operario> {
      const op = state.operarios.get(id);
      if (!op) throw new Error(`Operario id=${id} no existe`);
      const actualizado: Operario = {
        ...op,
        ...(cambios.estado !== undefined && { estado: cambios.estado }),
        ...(cambios.rol !== undefined && { rol: cambios.rol }),
        ...(cambios.dispositivo_id !== undefined && { dispositivo_id: cambios.dispositivo_id }),
        ...(cambios.password_hash !== undefined && { password_hash: cambios.password_hash }),
        ...(cambios.id_prestador !== undefined && { id_prestador: cambios.id_prestador }),
      };
      state.operarios.set(id, actualizado);
      return actualizado;
    },
    /**
     * Elimina un operario por id. Usado por `bootstrapCompleto` en su
     * rollback: si la creacion del operario falla, hace rollback del
     * prestador + acuerdo + parametros. El repo expo-sqlite real
     * solo expone `eliminarPorCedula`, pero `bootstrapCompleto` define
     * su propio port con `eliminar(id)` — esta fixture satisface
     * ambos.
     */
    async eliminar(id_operario: number): Promise<void> {
      state.operarios.delete(id_operario);
    },
    /**
     * Elimina un operario por cedula. Idempotente: si la cedula no
     * matchea, no-op (igual que el repo expo-sqlite). El Map `operarios`
     * mantiene `numero_cedula` UNIQUE por convención, asi que en la
     * practica remueve a lo sumo 1 entrada.
     */
    async eliminarPorCedula(cedula: string): Promise<void> {
      for (const [id, op] of state.operarios.entries()) {
        if (op.numero_cedula === cedula) {
          state.operarios.delete(id);
          return;
        }
      }
    },
  };

  return {
    state,
    prestadorRepo,
    acuerdoRepo,
    parametrosRepo,
    operarioRepo,
    hasher: buildHasher(),
    idGenerator: buildIdGenerator(),
  };
}

/**
 * Credenciales seed para los flujos que asumen "ya hay bootstrap previo".
 * El hash corresponde a `password = 'mi-clave'` con el hasher determinista
 * (formato `sha256(<input>)`) usado por `buildE2EFixture().hasher`.
 */
export function buildSesionVigente(overrides: {
  idPrestador?: number;
  idOperario?: number;
  cedula?: string;
  expiresAt?: number;
  token?: string;
  nombre?: string;
} = {}) {
  return {
    token: overrides.token ?? 'tok-' + 'a'.repeat(32),
    cedula: overrides.cedula ?? '51800012',
    nombre: overrides.nombre ?? 'Ana López',
    idOperario: overrides.idOperario ?? 1, // auditoria legal (CRA 825/2017)
    idPrestador: overrides.idPrestador ?? 7,
    expiresAt: overrides.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
  };
}

/**
 * Input valido minimo para `bootstrapCompleto()` — datos que pasan todas
 * las validaciones de dominio de `crearPrestador` y `crearOperario`.
 * Cedula y password deterministas para que el SHA-256 sea conocido:
 *   `password_hash` esperado = `'sha256(mi-clave)'`.
 */
export function buildBootstrapInputValido(): {
  prestadorData: Omit<import('../../../dominio/prestadores/types').CrearPrestadorInput, 'codigo'>;
  operarioData: {
    numero_cedula: string;
    nombre: string;
    email: string;
    password: string;
  };
} {
  // El cast a `unknown` y luego al tipo del dominio es necesario porque
  // `email` y `telefono` no forman parte de `CrearPrestadorInput` (son
  // opcionales via "additional properties" en el módulo prestadores).
  // El cast sigue el mismo patrón que `bootstrap-completo.test.ts`.
  const prestadorData = {
    nombre: 'Asociación de Usuarios del Acueducto Vereda La Esperanza',
    nit: '900123456-7',
    representante_legal: 'Juan Pérez',
    representante_legal_cedula: '12345678',
    municipio: 'Caqueza',
    departamento: 'Cundinamarca',
    segmento: 2,
    num_suscriptores_urbanos: 0,
    num_suscriptores_rurales: 150,
    email: undefined,
    telefono: undefined,
  } as unknown as Omit<import('../../../dominio/prestadores/types').CrearPrestadorInput, 'codigo'>;

  return {
    prestadorData,
    operarioData: {
      numero_cedula: '12345678',
      nombre: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'mi-clave',
    },
  };
}
