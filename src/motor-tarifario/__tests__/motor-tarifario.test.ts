import { calcularLiquidacion } from '../motor-tarifario';
import { EntradaCalculo } from '../types';

describe('Motor Tarifario CRA', () => {
  const parametrosBase: EntradaCalculo['parametros'] = {
    cargoFijo: 5000,
    precioM3: 800,
    consumoBasico: 20,
  };

  it('debería lanzar error hasta que sea implementado', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 115,
      parametros: parametrosBase,
    };
    expect(() => calcularLiquidacion(entrada)).toThrow('Not implemented');
  });
});
