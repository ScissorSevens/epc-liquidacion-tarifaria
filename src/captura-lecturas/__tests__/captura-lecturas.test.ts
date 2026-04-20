import { registrarLectura, validarEvidencia } from '../captura-lecturas';
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

      expect(() => registrarLectura(entrada)).toThrow('id_medidor debe ser un entero mayor a cero');
    });

    it('lanza error si id_operario es invalido', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_operario: -1,
      };

      expect(() => registrarLectura(entrada)).toThrow('id_operario debe ser un entero mayor a cero');
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

    it('lanza error si id_medidor es decimal', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_medidor: 1.5,
      };

      expect(() => registrarLectura(entrada)).toThrow('id_medidor debe ser un entero mayor a cero');
    });

    it('lanza error si id_operario es decimal', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_operario: 2.7,
      };

      expect(() => registrarLectura(entrada)).toThrow('id_operario debe ser un entero mayor a cero');
    });

    it('lanza error si id_periodo tiene anio menor a 2000', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        id_periodo: '199912',
      };

      expect(() => registrarLectura(entrada)).toThrow('id_periodo debe tener anio mayor o igual a 2000');
    });

    it('acepta lecturas decimales (Decimal 10,3 segun modelo)', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        lectura_actual: 150.325,
        lectura_anterior: 130.100,
      };

      const lectura = registrarLectura(entrada);

      expect(lectura.lectura_actual).toBe(150.325);
      expect(lectura.lectura_anterior).toBe(130.100);
    });

    it('observaciones vacias se tratan como undefined', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        observaciones: '',
      };

      const lectura = registrarLectura(entrada);

      expect(lectura.observaciones).toBeUndefined();
    });

    it('timestamp_captura es ISO-8601 valido', () => {
      const lectura = registrarLectura(entradaBase);

      const parsed = new Date(lectura.timestamp_captura);
      expect(parsed.toISOString()).toBe(lectura.timestamp_captura);
    });
  });

  describe('evidencia fotografica', () => {
    it('lanza error si evidencia tiene foto_path vacio', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '' },
      };

      expect(() => registrarLectura(entrada)).toThrow('foto_path no puede estar vacio');
    });

    it('lanza error si foto_path no tiene extension de imagen valida', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor_001.pdf' },
      };

      expect(() => registrarLectura(entrada)).toThrow('foto_path debe ser una imagen (.jpg, .jpeg, .png, .heic)');
    });

    it('acepta extensiones jpg, jpeg, png y heic', () => {
      const extensiones = ['.jpg', '.jpeg', '.png', '.heic'];

      for (const ext of extensiones) {
        const entrada: EntradaLectura = {
          ...entradaBase,
          evidencia: { foto_path: `/fotos/medidor${ext}` },
        };

        const lectura = registrarLectura(entrada);
        expect(lectura.evidencia?.foto_path).toBe(`/fotos/medidor${ext}`);
      }
    });

    it('acepta extensiones en mayusculas (JPG, PNG)', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.JPG' },
      };

      const lectura = registrarLectura(entrada);
      expect(lectura.evidencia?.foto_path).toBe('/fotos/medidor.JPG');
    });

    it('lanza error si foto_hash no es SHA-256 valido (64 hex chars)', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.jpg', foto_hash: 'hash-invalido' },
      };

      expect(() => registrarLectura(entrada)).toThrow('foto_hash debe ser SHA-256 valido (64 caracteres hexadecimales)');
    });

    it('acepta foto_hash SHA-256 valido', () => {
      const hashValido = 'a'.repeat(64);
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.jpg', foto_hash: hashValido },
      };

      const lectura = registrarLectura(entrada);
      expect(lectura.evidencia?.foto_hash).toBe(hashValido);
    });

    it('validarEvidencia retorna true si lectura tiene evidencia', () => {
      const entrada: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.jpg' },
      };

      const lectura = registrarLectura(entrada);
      expect(validarEvidencia(lectura)).toBe(true);
    });

    it('validarEvidencia retorna false si lectura no tiene evidencia', () => {
      const lectura = registrarLectura(entradaBase);
      expect(validarEvidencia(lectura)).toBe(false);
    });

    it('validarEvidencia retorna true solo si tiene foto_hash (integridad completa)', () => {
      const sinHash: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.jpg' },
      };
      const conHash: EntradaLectura = {
        ...entradaBase,
        evidencia: { foto_path: '/fotos/medidor.jpg', foto_hash: 'b'.repeat(64) },
      };

      const lecturaSinHash = registrarLectura(sinHash);
      const lecturaConHash = registrarLectura(conHash);

      expect(validarEvidencia(lecturaSinHash, { requiereHash: true })).toBe(false);
      expect(validarEvidencia(lecturaConHash, { requiereHash: true })).toBe(true);
    });
  });
});
