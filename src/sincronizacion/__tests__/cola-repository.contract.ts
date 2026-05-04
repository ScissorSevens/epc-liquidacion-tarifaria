/**
 * Contract test reusable para `ColaSincronizacion`.
 *
 * Mismo patron que `factura-repository-contract.ts` y
 * `lectura-repository-contract.ts`: la SUITE del puerto se vuelve
 * adapter-agnostic. El in-memory y el SQLite se validan con la misma
 * bateria invocando `runColaSincronizacionContract(nombre, factory, cleanup?)`.
 *
 * Origen del contenido: approval del comportamiento ya verificado por
 * `cola-repository.test.ts` (in-memory) PLUS triangulaciones para los
 * campos opcionales que el adapter SQLite tiene que aplanar/reconstruir
 * (hashServer, ultimoError, ultimoIntentoEn, dependeDe, forzarSobrescribir,
 * payload arbitrario).
 *
 * cleanupRepo opcional: adapters con I/O liberan recursos en afterEach
 * (ej. `db.close()` para SQLite). El in-memory no necesita nada.
 *
 * Cobertura del contract:
 *  1. listar de repo vacio → []
 *  2. guardar + listar (round-trip basico)
 *  3. listarPendientes filtra por estado='PENDIENTE'
 *  4. guardar es upsert por id (sobrescribe, no duplica)
 *  5. buscarPorId happy path
 *  6. buscarPorId retorna null si no existe
 *  7. round-trip de campos opcionales: hashServer, ultimoError,
 *     ultimoIntentoEn, dependeDe, forzarSobrescribir
 *  8. round-trip de payload arbitrario (objetos anidados, arrays, primitivos)
 *  9. preservacion de tipos: creadoEn / ultimoIntentoEn vuelven como Date
 */

import { agregarItemACola } from '../cola';
import type { ColaSincronizacion } from '../cola-repository';
import type { ItemCola } from '../types';

// ---------- Builders compartidos ----------

export function itemBase(overrides: Partial<ItemCola> = {}): ItemCola {
  // agregarItemACola produce el item canonico con id UUID y estado PENDIENTE.
  // Se permite sobre-escribir cualquier campo para testear variantes.
  const base = agregarItemACola({
    tipo: 'LIQUIDACION',
    payload: { id: 'LIQ-001' },
    hashLocal: 'h-base',
  });
  return Object.freeze({ ...base, ...overrides });
}

// ---------- Harness ----------

export function runColaSincronizacionContract(
  nombre: string,
  crearRepo: () => ColaSincronizacion,
  cleanupRepo?: (repo: ColaSincronizacion) => void | Promise<void>,
): void {
  let repo: ColaSincronizacion;

  beforeEach(() => {
    repo = crearRepo();
  });

  afterEach(async () => {
    if (cleanupRepo) await cleanupRepo(repo);
  });

  describe(`${nombre} — vacio`, () => {
    it('listar() en repo recien creado retorna []', async () => {
      const items = await repo.listar();
      expect(items).toEqual([]);
    });

    it('listarPendientes() en repo recien creado retorna []', async () => {
      const items = await repo.listarPendientes();
      expect(items).toEqual([]);
    });

    it('buscarPorId() retorna null si el repo esta vacio', async () => {
      const r = await repo.buscarPorId('no-existe');
      expect(r).toBeNull();
    });
  });

  describe(`${nombre} — guardar + listar`, () => {
    it('guarda un item y listar() lo recupera con todos los campos', async () => {
      const item = itemBase();

      await repo.guardar(item);
      const items = await repo.listar();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(item.id);
      expect(items[0].tipo).toBe('LIQUIDACION');
      expect(items[0].hashLocal).toBe('h-base');
      expect(items[0].estado).toBe('PENDIENTE');
      expect(items[0].intentos).toBe(0);
      expect(items[0].payload).toEqual({ id: 'LIQ-001' });
    });

    it('guarda multiples items distintos y los devuelve a todos', async () => {
      const a = itemBase({ id: 'a' });
      const b = itemBase({ id: 'b', tipo: 'LECTURA' });
      const c = itemBase({ id: 'c', tipo: 'EVIDENCIA' });

      await repo.guardar(a);
      await repo.guardar(b);
      await repo.guardar(c);

      const items = await repo.listar();
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe(`${nombre} — listarPendientes`, () => {
    it('retorna solo items con estado PENDIENTE', async () => {
      const pendiente = itemBase({ id: 'p1' });
      const exitoso = itemBase({ id: 'e1', estado: 'EXITOSO' });
      const fallido = itemBase({ id: 'f1', estado: 'FALLIDO', intentos: 5 });

      await repo.guardar(pendiente);
      await repo.guardar(exitoso);
      await repo.guardar(fallido);

      const pendientes = await repo.listarPendientes();
      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].id).toBe('p1');
      expect(pendientes[0].estado).toBe('PENDIENTE');
    });

    it('triangulacion: con todos los items en estado distinto a PENDIENTE devuelve []', async () => {
      await repo.guardar(itemBase({ id: 'a', estado: 'EXITOSO' }));
      await repo.guardar(itemBase({ id: 'b', estado: 'CONFLICTO' }));
      await repo.guardar(itemBase({ id: 'c', estado: 'DESCARTADO' }));

      const pendientes = await repo.listarPendientes();
      expect(pendientes).toEqual([]);
    });
  });

  describe(`${nombre} — guardar (upsert por id)`, () => {
    it('guardar dos veces el mismo id sobrescribe (NO duplica)', async () => {
      const original = itemBase({ id: 'unique', estado: 'PENDIENTE', intentos: 0 });
      await repo.guardar(original);

      const actualizado: ItemCola = {
        ...original,
        estado: 'EXITOSO',
        intentos: 3,
        ultimoError: null,
        ultimoIntentoEn: new Date('2026-04-20T10:00:00.000Z'),
      };
      await repo.guardar(actualizado);

      const items = await repo.listar();
      expect(items).toHaveLength(1);
      expect(items[0].estado).toBe('EXITOSO');
      expect(items[0].intentos).toBe(3);
      expect(items[0].ultimoIntentoEn).toEqual(new Date('2026-04-20T10:00:00.000Z'));
    });
  });

  describe(`${nombre} — buscarPorId`, () => {
    it('retorna el item si existe', async () => {
      const item = itemBase({ id: 'find-me', tipo: 'LECTURA' });
      await repo.guardar(item);

      const encontrado = await repo.buscarPorId('find-me');

      expect(encontrado).not.toBeNull();
      expect(encontrado!.id).toBe('find-me');
      expect(encontrado!.tipo).toBe('LECTURA');
    });

    it('retorna null si el id no existe', async () => {
      await repo.guardar(itemBase({ id: 'otro' }));

      const r = await repo.buscarPorId('inexistente');
      expect(r).toBeNull();
    });
  });

  describe(`${nombre} — round-trip de campos opcionales`, () => {
    it('persiste y recupera hashServer, ultimoError, ultimoIntentoEn, dependeDe, forzarSobrescribir', async () => {
      const ultimoIntento = new Date('2026-04-20T12:34:56.000Z');
      const item: ItemCola = {
        ...itemBase({ id: 'opcionales' }),
        hashServer: 'h-server-123',
        ultimoError: 'timeout despues de 30s',
        ultimoIntentoEn: ultimoIntento,
        intentos: 2,
        dependeDe: ['parent-1', 'parent-2'],
        forzarSobrescribir: true,
      };

      await repo.guardar(item);
      const recuperado = await repo.buscarPorId('opcionales');

      expect(recuperado).not.toBeNull();
      expect(recuperado!.hashServer).toBe('h-server-123');
      expect(recuperado!.ultimoError).toBe('timeout despues de 30s');
      expect(recuperado!.ultimoIntentoEn).toEqual(ultimoIntento);
      expect(recuperado!.intentos).toBe(2);
      expect(recuperado!.dependeDe).toEqual(['parent-1', 'parent-2']);
      expect(recuperado!.forzarSobrescribir).toBe(true);
    });

    it('triangulacion: campos opcionales ausentes vuelven como undefined o null segun el tipo', async () => {
      // itemBase NO setea hashServer ni dependeDe ni forzarSobrescribir;
      // ultimoError es null y ultimoIntentoEn es null.
      const item = itemBase({ id: 'sin-opcionales' });

      await repo.guardar(item);
      const recuperado = await repo.buscarPorId('sin-opcionales');

      expect(recuperado).not.toBeNull();
      expect(recuperado!.hashServer).toBeUndefined();
      expect(recuperado!.dependeDe).toBeUndefined();
      expect(recuperado!.forzarSobrescribir).toBeUndefined();
      expect(recuperado!.ultimoError).toBeNull();
      expect(recuperado!.ultimoIntentoEn).toBeNull();
    });
  });

  describe(`${nombre} — round-trip de payload arbitrario`, () => {
    it('persiste payload con objetos anidados y arrays', async () => {
      const payloadComplejo = {
        liquidacion: { id: 'LIQ-99', total: 18400.55 },
        consumos: [120, 130, 145],
        meta: { intentos_previos: 0, generado_por: 'op-7' },
      };
      const item = itemBase({ id: 'payload-1', payload: payloadComplejo });

      await repo.guardar(item);
      const recuperado = await repo.buscarPorId('payload-1');

      expect(recuperado).not.toBeNull();
      expect(recuperado!.payload).toEqual(payloadComplejo);
    });

    it('triangulacion: persiste payload primitivo (string)', async () => {
      const item = itemBase({ id: 'payload-2', payload: 'evento-simple' });

      await repo.guardar(item);
      const recuperado = await repo.buscarPorId('payload-2');

      expect(recuperado!.payload).toBe('evento-simple');
    });
  });

  describe(`${nombre} — preservacion de tipos Date`, () => {
    it('creadoEn vuelve como instancia Date', async () => {
      const item = itemBase({ id: 'fechas-1' });
      await repo.guardar(item);

      const recuperado = await repo.buscarPorId('fechas-1');
      expect(recuperado!.creadoEn).toBeInstanceOf(Date);
      expect(recuperado!.creadoEn.toISOString()).toBe(item.creadoEn.toISOString());
    });
  });
}
