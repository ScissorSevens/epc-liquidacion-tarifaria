/**
 * Módulo CALCULO — Liquidación inmutable
 * Creación básica de Liquidación
 */

import { crearLiquidacion } from '../calculo';
import type { Liquidacion } from '../types';
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

  // Inmutabilidad runtime
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

  //  Hash SHA-256 del contenido
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
        estado: l1.estado,
        reemplazaA: l1.reemplazaA,
      });

      expect(hashRecalculado).toBe(l1.hash);
    });
  });

  //  Verificación de tampering
  describe('verificarIntegridad', () => {
    it('debería retornar true para una Liquidación recién creada (no manipulada)', () => {
      const { verificarIntegridad } = require('../calculo');
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(verificarIntegridad(liquidacion)).toBe(true);
    });

    it('debería retornar false si se manipuló el contenido (hash no coincide)', () => {
      const { verificarIntegridad } = require('../calculo');
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      // Simulamos manipulación: reconstruimos un objeto con el mismo hash pero datos modificados
      // (como si alguien editara la base de datos directamente)
      const liquidacionManipulada = {
        ...liquidacion,
        resultado: { ...liquidacion.resultado, total: 999999 },
        // hash sigue siendo el mismo del original
      };

      expect(verificarIntegridad(liquidacionManipulada)).toBe(false);
    });

    it('debería detectar manipulación del suscriptorId', () => {
      const { verificarIntegridad } = require('../calculo');
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      const manipulada = { ...liquidacion, suscriptorId: 'SUSC-HACKER' };

      expect(verificarIntegridad(manipulada)).toBe(false);
    });
  });

  // Estados ACTIVA / ANULADA
  describe('estado de la liquidación', () => {
    it('una Liquidación nueva debería estar en estado ACTIVA', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(liquidacion.estado).toBe('ACTIVA');
    });

    it('una Liquidación nueva no debería tener referencia a otra anulada', () => {
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      expect(liquidacion.reemplazaA).toBeUndefined();
    });

    it('el estado debería formar parte del hash de integridad', () => {
      const { verificarIntegridad } = require('../calculo');
      const liquidacion = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      // Si alguien cambia el estado por fuera, la integridad debe romperse
      const manipulada = { ...liquidacion, estado: 'ANULADA' as const };

      expect(verificarIntegridad(manipulada)).toBe(false);
    });
  });

  // Anular y reemplazar
  describe('anularYReemplazar', () => {
    it('debería retornar dos liquidaciones: la original ANULADA y la nueva ACTIVA', () => {
      const { anularYReemplazar } = require('../calculo');
      const original = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      const resultadoCorregido: ResultadoCalculo = { ...resultadoMock, total: 18000 };

      const { anulada, nueva } = anularYReemplazar(original, resultadoCorregido);

      expect(anulada.id).toBe(original.id);
      expect(anulada.estado).toBe('ANULADA');

      expect(nueva.id).not.toBe(original.id);
      expect(nueva.estado).toBe('ACTIVA');
      expect(nueva.suscriptorId).toBe(original.suscriptorId);
      expect(nueva.resultado.total).toBe(18000);
      expect(nueva.reemplazaA).toBe(original.id);
    });

    it('la liquidación anulada debería mantener su integridad (hash recalculado válido)', () => {
      const { anularYReemplazar, verificarIntegridad } = require('../calculo');
      const original = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      const { anulada, nueva } = anularYReemplazar(original, { ...resultadoMock, total: 18000 });

      expect(verificarIntegridad(anulada)).toBe(true);
      expect(verificarIntegridad(nueva)).toBe(true);
    });

    it('ambas liquidaciones (anulada y nueva) deberían estar congeladas', () => {
      const { anularYReemplazar } = require('../calculo');
      const original = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      const { anulada, nueva } = anularYReemplazar(original, { ...resultadoMock, total: 18000 });

      expect(Object.isFrozen(anulada)).toBe(true);
      expect(Object.isFrozen(nueva)).toBe(true);
    });
  });

  //  Validaciones de reemplazo
  describe('validaciones de anularYReemplazar', () => {
    it('no debería permitir anular una liquidación que ya está ANULADA', () => {
      const { anularYReemplazar } = require('../calculo');
      const original = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      const { anulada } = anularYReemplazar(original, { ...resultadoMock, total: 18000 });

      expect(() => {
        anularYReemplazar(anulada, { ...resultadoMock, total: 19000 });
      }).toThrow(/ya.*ANULADA|estado.*invalid/i);
    });

    it('no debería permitir anular una liquidación con integridad rota', () => {
      const { anularYReemplazar } = require('../calculo');
      const original = crearLiquidacion({ suscriptorId: 'SUSC-001', resultado: resultadoMock });

      // Simulamos manipulación
      const manipulada = { ...original, suscriptorId: 'HACKER' } as Liquidacion;

      expect(() => {
        anularYReemplazar(manipulada, resultadoMock);
      }).toThrow(/integridad|tampering|hash/i);
    });
  });
});
