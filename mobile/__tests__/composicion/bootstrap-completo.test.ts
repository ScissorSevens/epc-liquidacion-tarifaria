// mobile/__tests__/composicion/bootstrap-completo.test.ts
//
// Tests contractuales del helper `bootstrapCompleto()` introducido en
// la Fase 5 Tarea 5.1 del SDD setup-inicial-multi-tenant-auth.
//
// QUE HACE:
//   Crea atómicamente las 4 entidades que un operario necesita para
//   arrancar un tenant nuevo en la DB local:
//     1. Prestador (con codigo auto-generado correlativo)
//     2. Acuerdo Municipal vigente (con topes default L142/1994)
//     3. Parametros Tarifa vigentes (con costos medios CRA 825/2017)
//     4. Operario vinculado al prestador (con password hasheado)
//
//   Devuelve { prestador, acuerdo, parametros, operario, sesion } para
//   que la UI arme la sesion multi-tenant.
//
// COMPORTAMIENTO BAJO PRUEBA:
//   - Codigo del prestador se genera correlativo a partir de los
//     codigos existentes (max + 1, padding 4 digitos). Filtra el
//     codigo legacy 'EPC-LEGACY' que la migration 009 inserta.
//   - Operario se vincula al prestador creado (id_prestador consistente).
//   - Password se hashea via Hasher (no se guarda en claro).
//   - Sesion devuelta tiene idPrestador = prestador.id_prestador y
//     expiresAt = ~now + 24h.
//   - Si la creacion del Acuerdo falla, NO se queda el prestador huerfano
//     (rollback manual: borra el prestador creado).
//   - Si la creacion de Parametros falla, NO se queda el acuerdo huerfano
//     (rollback manual: borra prestador + acuerdo).
//   - Si la creacion del Operario falla, NO se queda parametros huerfano
//     (rollback manual: borra prestador + acuerdo + parametros).
//
// MOCKS:
//   - Repos in-memory: implementamos los 4 puertos con Maps/set para
//     emular el comportamiento de expo-sqlite sin tocar el nativo.
//   - Hasher: stub deterministico (no js-sha256 real, asi no dependemos
//     de import de runtime en el test).
//   - IdGenerator: stub que devuelve un id correlativo por invocacion.
//
// TDD Evidence:
//   RED  → estos tests son la primera implementacion del helper.
//          Antes de este commit, el archivo `bootstrap-completo.ts`
//          no existe. Los 11 tests fallan al importar el modulo.
//   GREEN → el helper se implementa y los 11 tests pasan.

import { bootstrapCompleto, type BootstrapCompletoInput } from '../../src/composition/bootstrap-completo';
import type { Prestador, CrearPrestadorInput } from '../../dominio/prestadores/types';
import type { AcuerdoMunicipal, CrearAcuerdoMunicipalInput } from '../../dominio/acuerdo-municipal/types';
import type { ParametrosTarifa, CrearParametrosTarifaInput } from '../../dominio/parametros-tarifa/types';
import type { Operario, OperarioBorrador } from '../../dominio/operarios/types';
import type { Hasher, IdGenerator } from '../../dominio/shared/ports';

// ── In-memory repos ──────────────────────────────────────────────────────────

interface RepoState {
  prestadores: Map<number, Prestador>;
  acuerdos: Map<number, AcuerdoMunicipal>;
  parametros: Map<number, ParametrosTarifa>;
  operarios: Map<number, Operario>;
  prestadorIdSeq: number;
  acuerdoIdSeq: number;
  parametrosIdSeq: number;
  operarioIdSeq: number;
}

function buildRepoState(): RepoState {
  return {
    prestadores: new Map(),
    acuerdos: new Map(),
    parametros: new Map(),
    operarios: new Map(),
    prestadorIdSeq: 1,
    acuerdoIdSeq: 1,
    parametrosIdSeq: 1,
    operarioIdSeq: 1,
  };
}

function restaurarMap<K, V>(destino: Map<K, V>, snapshot: Map<K, V>): void {
  destino.clear();
  snapshot.forEach((valor, clave) => destino.set(clave, valor));
}

function buildRepos(state: RepoState) {
  return {
    prestadorRepo: {
      withTransactionAsync: jest.fn(async (task: () => Promise<void>): Promise<void> => {
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
          restaurarMap(state.prestadores, snapshot.prestadores);
          restaurarMap(state.acuerdos, snapshot.acuerdos);
          restaurarMap(state.parametros, snapshot.parametros);
          restaurarMap(state.operarios, snapshot.operarios);
          state.prestadorIdSeq = snapshot.prestadorIdSeq;
          state.acuerdoIdSeq = snapshot.acuerdoIdSeq;
          state.parametrosIdSeq = snapshot.parametrosIdSeq;
          state.operarioIdSeq = snapshot.operarioIdSeq;
          throw error;
        }
      }),
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
      eliminar: jest.fn(async (id_prestador: number): Promise<void> => {
        state.prestadores.delete(id_prestador);
      }),
    },
    acuerdoRepo: {
      async crear(data: CrearAcuerdoMunicipalInput): Promise<AcuerdoMunicipal> {
        const id = state.acuerdoIdSeq++;
        const a: AcuerdoMunicipal = {
          id_acuerdo: id,
          id_prestador: data.id_prestador,
          factor_subsidio_e1: data.factor_subsidio_e1,
          factor_subsidio_e2: data.factor_subsidio_e2,
          factor_subsidio_e3: data.factor_subsidio_e3,
          factor_contribucion_e5: data.factor_contribucion_e5,
          factor_contribucion_e6: data.factor_contribucion_e6,
          factor_contribucion_comercial: data.factor_contribucion_comercial,
          factor_contribucion_industrial: data.factor_contribucion_industrial,
          fecha_vigencia_desde: data.fecha_vigencia_desde,
          fecha_vigencia_hasta: data.fecha_vigencia_hasta,
          acto_administrativo_url: data.acto_administrativo_url,
          observaciones: data.observaciones,
          created_at: new Date().toISOString(),
        };
        state.acuerdos.set(id, a);
        return a;
      },
      eliminar: jest.fn(async (id_acuerdo: number): Promise<void> => {
        state.acuerdos.delete(id_acuerdo);
      }),
    },
    parametrosRepo: {
      async crear(data: CrearParametrosTarifaInput): Promise<ParametrosTarifa> {
        const id = state.parametrosIdSeq++;
        const p: ParametrosTarifa = {
          id_parametros: id,
          id_prestador: data.id_prestador,
          id_acuerdo: data.id_acuerdo,
          periodo: data.periodo,
          cma: data.cma,
          cmo: data.cmo,
          cmi: data.cmi,
          cmt: data.cmt,
          cmviaa: data.cmviaa,
          aplica_cmviaa: data.aplica_cmviaa,
          agua_suministrada_m3_anio: data.agua_suministrada_m3_anio,
          ipuf_m3_suscriptor_mes: data.ipuf_m3_suscriptor_mes,
          suscriptores_promedio: data.suscriptores_promedio,
          aplica_minimo_vital: data.aplica_minimo_vital,
          m3_gratis_minimo_vital: data.m3_gratis_minimo_vital,
          vigente_desde: data.vigente_desde,
          vigente_hasta: data.vigente_hasta,
          created_at: new Date().toISOString(),
        };
        state.parametros.set(id, p);
        return p;
      },
      eliminar: jest.fn(async (id_parametros: number): Promise<void> => {
        state.parametros.delete(id_parametros);
      }),
    },
    operarioRepo: {
      async crear(borrador: OperarioBorrador): Promise<Operario> {
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
          dispositivo_id: borrador.dispositivo_id,
          created_at: new Date().toISOString(),
        };
        state.operarios.set(id, op);
        return op;
      },
      eliminar: jest.fn(async (id_operario: number): Promise<void> => {
        state.operarios.delete(id_operario);
      }),
    },
  };
}

function buildHasher(): Hasher {
  return { sha256: (input: string) => `sha256(${input})` };
}

function buildIdGenerator(): IdGenerator {
  let counter = 0;
  return { uuid: () => `uuid-${++counter}` };
}

// ── helpers ─────────────────────────────────────────────────────────────────

const INPUT_VALIDO_PRESTADOR: Omit<CrearPrestadorInput, 'codigo'> = {
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
} as unknown as Omit<CrearPrestadorInput, 'codigo'>;

const INPUT_VALIDO_OPERARIO: BootstrapCompletoInput['operarioData'] = {
  numero_cedula: '12345678',
  nombre: 'Juan Pérez',
  email: 'juan@example.com',
  password: 'mi-password-secreto',
};

function buildInputValido(): BootstrapCompletoInput {
  return {
    prestadorData: INPUT_VALIDO_PRESTADOR,
    operarioData: INPUT_VALIDO_OPERARIO,
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('bootstrapCompleto()', () => {
  let state: RepoState;
  let deps: ReturnType<typeof buildRepos> & { hasher: Hasher; idGenerator: IdGenerator };

  beforeEach(() => {
    state = buildRepoState();
    const repos = buildRepos(state);
    deps = {
      ...repos,
      hasher: buildHasher(),
      idGenerator: buildIdGenerator(),
    };
  });

  // ── happy path ──────────────────────────────────────────────────────────
  describe('happy path', () => {
    it('BC1.1 crea el prestador con codigo correlativo 0001 cuando la DB esta vacia', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.prestador.codigo).toBe('0001');
    });

    it('BC1.2 crea el prestador con codigo correlativo siguiente si ya hay prestadores', async () => {
      // Sembramos 2 prestadores con codigos numericos ya usados.
      await deps.prestadorRepo.crear({
        ...INPUT_VALIDO_PRESTADOR,
        codigo: '0001',
      });
      await deps.prestadorRepo.crear({
        ...INPUT_VALIDO_PRESTADOR,
        codigo: '0002',
      });

      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.prestador.codigo).toBe('0003');
    });

    it('BC1.3 ignora el codigo legacy "EPC-LEGACY" al calcular el siguiente correlativo', async () => {
      // La migration 009 inserta un prestador con codigo 'EPC-LEGACY'.
      // El siguiente codigo numerico debe ser 0001, no caer en NaN.
      await deps.prestadorRepo.crear({
        ...INPUT_VALIDO_PRESTADOR,
        codigo: 'EPC-LEGACY',
      });

      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.prestador.codigo).toBe('0001');
    });

    it('BC1.4 crea acuerdo municipal con factores default alineados a L142/1994', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.acuerdo.id_prestador).toBe(resultado.prestador.id_prestador);
      // Topes por defecto rurales: subsidios negativos y contribuciones positivas
      // dentro de los rangos legales L142/1994 art. 99.6.
      expect(resultado.acuerdo.factor_subsidio_e1).toBeLessThan(0);
      expect(resultado.acuerdo.factor_subsidio_e2).toBeLessThan(0);
      expect(resultado.acuerdo.factor_subsidio_e3).toBeLessThan(0);
      expect(resultado.acuerdo.factor_contribucion_e5).toBeGreaterThan(0);
      expect(resultado.acuerdo.factor_contribucion_e6).toBeGreaterThan(0);
    });

    it('BC1.5 crea parametros tarifa vinculados al acuerdo', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.parametros.id_prestador).toBe(resultado.prestador.id_prestador);
      expect(resultado.parametros.id_acuerdo).toBe(resultado.acuerdo.id_acuerdo);
    });

    it('BC1.6 crea operario vinculado al prestador con password hasheado', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(resultado.operario.id_prestador).toBe(resultado.prestador.id_prestador);
      expect(resultado.operario.numero_cedula).toBe('12345678');
      // El password NO se guarda en claro: el hasher lo transforma.
      expect(resultado.operario.password_hash).toBe('sha256(mi-password-secreto)');
      expect(resultado.operario.password_hash).not.toBe('mi-password-secreto');
    });

    it('T-EMAIL-1 crea el operario cuando email es un string vacío', async () => {
      const input = buildInputValido();
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: {
          ...input,
          operarioData: { ...input.operarioData, email: '' },
        },
      });

      expect(resultado.operario.email).toBe('');
      expect(Array.from(state.operarios.values())).toEqual([resultado.operario]);
    });

    it('T-EMAIL-2 crea el operario con email vacío cuando no se provee email', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: {
          prestadorData: INPUT_VALIDO_PRESTADOR,
          operarioData: {
            numero_cedula: '12345678',
            nombre: 'Juan Pérez',
            password: 'mi-password-secreto',
          },
        },
      });

      expect(resultado.operario.email).toBe('');
      expect(Array.from(state.operarios.values())).toEqual([resultado.operario]);
    });

    it('BC1.7 construye sesion con idPrestador del prestador y expiresAt ~24h', async () => {
      const antesDe = Date.now();
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      const veinticuatroHoras = 24 * 60 * 60 * 1000;
      expect(resultado.sesion.idPrestador).toBe(resultado.prestador.id_prestador);
      expect(resultado.sesion.cedula).toBe('12345678');
      expect(resultado.sesion.nombre).toBe('Juan Pérez');
      expect(resultado.sesion.expiresAt).toBeGreaterThanOrEqual(antesDe + veinticuatroHoras - 1000);
      expect(resultado.sesion.expiresAt).toBeLessThanOrEqual(antesDe + veinticuatroHoras + 1000);
      // El token es un string no vacio (placeholder hasta backend real)
      expect(resultado.sesion.token).toMatch(/^fake-token-/);
    });

    // ── BC1.8 — idOperario en sesion (CRA 825/2017, auditoría legal) ──
    //
    // El reporte de calidad COR-04 detecto que CapturarLectura usaba
    // id_operario hardcoded a 1. bootstrapCompleto es el otro lugar
    // donde la Sesion se construye — DEBE llevar el id_operario del
    // operario recien creado para que SetupInicial arranque con
    // trazabilidad legal desde el primer login.
    it('BC1.8 sesion.idOperario = operario.id_operario del operario creado (no ausente)', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      // El in-memory repo asigna correlativo 1 al primer operario (state.seq = 1).
      expect(resultado.sesion.idOperario).toBe(resultado.operario.id_operario);
      expect(resultado.sesion.idOperario).toBeGreaterThan(0);
      // Triangulacion: NO es 0 (legacy) ni 1 (hardcoded accidental).
      // Aqui el correlativo es 1 por el seed del fixture, pero si cambia
      // el seed, el campo sigue siendo el id REAL del operario creado.
      expect(typeof resultado.sesion.idOperario).toBe('number');
      expect(Number.isInteger(resultado.sesion.idOperario)).toBe(true);
    });
  });

  describe('transaccion SQLite', () => {
    it('T-TX-1 crea prestador, acuerdo, parametros y operario en una sola transaccion', async () => {
      const resultado = await bootstrapCompleto({
        prestadorRepo: deps.prestadorRepo,
        acuerdoRepo: deps.acuerdoRepo,
        parametrosRepo: deps.parametrosRepo,
        operarioRepo: deps.operarioRepo,
        hasher: deps.hasher,
        idGenerator: deps.idGenerator,
        input: buildInputValido(),
      });

      expect(deps.prestadorRepo.withTransactionAsync).toHaveBeenCalledTimes(1);
      expect(Array.from(state.prestadores.values())).toEqual([resultado.prestador]);
      expect(Array.from(state.acuerdos.values())).toEqual([resultado.acuerdo]);
      expect(Array.from(state.parametros.values())).toEqual([resultado.parametros]);
      expect(Array.from(state.operarios.values())).toEqual([resultado.operario]);
    });

    it('T-TX-2 si crear acuerdo falla, SQLite revierte el prestador sin rollback manual', async () => {
      const errorAcuerdo = new Error('acuerdo write failed');
      const acuerdoRepoRoto = {
        ...deps.acuerdoRepo,
        crear: jest.fn().mockRejectedValue(errorAcuerdo),
      };
      deps.prestadorRepo.eliminar.mockRejectedValue(new Error('rollback manual no disponible'));

      await expect(
        bootstrapCompleto({
          prestadorRepo: deps.prestadorRepo,
          acuerdoRepo: acuerdoRepoRoto,
          parametrosRepo: deps.parametrosRepo,
          operarioRepo: deps.operarioRepo,
          hasher: deps.hasher,
          idGenerator: deps.idGenerator,
          input: buildInputValido(),
        }),
      ).rejects.toBe(errorAcuerdo);

      expect(state.prestadores.size).toBe(0);
      expect(deps.prestadorRepo.eliminar).not.toHaveBeenCalled();
    });

    it('T-TX-3 si crear operario falla, SQLite revierte las cuatro entidades', async () => {
      const errorOperario = new Error('operario write failed');
      const operarioRepoRoto = {
        ...deps.operarioRepo,
        crear: jest.fn().mockRejectedValue(errorOperario),
      };
      deps.parametrosRepo.eliminar.mockRejectedValue(new Error('rollback manual parametros'));
      deps.acuerdoRepo.eliminar.mockRejectedValue(new Error('rollback manual acuerdo'));
      deps.prestadorRepo.eliminar.mockRejectedValue(new Error('rollback manual prestador'));

      await expect(
        bootstrapCompleto({
          prestadorRepo: deps.prestadorRepo,
          acuerdoRepo: deps.acuerdoRepo,
          parametrosRepo: deps.parametrosRepo,
          operarioRepo: operarioRepoRoto,
          hasher: deps.hasher,
          idGenerator: deps.idGenerator,
          input: buildInputValido(),
        }),
      ).rejects.toBe(errorOperario);

      expect(state.prestadores.size).toBe(0);
      expect(state.acuerdos.size).toBe(0);
      expect(state.parametros.size).toBe(0);
      expect(state.operarios.size).toBe(0);
      expect(deps.parametrosRepo.eliminar).not.toHaveBeenCalled();
      expect(deps.acuerdoRepo.eliminar).not.toHaveBeenCalled();
      expect(deps.prestadorRepo.eliminar).not.toHaveBeenCalled();
    });
  });

  // ── rollback ante fallas ────────────────────────────────────────────────
  describe('rollback ante fallas', () => {
    it('BC2.1 si crear acuerdo falla, NO persiste el prestador (rollback)', async () => {
      const acuerdoRepoRoto = {
        crear: jest.fn().mockRejectedValue(new Error('SQLITE FULL')),
      };

      await expect(
        bootstrapCompleto({
          prestadorRepo: deps.prestadorRepo,
          acuerdoRepo: acuerdoRepoRoto as never,
          parametrosRepo: deps.parametrosRepo,
          operarioRepo: deps.operarioRepo,
          hasher: deps.hasher,
          idGenerator: deps.idGenerator,
          input: buildInputValido(),
        }),
      ).rejects.toThrow('SQLITE FULL');

      // El prestador NO debio haber quedado persistido
      expect(state.prestadores.size).toBe(0);
    });

    it('BC2.2 si crear parametros falla, NO persiste prestador ni acuerdo', async () => {
      const parametrosRepoRoto = {
        crear: jest.fn().mockRejectedValue(new Error('disk error')),
      };

      await expect(
        bootstrapCompleto({
          prestadorRepo: deps.prestadorRepo,
          acuerdoRepo: deps.acuerdoRepo,
          parametrosRepo: parametrosRepoRoto as never,
          operarioRepo: deps.operarioRepo,
          hasher: deps.hasher,
          idGenerator: deps.idGenerator,
          input: buildInputValido(),
        }),
      ).rejects.toThrow('disk error');

      expect(state.prestadores.size).toBe(0);
      expect(state.acuerdos.size).toBe(0);
    });

    it('BC2.3 si crear operario falla, NO persiste prestador/acuerdo/parametros', async () => {
      const operarioRepoRoto = {
        crear: jest.fn().mockRejectedValue(new Error('operario write failed')),
      };

      await expect(
        bootstrapCompleto({
          prestadorRepo: deps.prestadorRepo,
          acuerdoRepo: deps.acuerdoRepo,
          parametrosRepo: deps.parametrosRepo,
          operarioRepo: operarioRepoRoto as never,
          hasher: deps.hasher,
          idGenerator: deps.idGenerator,
          input: buildInputValido(),
        }),
      ).rejects.toThrow('operario write failed');

      expect(state.prestadores.size).toBe(0);
      expect(state.acuerdos.size).toBe(0);
      expect(state.parametros.size).toBe(0);
    });
  });
});
