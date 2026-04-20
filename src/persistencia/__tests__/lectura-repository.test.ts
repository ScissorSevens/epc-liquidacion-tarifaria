import { LecturaRepositoryMemoria } from '../lectura-repository-memoria';
import { Lectura } from '../../captura-lecturas/types';

describe('LecturaRepository (Memoria)', () => {
  let repo: LecturaRepositoryMemoria;

  const lecturaBase: Lectura = {
    id_medidor: 1,
    id_periodo: '202504',
    id_operario: 1,
    lectura_actual: 150,
    lectura_anterior: 130,
    estado_validacion: 'pendiente',
    timestamp_captura: '2025-04-20T10:00:00.000Z',
    estado_sync: 'pendiente',
  };

  beforeEach(() => {
    repo = new LecturaRepositoryMemoria();
  });

  describe('guardar', () => {
    it('guarda una lectura y le asigna id autoincremental', async () => {
      const guardada = await repo.guardar(lecturaBase);

      expect(guardada.id_lectura).toBe(1);
      expect(guardada.id_medidor).toBe(1);
      expect(guardada.lectura_actual).toBe(150);
    });

    it('ids son autoincrementales consecutivos', async () => {
      const primera = await repo.guardar(lecturaBase);
      const segunda = await repo.guardar({ ...lecturaBase, id_medidor: 2 });

      expect(primera.id_lectura).toBe(1);
      expect(segunda.id_lectura).toBe(2);
    });

    it('lanza error si ya existe lectura para mismo medidor y periodo', async () => {
      await repo.guardar(lecturaBase);

      await expect(repo.guardar(lecturaBase)).rejects.toThrow(
        'Ya existe una lectura para el medidor 1 en el periodo 202504'
      );
    });

    it('permite mismo medidor en diferente periodo', async () => {
      await repo.guardar(lecturaBase);
      const otra = await repo.guardar({ ...lecturaBase, id_periodo: '202505' });

      expect(otra.id_lectura).toBe(2);
    });

    it('permite mismo periodo con diferente medidor', async () => {
      await repo.guardar(lecturaBase);
      const otra = await repo.guardar({ ...lecturaBase, id_medidor: 2 });

      expect(otra.id_lectura).toBe(2);
    });
  });

  describe('obtenerPorId', () => {
    it('retorna la lectura si existe', async () => {
      await repo.guardar(lecturaBase);

      const lectura = await repo.obtenerPorId(1);

      expect(lectura).not.toBeNull();
      expect(lectura!.id_medidor).toBe(1);
    });

    it('retorna null si no existe', async () => {
      const lectura = await repo.obtenerPorId(999);

      expect(lectura).toBeNull();
    });
  });

  describe('listarPorPeriodo', () => {
    it('retorna lecturas del periodo indicado', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2 });
      await repo.guardar({ ...lecturaBase, id_medidor: 3, id_periodo: '202505' });

      const lecturas = await repo.listarPorPeriodo('202504');

      expect(lecturas).toHaveLength(2);
      expect(lecturas.every(l => l.id_periodo === '202504')).toBe(true);
    });

    it('retorna array vacio si no hay lecturas en el periodo', async () => {
      const lecturas = await repo.listarPorPeriodo('202512');

      expect(lecturas).toEqual([]);
    });
  });

  describe('listarPendientesSync', () => {
    it('retorna solo lecturas con estado_sync pendiente', async () => {
      const l1 = await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2 });
      await repo.actualizarEstadoSync(l1.id_lectura!, 'sincronizado', '2025-04-20T12:00:00.000Z');

      const pendientes = await repo.listarPendientesSync();

      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].id_medidor).toBe(2);
    });
  });

  describe('listar con filtros', () => {
    it('sin filtros retorna todas las lecturas', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2 });

      const todas = await repo.listar();

      expect(todas).toHaveLength(2);
    });

    it('filtra por id_operario', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2, id_operario: 5 });

      const filtradas = await repo.listar({ id_operario: 5 });

      expect(filtradas).toHaveLength(1);
      expect(filtradas[0].id_operario).toBe(5);
    });

    it('filtra por estado_validacion', async () => {
      await repo.guardar(lecturaBase);
      const l2 = await repo.guardar({ ...lecturaBase, id_medidor: 2 });
      await repo.actualizarEstadoValidacion(l2.id_lectura!, 'validado');

      const validadas = await repo.listar({ estado_validacion: 'validado' });

      expect(validadas).toHaveLength(1);
      expect(validadas[0].estado_validacion).toBe('validado');
    });

    it('combina multiples filtros', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2, id_operario: 5 });
      await repo.guardar({ ...lecturaBase, id_medidor: 3, id_operario: 5, id_periodo: '202505' });

      const filtradas = await repo.listar({ id_operario: 5, id_periodo: '202504' });

      expect(filtradas).toHaveLength(1);
      expect(filtradas[0].id_medidor).toBe(2);
    });
  });

  describe('actualizarEstadoSync', () => {
    it('actualiza estado a sincronizado con timestamp', async () => {
      const guardada = await repo.guardar(lecturaBase);

      const actualizada = await repo.actualizarEstadoSync(
        guardada.id_lectura!, 'sincronizado', '2025-04-20T12:00:00.000Z'
      );

      expect(actualizada.estado_sync).toBe('sincronizado');
      expect(actualizada.timestamp_sync).toBe('2025-04-20T12:00:00.000Z');
    });

    it('actualiza estado a error', async () => {
      const guardada = await repo.guardar(lecturaBase);

      const actualizada = await repo.actualizarEstadoSync(guardada.id_lectura!, 'error');

      expect(actualizada.estado_sync).toBe('error');
    });

    it('lanza error si lectura no existe', async () => {
      await expect(repo.actualizarEstadoSync(999, 'sincronizado')).rejects.toThrow(
        'Lectura con id 999 no encontrada'
      );
    });
  });

  describe('actualizarEstadoValidacion', () => {
    it('actualiza estado a validado', async () => {
      const guardada = await repo.guardar(lecturaBase);

      const actualizada = await repo.actualizarEstadoValidacion(guardada.id_lectura!, 'validado');

      expect(actualizada.estado_validacion).toBe('validado');
    });

    it('lanza error si lectura no existe', async () => {
      await expect(repo.actualizarEstadoValidacion(999, 'validado')).rejects.toThrow(
        'Lectura con id 999 no encontrada'
      );
    });
  });

  describe('contar', () => {
    it('cuenta total de lecturas', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2 });

      const total = await repo.contar();

      expect(total).toBe(2);
    });

    it('cuenta con filtros', async () => {
      await repo.guardar(lecturaBase);
      await repo.guardar({ ...lecturaBase, id_medidor: 2, id_periodo: '202505' });

      const total = await repo.contar({ id_periodo: '202504' });

      expect(total).toBe(1);
    });

    it('retorna 0 si no hay lecturas', async () => {
      const total = await repo.contar();

      expect(total).toBe(0);
    });
  });

  describe('existeLectura', () => {
    it('retorna true si existe lectura para medidor y periodo', async () => {
      await repo.guardar(lecturaBase);

      const existe = await repo.existeLectura(1, '202504');

      expect(existe).toBe(true);
    });

    it('retorna false si no existe', async () => {
      const existe = await repo.existeLectura(1, '202504');

      expect(existe).toBe(false);
    });
  });
});
