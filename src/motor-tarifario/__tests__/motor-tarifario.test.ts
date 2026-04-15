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
});
