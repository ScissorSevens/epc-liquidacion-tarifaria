import { calcularLiquidacion, calcularBatch } from '../motor-tarifario';
import { EntradaCalculo } from '../types';

describe('Motor Tarifario CRA', () => {
  const parametrosBase: EntradaCalculo['parametros'] = {
    cargoFijo: 5000,
    precioM3: 800,
    precioM3Excedente: 1500,
    consumoBasico: 20,
  };

  describe('calculo de consumo y tarifa diferencial', () => {
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
      expect(resultado.cargoConsumo).toBe(12000);
      expect(resultado.cargoExcedente).toBe(0);
      expect(resultado.total).toBe(17000);
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
        lecturaActual: 125,
        parametros: parametrosBase,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.consumo).toBe(25);
      expect(resultado.consumoBasico).toBe(20);
      expect(resultado.consumoExcedente).toBe(5);
      expect(resultado.cargoConsumo).toBe(16000);      // 20 * 800
      expect(resultado.cargoExcedente).toBe(7500);     // 5 * 1500
      expect(resultado.total).toBe(28500);             // 5000 + 16000 + 7500
    });

    it('consumo exactamente en el limite basico no cobra excedente', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 120,
        parametros: parametrosBase,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.consumo).toBe(20);
      expect(resultado.consumoBasico).toBe(20);
      expect(resultado.consumoExcedente).toBe(0);
      expect(resultado.cargoConsumo).toBe(16000);
      expect(resultado.cargoExcedente).toBe(0);
      expect(resultado.total).toBe(21000);
    });

    it('consumo alto (100 m³) calcula correctamente basico y excedente', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 200,
        parametros: parametrosBase,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.consumo).toBe(100);
      expect(resultado.consumoBasico).toBe(20);
      expect(resultado.consumoExcedente).toBe(80);
      expect(resultado.cargoFijo).toBe(5000);
      expect(resultado.cargoConsumo).toBe(16000);      // 20 * 800
      expect(resultado.cargoExcedente).toBe(120000);   // 80 * 1500
      expect(resultado.total).toBe(141000);            // 5000 + 16000 + 120000
    });

    it('cargo fijo cero es valido (minimo vital Decreto 0776/2025)', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 110, // consumo = 10 m³
        parametros: { cargoFijo: 0, precioM3: 800, precioM3Excedente: 1500, consumoBasico: 20 },
        estrato: 1,
      };

      const resultado = calcularLiquidacion(entrada);

      // cargoConsumo = 10 * 800 = 8000, subsidio 70% = 5600
      expect(resultado.cargoFijo).toBe(0);
      expect(resultado.cargoConsumo).toBe(8000);
      expect(resultado.subsidio).toBe(5600);
      expect(resultado.total).toBe(2400);              // 0 + 8000 - 5600
    });

    it('redondea a pesos enteros cuando tarifas tienen decimales', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 107, // consumo = 7 m³
        parametros: {
          cargoFijo: 4350.60,
          precioM3: 823.45,
          precioM3Excedente: 1547.80,
          consumoBasico: 20,
        },
      };

      const resultado = calcularLiquidacion(entrada);

      // cargoConsumo = 7 * 823.45 = 5764.15
      // total = 4350.60 + 5764.15 = 10114.75 → redondeado a 10115
      expect(resultado.cargoConsumo).toBe(5764);       // Math.round(5764.15)
      expect(resultado.cargoFijo).toBe(4351);          // Math.round(4350.60)
      expect(resultado.total).toBe(10115);             // Math.round(total)
    });
  });

  describe('subsidio y contribucion por estrato', () => {
    it('sin estrato se comporta como estrato 4 (costo real)', () => {
      const conEstrato4: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 4,
      };
      const sinEstrato: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
      };

      const resultado4 = calcularLiquidacion(conEstrato4);
      const resultadoSin = calcularLiquidacion(sinEstrato);

      expect(resultadoSin.subsidio).toBe(resultado4.subsidio);
      expect(resultadoSin.contribucion).toBe(resultado4.contribucion);
      expect(resultadoSin.total).toBe(resultado4.total);
    });

    it('estrato 1 aplica subsidio del 70% sobre cargo fijo y consumo basico', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 1,
      };

      const resultado = calcularLiquidacion(entrada);

      // Base subsidiable: cargoFijo + cargoConsumo = 5000 + 12000 = 17000
      // Subsidio 70%: 17000 * 0.70 = 11900
      expect(resultado.subsidio).toBe(11900);
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(5100);              // 5000 + 12000 - 11900
    });

    it('estrato 2 aplica subsidio del 40% sobre cargo fijo y consumo basico', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 2,
      };

      const resultado = calcularLiquidacion(entrada);

      // Base subsidiable: 5000 + 12000 = 17000
      // Subsidio 40%: 17000 * 0.40 = 6800
      expect(resultado.subsidio).toBe(6800);
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(10200);             // 5000 + 12000 - 6800
    });

    it('estrato 4 paga costo real sin subsidio ni contribucion', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 4,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.subsidio).toBe(0);
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(17000);             // 5000 + 12000
    });

    it('estrato 6 aplica contribucion del 60% sobre cargo fijo y consumo total', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 6,
      };

      const resultado = calcularLiquidacion(entrada);

      // Base contribucion: cargoFijo + cargoConsumoTotal = 5000 + 12000 = 17000
      // Contribución 60%: 17000 * 0.60 = 10200
      expect(resultado.subsidio).toBe(0);
      expect(resultado.contribucion).toBe(10200);
      expect(resultado.total).toBe(27200);             // 5000 + 12000 + 10200
    });

    it('estrato 1 con consumo excedente aplica subsidio SOLO sobre fijo y basico', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 130,
        parametros: parametrosBase,
        estrato: 1,
      };

      const resultado = calcularLiquidacion(entrada);

      // cargoFijo = 5000, cargoConsumo = 20 * 800 = 16000 (subsidiable)
      // cargoExcedente = 10 * 1500 = 15000 (NO subsidiable)
      // Subsidio 70% de (5000 + 16000) = 70% de 21000 = 14700
      expect(resultado.consumo).toBe(30);
      expect(resultado.consumoBasico).toBe(20);
      expect(resultado.consumoExcedente).toBe(10);
      expect(resultado.cargoConsumo).toBe(16000);
      expect(resultado.cargoExcedente).toBe(15000);
      expect(resultado.subsidio).toBe(14700);
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(21300);             // 5000 + 16000 + 15000 - 14700
    });
  });

  describe('periodo de facturacion', () => {
    it('incluye periodo en el resultado cuando se proporciona en la entrada', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        periodo: { mes: 3, anio: 2025 },
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.periodo).toEqual({ mes: 3, anio: 2025 });
      expect(resultado.total).toBe(17000);
    });

    it('resultado sin periodo cuando no se proporciona (backwards compat)', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.periodo).toBeUndefined();
    });

    it('lanza error si mes es invalido (fuera de rango 1-12)', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        periodo: { mes: 13, anio: 2025 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('Mes debe ser un valor entre 1 y 12');
    });

    it('lanza error si mes es cero', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        periodo: { mes: 0, anio: 2025 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('Mes debe ser un valor entre 1 y 12');
    });

    it('lanza error si anio es menor a 2000', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        periodo: { mes: 6, anio: 1999 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('Anio debe ser mayor o igual a 2000');
    });
  });

  describe('validaciones de entrada', () => {
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

    it('lanza error si precio excedente es negativo', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: { cargoFijo: 5000, precioM3: 800, precioM3Excedente: -200, consumoBasico: 20 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('El precio excedente debe ser mayor a cero');
    });

    it('lanza error si precio excedente es cero', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: { cargoFijo: 5000, precioM3: 800, precioM3Excedente: 0, consumoBasico: 20 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('El precio excedente debe ser mayor a cero');
    });

    it('lanza error si consumo basico es negativo', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: { cargoFijo: 5000, precioM3: 800, precioM3Excedente: 1500, consumoBasico: -5 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('El consumo basico debe ser mayor a cero');
    });

    it('lanza error si consumo basico es cero', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: { cargoFijo: 5000, precioM3: 800, precioM3Excedente: 1500, consumoBasico: 0 },
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('El consumo basico debe ser mayor a cero');
    });

    it('lanza error si estrato es invalido (fuera de rango 1-6)', () => {
      const entrada = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 7 as any,
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('Estrato debe ser un valor entre 1 y 6');
    });

    it('lanza error si estrato es cero', () => {
      const entrada = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 0 as any,
      };

      expect(() => calcularLiquidacion(entrada)).toThrow('Estrato debe ser un valor entre 1 y 6');
    });
  });
});

describe('Liquidacion Batch', () => {
  const parametrosBase: EntradaCalculo['parametros'] = {
    cargoFijo: 5000,
    precioM3: 800,
    precioM3Excedente: 1500,
    consumoBasico: 20,
  };

  it('liquida multiples suscriptores en una sola llamada', () => {
    const entradas: EntradaCalculo[] = [
      { lecturaAnterior: 100, lecturaActual: 115, parametros: parametrosBase, estrato: 1 },
      { lecturaAnterior: 200, lecturaActual: 210, parametros: parametrosBase, estrato: 4 },
      { lecturaAnterior: 300, lecturaActual: 325, parametros: parametrosBase, estrato: 6 },
    ];

    const resultados = calcularBatch(entradas);

    expect(resultados).toHaveLength(3);
    // Estrato 1: subsidio 70% de (5000 + 12000) = 11900
    expect(resultados[0].subsidio).toBe(11900);
    expect(resultados[0].total).toBe(5100);
    // Estrato 4: sin subsidio ni contribución, consumo 10
    expect(resultados[1].subsidio).toBe(0);
    expect(resultados[1].total).toBe(13000);           // 5000 + 8000
    // Estrato 6: consumo 25 (20 basico + 5 excedente)
    // contribución 60% de (5000 + 16000 + 7500) = 60% de 28500 = 17100
    expect(resultados[2].contribucion).toBe(17100);
    expect(resultados[2].total).toBe(45600);           // 5000 + 16000 + 7500 + 17100
  });

  it('retorna array vacio cuando no hay entradas', () => {
    const resultados = calcularBatch([]);

    expect(resultados).toEqual([]);
  });

  it('cada resultado es independiente del resto', () => {
    const entradas: EntradaCalculo[] = [
      { lecturaAnterior: 100, lecturaActual: 115, parametros: parametrosBase },
      { lecturaAnterior: 100, lecturaActual: 115, parametros: parametrosBase },
    ];

    const resultados = calcularBatch(entradas);
    const individual = calcularLiquidacion(entradas[0]);

    expect(resultados[0]).toEqual(individual);
    expect(resultados[1]).toEqual(individual);
  });

  it('un error en una entrada no afecta las demas', () => {
    const entradas: EntradaCalculo[] = [
      { lecturaAnterior: 100, lecturaActual: 115, parametros: parametrosBase },
      { lecturaAnterior: 200, lecturaActual: 190, parametros: parametrosBase }, // ERROR: actual < anterior
      { lecturaAnterior: 300, lecturaActual: 310, parametros: parametrosBase },
    ];

    const resultados = calcularBatch(entradas);

    expect(resultados).toHaveLength(3);
    expect(resultados[0].total).toBe(17000);
    expect(resultados[1]).toHaveProperty('error');
    expect(resultados[2].total).toBe(13000);           // 5000 + 8000
  });
});
