import { calcularLiquidacion } from '../motor-tarifario';
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
  });

  describe('subsidio y contribucion por estrato', () => {
    it('estrato 1 aplica subsidio del 70% sobre cargo consumo', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 1,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.subsidio).toBe(8400);           // 12000 * 0.70
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(8600);              // 5000 + 12000 - 8400
    });

    it('estrato 2 aplica subsidio del 40% sobre cargo consumo', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 2,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.subsidio).toBe(4800);           // 12000 * 0.40
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(12200);             // 5000 + 12000 - 4800
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

    it('estrato 6 aplica contribucion del 60% sobre cargo consumo', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 115,
        parametros: parametrosBase,
        estrato: 6,
      };

      const resultado = calcularLiquidacion(entrada);

      expect(resultado.subsidio).toBe(0);
      expect(resultado.contribucion).toBe(7200);       // 12000 * 0.60
      expect(resultado.total).toBe(24200);             // 5000 + 12000 + 7200
    });

    it('estrato 1 con consumo excedente aplica subsidio sobre basico y excedente', () => {
      const entrada: EntradaCalculo = {
        lecturaAnterior: 100,
        lecturaActual: 130,
        parametros: parametrosBase,
        estrato: 1,
      };

      const resultado = calcularLiquidacion(entrada);

      // cargoConsumoTotal = (20 * 800) + (10 * 1500) = 31000
      // Subsidio 70%: 31000 * 0.70 = 21700
      expect(resultado.consumo).toBe(30);
      expect(resultado.consumoBasico).toBe(20);
      expect(resultado.consumoExcedente).toBe(10);
      expect(resultado.cargoConsumo).toBe(16000);
      expect(resultado.cargoExcedente).toBe(15000);
      expect(resultado.subsidio).toBe(21700);
      expect(resultado.contribucion).toBe(0);
      expect(resultado.total).toBe(14300);             // 5000 + 31000 - 21700
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
  });
});
