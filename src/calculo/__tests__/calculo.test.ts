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
});
