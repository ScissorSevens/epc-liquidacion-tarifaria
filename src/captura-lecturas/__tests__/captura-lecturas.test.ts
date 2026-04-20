import { registrarLectura } from '../captura-lecturas';
import { EntradaLectura } from '../types';

describe('Captura de Lecturas', () => {
  const entradaBase: EntradaLectura = {
    id_medidor: 1,
    id_periodo: '202504',
    id_operario: 1,
    lectura_actual: 150,
    lectura_anterior: 130,
  };

  describe('registro de lectura valida', () => {
    it('registra una lectura basica y retorna objeto Lectura', () => {
      const lectura = registrarLectura(entradaBase);

      expect(lectura.id_medidor).toBe(1);
      expect(lectura.id_periodo).toBe('202504');
      expect(lectura.id_operario).toBe(1);
      expect(lectura.lectura_actual).toBe(150);
      expect(lectura.lectura_anterior).toBe(130);
      expect(lectura.estado_validacion).toBe('pendiente');
      expect(lectura.estado_sync).toBe('pendiente');
      expect(lectura.timestamp_captura).toBeDefined();
    });

    it('incluye evidencia fotografica cuando se proporciona', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor_001.jpg' },
      };

      const lectura = registrarLectura(entrada);

      expect(lectura.evidencia).toEqual({ foto_path: '/fotos/medidor_001.jpg' });
    });

    it('incluye observaciones cuando se proporcionan', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        observaciones: 'Medidor con lente opaco',
      };

      const lectura = registrarLectura(entrada);

      expect(lectura.observaciones).toBe('Medidor con lente opaco');
    });

    it('consumo cero es valido (lecturas iguales)', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        lectura_actual: 130,
        lectura_anterior: 130,
      };

      const lectura = registrarLectura(entrada);

      expect(lectura.lectura_actual).toBe(130);
      expect(lectura.lectura_anterior).toBe(130);
    });
  });

  describe('validaciones de entrada', () => {
    it('lanza error si lectura actual es menor que anterior', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        lectura_actual: 120,
        lectura_anterior: 130,
      };

      expect(() => registrarLectura(entrada)).toThrow('Lectura actual no puede ser menor que la anterior');
    });

    it('lanza error si lectura actual es negativa', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        lectura_actual: -5,
      };

      expect(() => registrarLectura(entrada)).toThrow('Las lecturas no pueden ser negativas');
    });

    it('lanza error si lectura anterior es negativa', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        lectura_anterior: -10,
      };

      expect(() => registrarLectura(entrada)).toThrow('Las lecturas no pueden ser negativas');
    });

    it('lanza error si id_medidor es invalido', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_medidor: 0,
      };

      expect(() => registrarLectura(entrada)).toThrow('id_medidor debe ser mayor a cero');
    });

    it('lanza error si id_operario es invalido', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_operario: -1,
      };

      expect(() => registrarLectura(entrada)).toThrow('id_operario debe ser mayor a cero');
    });

    it('lanza error si id_periodo tiene formato invalido', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_periodo: '2025-04',
      };

      expect(() => registrarLectura(entrada)).toThrow('id_periodo debe tener formato YYYYMM');
    });

    it('lanza error si id_periodo tiene mes invalido', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_periodo: '202513',
      };

      expect(() => registrarLectura(entrada)).toThrow('id_periodo debe tener formato YYYYMM');
    });

    it('lanza error si observaciones exceden 300 caracteres', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        observaciones: 'x'.repeat(301),
      };

      expect(() => registrarLectura(entrada)).toThrow('Observaciones no pueden exceder 300 caracteres');
    });
  });
});
