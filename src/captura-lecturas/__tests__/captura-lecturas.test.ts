import { registrarLectura, validarEvidencia, liquidarLectura, ContextoLiquidacion } from '../captura-lecturas';
import { EntradaLectura } from '../types';
import type { ParametrosTarifa, AcuerdoMunicipal } from '../../motor-tarifario/types';
import type { Suscriptor } from '../../suscriptores/types';

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

describe('Integracion captura → motor tarifario (multi-tenant)', () => {
  const parametrosBase: ParametrosTarifa = {
    id_parametros: 1,
    id_prestador: 0,
    id_acuerdo: 1,
    periodo: 2026,
    cma: 30_000_000,        // CF = 30M / 3000 = 10_000
    cmo: 1500,
    cmi: 300,
    cmt: 200,
    cmviaa: 0,
    aplica_cmviaa: false,
    agua_suministrada_m3_anio: 500_000,  // ASP > 0
    ipuf_m3_suscriptor_mes: 6,
    suscriptores_promedio: 3000,
    aplica_minimo_vital: false,
    m3_gratis_minimo_vital: 0,
    vigente_desde: '2026-01-01',
    vigente_hasta: '2026-12-31',
    created_at: '2026-01-01T00:00:00',
  };

  const acuerdoBase: AcuerdoMunicipal = {
    id_acuerdo: 1,
    id_prestador: 0,
    factor_subsidio_e1: -0.60,
    factor_subsidio_e2: -0.50,
    factor_subsidio_e3: -0.40,
    factor_contribucion_e5: 0.50,
    factor_contribucion_e6: 0.60,
    factor_contribucion_comercial: 0.50,
    factor_contribucion_industrial: 0.30,
    fecha_vigencia_desde: '2026-01-01',
    fecha_vigencia_hasta: '2026-12-31',
    acto_administrativo_url: null,
    observaciones: null,
    created_at: '2026-01-01T00:00:00',
  };

  const suscriptorBase: Suscriptor = {
    id_suscriptor: 1,
    codigo: 'S001',
    nombre_apellidos: 'Test',
    cedula: '123',
    municipio: 'Bog',
    direccion: 'Calle 1',
    estrato: 4,
    aplica_subsidio: false,
    estado: 'activo',
    created_at: '2026-01-01T00:00:00',
    id_prestador: 0,
    categoria_uso: 'residencial',
  };

  const contextoBase: ContextoLiquidacion = {
    parametros: parametrosBase,
    acuerdo: acuerdoBase,
  };

  const entradaBase: EntradaLectura = {
    id_medidor: 1,
    id_periodo: '202504',
    id_operario: 1,
    lectura_actual: 150,
    lectura_anterior: 130,
  };

  it('liquida una lectura capturada con contexto multi-tenant', () => {
    const lectura = registrarLectura(entradaBase, 0);
    const resultado = liquidarLectura(lectura, suscriptorBase, contextoBase);

    expect(resultado.consumo_m3).toBe(20);
    expect(resultado.id_prestador).toBe(0);
    expect(resultado.cargo_fijo).toBe(10_000);
    expect(resultado.cc_unitario).toBeGreaterThan(0);
    // E4 = sin subsidio ni contribucion
    expect(resultado.subsidio).toBe(0);
    expect(resultado.contribucion).toBe(0);
    // total = CF + CC_total
    expect(resultado.total).toBe(resultado.cargo_fijo + resultado.cc_total);
  });

  it('liquida lectura con estrato 1 aplicando subsidio 60%', () => {
    const suscriptorE1: Suscriptor = { ...suscriptorBase, estrato: 1 };
    const lectura = registrarLectura(entradaBase, 0);
    const resultado = liquidarLectura(lectura, suscriptorE1, contextoBase);

    expect(resultado.estrato).toBe(1);
    expect(resultado.factor_aplicado).toBeCloseTo(-0.60, 5);
    expect(resultado.subsidio).toBeGreaterThan(0);
  });

  it('liquida lectura con consumo cero → solo cargo fijo', () => {
    const entrada: EntradaLectura = { ...entradaBase, lectura_actual: 130, lectura_anterior: 130 };
    const lectura = registrarLectura(entrada, 0);
    const resultado = liquidarLectura(lectura, suscriptorBase, contextoBase);

    expect(resultado.consumo_m3).toBe(0);
    expect(resultado.cc_total).toBe(0);
    expect(resultado.total).toBe(10_000);
  });

  it('liquida lectura con lecturas decimales', () => {
    const entrada: EntradaLectura = {
      ...entradaBase,
      lectura_actual: 150.75,
      lectura_anterior: 130.25,
    };
    const lectura = registrarLectura(entrada, 0);
    const resultado = liquidarLectura(lectura, suscriptorBase, contextoBase);

    expect(resultado.consumo_m3).toBe(20.5);
  });

  it('denormaliza id_prestador en la lectura al registrar', () => {
    const lectura = registrarLectura(entradaBase, 7);
    expect(lectura.id_prestador).toBe(7);
  });

  it('categoria comercial → solo contribucion, nunca subsidio', () => {
    const susComercial: Suscriptor = { ...suscriptorBase, estrato: 1, categoria_uso: 'comercial' };
    const lectura = registrarLectura(entradaBase, 0);
    const resultado = liquidarLectura(lectura, susComercial, contextoBase);

    expect(resultado.categoria_uso).toBe('comercial');
    expect(resultado.subsidio).toBe(0);
    expect(resultado.contribucion).toBeGreaterThan(0);
    expect(resultado.factor_aplicado).toBeCloseTo(0.50, 5);
  });
});
