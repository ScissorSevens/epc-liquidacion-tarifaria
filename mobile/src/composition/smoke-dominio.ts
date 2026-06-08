// Smoke del dominio puro para la app movil.
//
// Esta funcion es Node-importable (no toca expo-sqlite ni APIs nativas)
// y la usa el wiring test del root para confirmar que el path mapping
// `@dominio/*` resuelve correctamente desde mobile/. Tambien la consume
// el bootstrap real en runtime para validar que el motor tarifario esta
// disponible antes de cablear las repos SQLite.

import { calcularLiquidacion } from '@dominio/motor-tarifario';
import type { EntradaCalculo } from '@dominio/motor-tarifario';

export interface ResultadoSmokeDominio {
  estado: 'OK' | 'ERROR';
  mensaje: string;
  timestamp: string;
  smokeMotorTarifario?: {
    consumoM3: number;
    totalCalculado: number;
  };
}

/**
 * Corre un calculo trivial del motor tarifario para confirmar que el
 * wiring del dominio funciona en runtime (no solo en tipos). Devuelve
 * un objeto serializable para mostrar en `Alert.alert` en RN.
 */
export function smokeDominio(): ResultadoSmokeDominio {
  try {
    const entrada: EntradaCalculo = {
      lecturaAnterior: 1000,
      lecturaActual: 1015,
      estrato: 3,
      parametros: {
        cargoFijo: 5000,
        precioM3: 1500,
        precioM3Excedente: 3000,
        consumoBasico: 20,
      },
    };
    const resultado = calcularLiquidacion(entrada);

    return {
      estado: 'OK',
      mensaje: 'AquaServices - Dominio cargado correctamente',
      timestamp: new Date().toISOString(),
      smokeMotorTarifario: {
        consumoM3: resultado.consumo,
        totalCalculado: resultado.total,
      },
    };
  } catch (error) {
    return {
      estado: 'ERROR',
      mensaje: `Fallo el smoke del dominio: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }
}
