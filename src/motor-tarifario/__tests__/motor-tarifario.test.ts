import { calcularLiquidacion } from '../motor-tarifario';
import { EntradaCalculo } from '../types';

describe('Motor Tarifario CRA', () => {
  const parametrosBase: EntradaCalculo['parametros'] = {
    cargoFijo: 5000,
    precioM3: 800,
    precioM3Excedente: 1500,
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
    expect(resultado.consumoBasico).toBe(15);
    expect(resultado.consumoExcedente).toBe(0);
    expect(resultado.cargoFijo).toBe(5000);
    expect(resultado.cargoConsumo).toBe(12000);    // 15 * 800
    expect(resultado.cargoExcedente).toBe(0);
    expect(resultado.total).toBe(17000);            // 5000 + 12000
  });

  it('consumo cero cobra solo cargo fijo', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 200,
      lecturaActual: 200,
      parametros: parametrosBase,
    };

    const resultado = calcularLiquidacion(entrada);

    expect(resultado.consumo).toBe(0);
    expect(resultado.consumoBasico).toBe(0);
    expect(resultado.consumoExcedente).toBe(0);
    expect(resultado.cargoConsumo).toBe(0);
    expect(resultado.cargoExcedente).toBe(0);
    expect(resultado.total).toBe(5000);
  });

  it('cobra tarifa excedente cuando supera consumo basico', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 125, // consumo = 25, excedente = 5
      parametros: parametrosBase,
    };

    const resultado = calcularLiquidacion(entrada);

    expect(resultado.consumo).toBe(25);
    expect(resultado.consumoBasico).toBe(20);       // primeros 20 m³
    expect(resultado.consumoExcedente).toBe(5);      // 5 m³ de más
    expect(resultado.cargoConsumo).toBe(16000);      // 20 * 800
    expect(resultado.cargoExcedente).toBe(7500);     // 5 * 1500
    expect(resultado.total).toBe(28500);             // 5000 + 16000 + 7500
  });

  it('consumo exactamente en el limite basico no cobra excedente', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 120, // consumo = 20 = consumoBasico exacto
      parametros: parametrosBase,
    };

    const resultado = calcularLiquidacion(entrada);

    expect(resultado.consumo).toBe(20);
    expect(resultado.consumoBasico).toBe(20);
    expect(resultado.consumoExcedente).toBe(0);
    expect(resultado.cargoConsumo).toBe(16000);      // 20 * 800
    expect(resultado.cargoExcedente).toBe(0);
    expect(resultado.total).toBe(21000);             // 5000 + 16000
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

  it('lanza error si cargo fijo es negativo', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 115,
      parametros: { cargoFijo: -1000, precioM3: 800, precioM3Excedente: 1500, consumoBasico: 20 },
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('El cargo fijo no puede ser negativo');
  });

  it('lanza error si precio por m3 es negativo', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 115,
      parametros: { cargoFijo: 5000, precioM3: -500, precioM3Excedente: 1500, consumoBasico: 20 },
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('El precio por m3 debe ser mayor a cero');
  });

  it('lanza error si precio por m3 es cero', () => {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 100,
      lecturaActual: 115,
      parametros: { cargoFijo: 5000, precioM3: 0, precioM3Excedente: 1500, consumoBasico: 20 },
    };

    expect(() => calcularLiquidacion(entrada)).toThrow('El precio por m3 debe ser mayor a cero');
  });
});
