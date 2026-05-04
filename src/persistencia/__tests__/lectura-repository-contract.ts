/**
 * Contract test reusable para `LecturaRepository`.
 *
 * Replica el patron del adapter `factura-repository-contract.ts`:
 * la SUITE de tests del puerto se vuelve adapter-agnostic. Cualquier
 * implementacion (in-memory hoy, SQLite en este sprint) se valida con
 * la misma bateria invocando `runLecturaRepositoryContract(nombre, factory, cleanup?)`.
 *
 * Origen del contenido: approval del comportamiento ya verificado por
 * `__tests__/lectura-repository.test.ts` contra `LecturaRepositoryMemoria`.
 * Toda variacion de comportamiento entre adapters DEBE expresarse aca.
 *
 * cleanupRepo opcional permite a adapters con I/O liberar recursos
 * (ej. `db.close()` para SQLite). El in-memory no necesita nada.
 *
 * Cobertura del contract:
 *  1. guardar asigna id autoincremental + ids consecutivos
 *  2. guardar rechaza duplicado (id_medidor, id_periodo) con mensaje de dominio
 *  3. guardar permite mismo medidor en distinto periodo y mismo periodo con distinto medidor
 *  4. obtenerPorId happy + null
 *  5. listarPorPeriodo
 *  6. listarPendientesSync
 *  7. listar con/sin filtros (id_operario, estado_validacion, multiples)
 *  8. actualizarEstadoSync (sincronizado con timestamp, error sin timestamp, no encontrada)
 *  9. actualizarEstadoValidacion (validado, no encontrada)
 * 10. contar (total, con filtros, vacio)
 * 11. existeLectura (true/false)
 */

import type { Lectura } from '../../captura-lecturas/types';
import type { LecturaRepository } from '../lectura-repository';

// ---------- Builders compartidos ----------

export function lecturaBase(overrides: Partial<Lectura> = {}): Lectura {
  return {
    id_medidor: 1,
    id_periodo: '202504',
    id_operario: 1,
    lectura_actual: 150,
    lectura_anterior: 130,
    estado_validacion: 'pendiente',
    timestamp_captura: '2025-04-20T10:00:00.000Z',
    estado_sync: 'pendiente',
    ...overrides,
  };
}

// ---------- Mensajes de dominio (compartidos entre adapters) ----------
//
// Estos mensajes son el contrato de error visible al dominio. Tanto el
// in-memory como el SQLite-mapper deben emitir EXACTAMENTE estos textos.
// Si un adapter futuro emite otro texto, el harness lo cachea aca.

export function mensajeLecturaDuplicada(idMedidor: number, idPeriodo: string): string {
  return `Ya existe una lectura para el medidor ${idMedidor} en el periodo ${idPeriodo}`;
}

export function mensajeLecturaNoEncontrada(id: number): string {
  return `Lectura con id ${id} no encontrada`;
}

// ---------- Harness ----------

/**
 * Suite reusable. Cada adapter debe pasarla.
 *
 * @param nombre       Etiqueta humana del adapter (ej. 'LecturaRepositoryMemoria').
 * @param crearRepo    Factory sin args que devuelve un repo limpio.
 * @param cleanupRepo  Opcional. Se llama en `afterEach` con el ultimo repo creado.
 */
export function runLecturaRepositoryContract(
  nombre: string,
  crearRepo: () => LecturaRepository,
  cleanupRepo?: (repo: LecturaRepository) => void | Promise<void>,
): void {
  let repo: LecturaRepository;

  beforeEach(() => {
    repo = crearRepo();
  });

  afterEach(async () => {
    if (cleanupRepo) await cleanupRepo(repo);
  });

  describe(`${nombre} — guardar`, () => {
    it('guarda una lectura y le asigna id autoincremental', async () => {
      const guardada = await repo.guardar(lecturaBase());

      expect(guardada.id_lectura).toBe(1);
      expect(guardada.id_medidor).toBe(1);
      expect(guardada.lectura_actual).toBe(150);
    });

    it('ids son autoincrementales consecutivos', async () => {
      const primera = await repo.guardar(lecturaBase());
      const segunda = await repo.guardar(lecturaBase({ id_medidor: 2 }));

      expect(primera.id_lectura).toBe(1);
      expect(segunda.id_lectura).toBe(2);
    });

    it('lanza error con mensaje de dominio si ya existe lectura para mismo medidor y periodo', async () => {
      await repo.guardar(lecturaBase());

      await expect(repo.guardar(lecturaBase())).rejects.toThrow(
        mensajeLecturaDuplicada(1, '202504'),
      );
    });

    it('permite mismo medidor en diferente periodo', async () => {
      await repo.guardar(lecturaBase());
      const otra = await repo.guardar(lecturaBase({ id_periodo: '202505' }));

      expect(otra.id_lectura).toBe(2);
    });

    it('permite mismo periodo con diferente medidor', async () => {
      await repo.guardar(lecturaBase());
      const otra = await repo.guardar(lecturaBase({ id_medidor: 2 }));

      expect(otra.id_lectura).toBe(2);
    });

    it('persiste evidencia (foto_path + foto_hash) y observaciones cuando vienen', async () => {
      const guardada = await repo.guardar(
        lecturaBase({
          evidencia: { foto_path: '/local/foto1.jpg', foto_hash: 'sha256:abc' },
          observaciones: 'medidor con vidrio sucio',
        }),
      );

      const recuperada = await repo.obtenerPorId(guardada.id_lectura!);
      expect(recuperada).not.toBeNull();
      expect(recuperada!.evidencia).toEqual({
        foto_path: '/local/foto1.jpg',
        foto_hash: 'sha256:abc',
      });
      expect(recuperada!.observaciones).toBe('medidor con vidrio sucio');
    });

    it('persiste lectura sin evidencia ni observaciones (campos opcionales ausentes)', async () => {
      const guardada = await repo.guardar(lecturaBase());
      const recuperada = await repo.obtenerPorId(guardada.id_lectura!);

      expect(recuperada).not.toBeNull();
      expect(recuperada!.evidencia).toBeUndefined();
      expect(recuperada!.observaciones).toBeUndefined();
      expect(recuperada!.timestamp_sync).toBeUndefined();
    });
  });

  describe(`${nombre} — obtenerPorId`, () => {
    it('retorna la lectura si existe', async () => {
      await repo.guardar(lecturaBase());

      const lectura = await repo.obtenerPorId(1);

      expect(lectura).not.toBeNull();
      expect(lectura!.id_medidor).toBe(1);
    });

    it('retorna null si no existe', async () => {
      const lectura = await repo.obtenerPorId(999);

      expect(lectura).toBeNull();
    });
  });

  describe(`${nombre} — listarPorPeriodo`, () => {
    it('retorna lecturas del periodo indicado', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));
      await repo.guardar(lecturaBase({ id_medidor: 3, id_periodo: '202505' }));

      const lecturas = await repo.listarPorPeriodo('202504');

      expect(lecturas).toHaveLength(2);
      expect(lecturas.every((l) => l.id_periodo === '202504')).toBe(true);
    });

    it('retorna array vacio si no hay lecturas en el periodo', async () => {
      const lecturas = await repo.listarPorPeriodo('202512');

      expect(lecturas).toEqual([]);
    });
  });

  describe(`${nombre} — listarPendientesSync`, () => {
    it('retorna solo lecturas con estado_sync pendiente', async () => {
      const l1 = await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));
      await repo.actualizarEstadoSync(l1.id_lectura!, 'sincronizado', '2025-04-20T12:00:00.000Z');

      const pendientes = await repo.listarPendientesSync();

      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].id_medidor).toBe(2);
    });
  });

  describe(`${nombre} — listar con filtros`, () => {
    it('sin filtros retorna todas las lecturas', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));

      const todas = await repo.listar();

      expect(todas).toHaveLength(2);
    });

    it('filtra por id_operario', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2, id_operario: 5 }));

      const filtradas = await repo.listar({ id_operario: 5 });

      expect(filtradas).toHaveLength(1);
      expect(filtradas[0].id_operario).toBe(5);
    });

    it('filtra por estado_validacion', async () => {
      await repo.guardar(lecturaBase());
      const l2 = await repo.guardar(lecturaBase({ id_medidor: 2 }));
      await repo.actualizarEstadoValidacion(l2.id_lectura!, 'validado');

      const validadas = await repo.listar({ estado_validacion: 'validado' });

      expect(validadas).toHaveLength(1);
      expect(validadas[0].estado_validacion).toBe('validado');
    });

    it('filtra por id_medidor', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));
      await repo.guardar(lecturaBase({ id_medidor: 2, id_periodo: '202505' }));

      const filtradas = await repo.listar({ id_medidor: 2 });

      expect(filtradas).toHaveLength(2);
      expect(filtradas.every((l) => l.id_medidor === 2)).toBe(true);
    });

    it('filtra por estado_sync', async () => {
      const l1 = await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));
      await repo.actualizarEstadoSync(l1.id_lectura!, 'sincronizado', '2025-04-20T12:00:00.000Z');

      const sincronizadas = await repo.listar({ estado_sync: 'sincronizado' });

      expect(sincronizadas).toHaveLength(1);
      expect(sincronizadas[0].id_medidor).toBe(1);
    });

    it('combina multiples filtros', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2, id_operario: 5 }));
      await repo.guardar(
        lecturaBase({ id_medidor: 3, id_operario: 5, id_periodo: '202505' }),
      );

      const filtradas = await repo.listar({ id_operario: 5, id_periodo: '202504' });

      expect(filtradas).toHaveLength(1);
      expect(filtradas[0].id_medidor).toBe(2);
    });
  });

  describe(`${nombre} — actualizarEstadoSync`, () => {
    it('actualiza estado a sincronizado con timestamp', async () => {
      const guardada = await repo.guardar(lecturaBase());

      const actualizada = await repo.actualizarEstadoSync(
        guardada.id_lectura!,
        'sincronizado',
        '2025-04-20T12:00:00.000Z',
      );

      expect(actualizada.estado_sync).toBe('sincronizado');
      expect(actualizada.timestamp_sync).toBe('2025-04-20T12:00:00.000Z');
    });

    it('actualiza estado a error', async () => {
      const guardada = await repo.guardar(lecturaBase());

      const actualizada = await repo.actualizarEstadoSync(guardada.id_lectura!, 'error');

      expect(actualizada.estado_sync).toBe('error');
    });

    it('lanza error de dominio si lectura no existe', async () => {
      await expect(repo.actualizarEstadoSync(999, 'sincronizado')).rejects.toThrow(
        mensajeLecturaNoEncontrada(999),
      );
    });
  });

  describe(`${nombre} — actualizarEstadoValidacion`, () => {
    it('actualiza estado a validado', async () => {
      const guardada = await repo.guardar(lecturaBase());

      const actualizada = await repo.actualizarEstadoValidacion(
        guardada.id_lectura!,
        'validado',
      );

      expect(actualizada.estado_validacion).toBe('validado');
    });

    it('lanza error de dominio si lectura no existe', async () => {
      await expect(repo.actualizarEstadoValidacion(999, 'validado')).rejects.toThrow(
        mensajeLecturaNoEncontrada(999),
      );
    });
  });

  describe(`${nombre} — contar`, () => {
    it('cuenta total de lecturas', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2 }));

      const total = await repo.contar();

      expect(total).toBe(2);
    });

    it('cuenta con filtros', async () => {
      await repo.guardar(lecturaBase());
      await repo.guardar(lecturaBase({ id_medidor: 2, id_periodo: '202505' }));

      const total = await repo.contar({ id_periodo: '202504' });

      expect(total).toBe(1);
    });

    it('retorna 0 si no hay lecturas', async () => {
      const total = await repo.contar();

      expect(total).toBe(0);
    });
  });

  describe(`${nombre} — existeLectura`, () => {
    it('retorna true si existe lectura para medidor y periodo', async () => {
      await repo.guardar(lecturaBase());

      const existe = await repo.existeLectura(1, '202504');

      expect(existe).toBe(true);
    });

    it('retorna false si no existe', async () => {
      const existe = await repo.existeLectura(1, '202504');

      expect(existe).toBe(false);
    });
  });
}
