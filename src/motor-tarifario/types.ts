/**
 * Tipos del motor tarifario CRA
 * Resolución CRA 688 de 2014 y actualizaciones
 */

export interface ParametrosTarifa {
  cargoFijo: number;       // Cargo fijo mensual en pesos
  precioM3: number;        // Precio por metro cúbico en pesos
  consumoBasico: number;   // Consumo básico en m³ (umbral subsidiado)
}

export interface EntradaCalculo {
  lecturaAnterior: number;  // Lectura anterior del medidor en m³
  lecturaActual: number;    // Lectura actual del medidor en m³
  parametros: ParametrosTarifa;
}

export interface ResultadoCalculo {
  consumo: number;          // Consumo del periodo en m³
  cargoFijo: number;        // Cargo fijo aplicado
  cargoConsumo: number;     // Cargo por consumo (consumo × precioM3)
  total: number;            // Total a facturar
}
