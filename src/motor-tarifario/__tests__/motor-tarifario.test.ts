import { calcularLiquidacion } from '../motor-tarifario';
import { EntradaCalculo } from '../types';

describe('Motor Tarifario CRA', () => {
  const parametrosBase: EntradaCalculo['parametros'] = {
    cargoFijo: 5000,
    precioM3: 800,
    consumoBasico: 20,
  };

  it('calcula consumo y total con parámetros básicos', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 115,
      parametros: parametrosBase,
    };

    const resultado = calcularLiquidacion(entrada);

    expect(resultado.consumo).toBe(15);
    expect(resultado.cargoFijo).toBe(5000);
    expect(resultado.cargoConsumo).toBe(12000); // 15 * 800
    expect(resultado.total).toBe(17000);         // 5000 + 12000
  });

  it('consumo cero cobra solo cargo fijo', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 200,
      lecturaActual: 200,
      parametros: parametrosBase,
    };

    const resultado = calcularLiquidacion(entrada);

    expect(resultado.consumo).toBe(0);
    expect(resultado.cargoConsumo).toBe(0);
    expect(resultado.total).toBe(5000); // solo cargo fijo
  });

  it('lanza error si lectura actual es menor que anterior', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 90,
      parametros: parametrosBase,
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('Lectura actual no puede ser menor que la anterior');
  });

  it('lanza error si lectura anterior es negativa', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: -5,
      lecturaActual: 10,
      parametros: parametrosBase,
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('Las lecturas no pueden ser negativas');
  });

  it('lanza error si lectura actual es negativa', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 10,
      lecturaActual: -3,
      parametros: parametrosBase,
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('Las lecturas no pueden ser negativas');
  });
});
