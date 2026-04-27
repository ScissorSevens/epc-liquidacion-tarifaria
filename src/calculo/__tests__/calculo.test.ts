/**
 * Módulo CALCULO — Liquidación inmutable
 * Ciclo 19: Creación básica de Liquidación
 */

import { crearLiquidacion } from '../calculo';
import type { ResultadoCalculo } from '../../motor-tarifario';

describe('crearLiquidacion', () => {
  const resultadoMock: ResultadoCalculo = {
    consumo: 15,
    consumoBasico: 15,
    consumoExcedente: 0,
    cargoFijo: 5000,
    cargoConsumo: 12000,
    cargoExcedente: 0,
    subsidio: 0,
    contribucion: 0,
    total: 17000,
    periodo: { mes: 4, anio: 2026 },
  };

  it('debería generar una Liquidación con id único, fechaGeneracion y los datos del cálculo', () => {
    const liquidacion = crearLiquidacion({
      suscriptorId: 'SUSC-001',
      resultado: resultadoMock,
    });

    expect(liquidacion.id).toBeDefined();
    expect(typeof liquidacion.id).toBe('string');
    expect(liquidacion.id.length).toBeGreaterThan(0);

    expect(liquidacion.suscriptorId).toBe('SUSC-001');
    expect(liquidacion.fechaGeneracion).toBeInstanceOf(Date);
    expect(liquidacion.resultado).toEqual(resultadoMock);
  });

  it('debería generar IDs distintos para liquidaciones distintas', () => {
    const l1 = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });
    const l2 = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

    expect(l1.id).not.toBe(l2.id);
  });

  // Ciclo 20: Inmutabilidad runtime
  describe('inmutabilidad runtime', () => {
    it('debería estar congelada (Object.isFrozen) al nivel raíz', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(Object.isFrozen(liquidacion)).toBe(true);
    });

    it('debería congelar también el resultado anidado (deep freeze)', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(Object.isFrozen(liquidacion.resultado)).toBe(true);
      expect(Object.isFrozen(liquidacion.resultado.periodo)).toBe(true);
    });

    it('debería lanzar error en strict mode al intentar modificar campos', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(() => {
        (liquidacion as any).suscriptorId = 'HACKER-666';
      }).toThrow(TypeError);

      expect(() => {
        (liquidacion.resultado as any).total = 999999;
      }).toThrow(TypeError);
    });

    it('no debería verse afectada si el input original se muta después', () => {
      const resultadoMutable: ResultadoCalculo = { ...resultadoMock };
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMutable });

      const totalOriginal = liquidacion.resultado.total;
      // Intentamos mutar el objeto original — la liquidación no debe cambiar
      try {
        (resultadoMutable as any).total = 0;
      } catch {
        // el freeze también lo bloquea, está OK
      }

      expect(liquidacion.resultado.total).toBe(totalOriginal);
    });
  });

  // Ciclo 21: Hash SHA-256 del contenido
  describe('hash de integridad', () => {
    it('debería generar un hash SHA-256 al crear la liquidación', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(liquidacion.hash).toBeDefined();
      expect(typeof liquidacion.hash).toBe('string');
      expect(liquidacion.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 chars hex
    });

    it('debería generar hashes distintos para liquidaciones distintas (por id/fecha)', () => {
      const l1 = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });
      const l2 = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(l1.hash).not.toBe(l2.hash);
    });

    it('el hash debería ser reproducible para el mismo contenido', () => {
      // Si reconstruimos una liquidación con los mismos datos exactos (id+fecha+suscriptor+resultado),
      // el hash debe ser idéntico — esto es lo que permite verificar tampering.
      const l1 = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      // Re-calculamos el hash usando los mismos datos
      const { calcularHash } = require('../calculo');
      const hashRecalculado = calcularHash({
        id: l1.id,
        suscriptorId: l1.suscriptorId,
        fechaGeneracion: l1.fechaGeneracion,
        resultado: l1.resultado,
      });

      expect(hashRecalculado).toBe(l1.hash);
    });
  });
});
