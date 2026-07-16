// mobile/__tests__/composicion/login-local.test.ts
//
// Tests contractuales del helper puro `loginLocal()` introducido en
// el PUNTO A del SDD setup-inicial-multi-tenant-auth.
//
// QUE HACE:
//   Valida localmente la cedula + password contra la DB SQLite del
//   dispositivo. Devuelve una Sesion multi-tenant (con idPrestador REAL
//   del operario) si pasa la validacion, o lanza un Error tipado si
//   falla (OPERARIO_NO_ENCONTRADO | PASSWORD_INCORRECTA).
//
// DISENO:
//   Funcion PURA (sin I/O real, sin Alert, sin AsyncStorage). Recibe
//   sus dependencias via inyeccion (operarioRepo + hasher). Esto
//   permite testearla con stubs en memoria sin tocar expo-sqlite.
//
//   El wrapper de UI (Login.tsx) es quien:
//     1. Llama a `getBootstrap()` para resolver las deps.
//     2. Llama a `loginLocal(deps)`.
//     3. Mapea los throws a Alert.alert y traduce errores a mensajes
//        user-friendly.
//
// DECISIONES:
//   - Token: 'fake-token-' + Date.now() (placeholder hasta backend real).
//   - expiresAt: Date.now() + 24h. Sigue el mismo contrato que
//     bootstrapCompleto (Fase 5.1) para que el mismo loader de sesion
//     funcione post-setup y post-login.
//   - cedula en sesion: numero_cedula del operario (trimmed por el repo).
//   - idPrestador en sesion: operario.id_prestador (NUNCA hardcoded a 1).
//
// TDD Evidence:
//   RED  → estos tests son la primera implementacion del helper.
//          Antes de este commit, el archivo `composition/login-local.ts`
//          no existe. Los 8 tests fallan al importar el modulo.
//   GREEN → el helper se implementa y los 8 tests pasan.

import { loginLocal } from '../../src/composition/login-local';
import type { OperarioRepositoryExpoSqlite } from '../../src/persistencia/expo-sqlite/operario-repository-expo-sqlite';
import type { Operario } from '../../src/operarios/types';
import type { Hasher } from '../../dominio/shared/ports';
import type { Sesion } from '../../src/composition/constantes';

// ── Stubs deterministas ──────────────────────────────────────────────────────

/** Hasher determinista: sha256(x) → 'sha256(x)'. Spy para que los tests
 *  puedan asserir que se llamo con el input correcto. */
function buildHasher(): Hasher {
  const sha256 = jest.fn((input: string) => `sha256(${input})`);
  return { sha256 };
}

interface FakeOperarioRepo {
  buscarPorCedula: jest.Mock<Promise<Operario | null>, [string]>;
}

function buildRepo(operario: Operario | null): FakeOperarioRepo {
  return {
    buscarPorCedula: jest.fn().mockResolvedValue(operario),
  };
}

/** Operario de prueba: cedula 51800012, prestador 7, hash 'sha256(mi-clave)'. */
function buildOperarioValido(): Operario {
  return {
    id_operario: 42,
    id_prestador: 7,
    numero_cedula: '51800012',
    nombre: 'Ana Lopez',
    email: 'ana@test.com',
    password_hash: 'sha256(mi-clave)',
    rol: 'operario',
    estado: 'activo',
    created_at: '2024-01-15T00:00:00Z',
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loginLocal() — helper puro de validacion offline', () => {
  // ── Buscar por cedula ────────────────────────────────────────────────────

  describe('busqueda de operario por cedula', () => {
    it('LL1.1 lanza Error OPERARIO_NO_ENCONTRADO cuando la cedula no existe', async () => {
      const repo = buildRepo(null);
      const hasher = buildHasher();

      await expect(
        loginLocal({
          operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
          hasher,
          cedula: '00000000',
          password: 'mi-clave',
        }),
      ).rejects.toThrow('OPERARIO_NO_ENCONTRADO');

      // Verificamos que efectivamente se intento buscar la cedula
      expect(repo.buscarPorCedula).toHaveBeenCalledWith('00000000');
    });

    it('LL1.2 trim() la cedula antes de buscar (no es sensible a espacios)', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '  51800012  ',
        password: 'mi-clave',
      });

      // Login.tsx ya hace cedula.trim() ANTES de invocar el helper, pero el
      // helper defensivamente tambien lo aplica. Doble defensa = OK.
      expect(repo.buscarPorCedula).toHaveBeenCalledWith('51800012');
    });
  });

  // ── Validacion de password ──────────────────────────────────────────────

  describe('validacion de password contra hash persistido', () => {
    it('LL2.1 lanza Error PASSWORD_INCORRECTA si el hash no coincide', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      await expect(
        loginLocal({
          operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
          hasher,
          cedula: '51800012',
          password: 'clave-equivocada',
        }),
      ).rejects.toThrow('PASSWORD_INCORRECTA');

      // El hasher DEBE haber sido invocado con la password ingresada,
      // aunque sea incorrecta (es como sabemos que comparar fue honesto).
      expect(hasher.sha256).toHaveBeenCalledWith('clave-equivocada');
    });

    it('LL2.2 hashea la password con SHA-256 antes de comparar (no compara plain)', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      // Si el helper comparara plain, operario.password_hash seria 'mi-clave'
      // (no lo es — es 'sha256(mi-clave)') y login fallaria. Este test
      // verifica que hasher.sha256('mi-clave') === operario.password_hash.
      expect(hasher.sha256).toHaveBeenCalledWith('mi-clave');
      expect(hasher.sha256).toHaveReturnedWith('sha256(mi-clave)');
    });
  });

  // ── Happy path: sesion con idPrestador REAL ─────────────────────────────

  describe('happy path: retorna Sesion con idPrestador del operario', () => {
    it('LL3.1 retorna sesion con idPrestador = operario.id_prestador (NO hardcoded a 1)', async () => {
      const operario = buildOperarioValido(); // id_prestador = 7
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      // Multi-tenant critico: el idPrestador viene del operario, no es 1.
      expect(resultado.sesion.idPrestador).toBe(7);
      expect(resultado.sesion.idPrestador).not.toBe(1);
    });

    it('LL3.2 sesion.cedula = operario.numero_cedula', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      expect(resultado.sesion.cedula).toBe('51800012');
    });

    it('LL3.3 sesion.nombre = operario.nombre', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      expect(resultado.sesion.nombre).toBe('Ana Lopez');
    });

    it('LL3.4 sesion.token tiene formato fake-token-{timestamp}', async () => {
      const antesDe = Date.now();
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      expect(resultado.sesion.token).toMatch(/^fake-token-\d+$/);
      const timestampDelToken = Number.parseInt(
        resultado.sesion.token.replace('fake-token-', ''),
        10,
      );
      // Holgura de 1000ms — el helper puede correr entre antesDe y Date.now().
      expect(timestampDelToken).toBeGreaterThanOrEqual(antesDe - 1000);
      expect(timestampDelToken).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('LL3.5 sesion.expiresAt = now + 24h (±5 segundos)', async () => {
      const antesDe = Date.now();
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      const veinticuatroHoras = 24 * 60 * 60 * 1000;
      expect(resultado.sesion.expiresAt).toBeGreaterThanOrEqual(
        antesDe + veinticuatroHoras - 1000,
      );
      expect(resultado.sesion.expiresAt).toBeLessThanOrEqual(
        antesDe + veinticuatroHoras + 1000,
      );
    });

    it('LL3.6 el resultado expone tanto sesion como operario (para que la UI pueda mostrar info)', async () => {
      const operario = buildOperarioValido();
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      // Triangulacion: la UI consume sesion + operario para feedback
      // ("Bienvenido Ana Lopez") sin un fetch extra.
      expect(resultado.operario).toBe(operario);
      const sesionTipada = resultado.sesion as Sesion;
      expect(sesionTipada.idPrestador).toBe(operario.id_prestador);
      expect(sesionTipada.cedula).toBe(operario.numero_cedula);
    });

    // ── LL3.7 — idOperario en sesion (CRA 825/2017, auditoría legal) ──
    //
    // El reporte de calidad COR-04 detecto que CapturarLectura usaba
    // id_operario hardcoded a 1 porque la Sesion no cargaba el id
    // del operario real. Este test fija el contrato: loginLocal DEBE
    // propagar operario.id_operario al campo sesion.idOperario para
    // que la pantalla pueda atribuir legalmente cada lectura.
    it('LL3.7 sesion.idOperario = operario.id_operario (NO hardcoded, NO ausente)', async () => {
      const operario = buildOperarioValido(); // id_operario = 42
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      expect(resultado.sesion.idOperario).toBe(42);
      expect(resultado.sesion.idOperario).toBe(operario.id_operario);
      // No es 1 hardcoded como antes del fix
      expect(resultado.sesion.idOperario).not.toBe(1);
    });

    it('LL3.8 sesion.idOperario refleja el id_operario del operario autenticado (otro operario)', async () => {
      // Triangulacion: NO todo operario tiene id 42. Verificamos que la
      // propagacion funciona con cualquier id real (audit-friendly).
      const operario: Operario = {
        ...buildOperarioValido(),
        id_operario: 7777,
      };
      const repo = buildRepo(operario);
      const hasher = buildHasher();

      const resultado = await loginLocal({
        operarioRepo: repo as unknown as OperarioRepositoryExpoSqlite,
        hasher,
        cedula: '51800012',
        password: 'mi-clave',
      });

      expect(resultado.sesion.idOperario).toBe(7777);
      expect(resultado.sesion.idOperario).not.toBe(42);
    });
  });
});