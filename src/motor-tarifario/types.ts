/**
 * Tipos del motor tarifario CRA
 * Resolución CRA 688 de 2014 y actualizaciones
 */

export interface ParametrosTarifa {
  cargoFijo: number;          // Cargo fijo mensual en pesos
  precioM3: number;           // Precio por m³ dentro del consumo básico
  precioM3Excedente: number;  // Precio por m³ que exceda el consumo básico
  consumoBasico: number;      // Consumo básico en m³ (umbral)
}

export type Estrato = 1 | 2 | 3 | 4 | 5 | 6;

export interface EntradaCalculo {
  lecturaAnterior: number;  // Lectura anterior del medidor en m³
  lecturaActual: number;    // Lectura actual del medidor en m³
  parametros: ParametrosTarifa;
  estrato?: Estrato;        // Estrato socioeconómico (1-6), opcional para backwards compat
}

export interface ResultadoCalculo {
  consumo: number;              // Consumo del periodo en m³
  consumoBasico: number;        // m³ cobrados a tarifa básica
  consumoExcedente: number;     // m³ cobrados a tarifa excedente
  cargoFijo: number;            // Cargo fijo aplicado
  cargoConsumo: number;         // Cargo por consumo básico
  cargoExcedente: number;       // Cargo por consumo excedente
  subsidio: number;             // Monto subsidiado (estratos 1-3)
  contribucion: number;         // Monto contribución (estratos 5-6)
  total: number;                // Total a facturar
}
