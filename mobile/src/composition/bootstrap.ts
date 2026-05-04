// Composition root para la app móvil.
//
// Por ahora, los bootstraps SQLite del dominio (crearBootstrapFacturaSqlite,
// crearBootstrapLecturaSqlite, crearBootstrapColaSqlite) usan better-sqlite3,
// que es Node-only y NO funciona en React Native. Cuando se implementen
// adapters compatibles con expo-sqlite, este bootstrap los va a cablear.
//
// Mientras tanto importamos solo del dominio puro (motor-tarifario) para
// validar que el path mapping y la importación funcionan extremo a extremo.

import { calcularLiquidacion } from '@dominio/motor-tarifario';
import type { EntradaCalculo } from '@dominio/motor-tarifario';

export interface ResultadoBootstrap {
  estado: 'OK' | 'ERROR';
  mensaje: string;
  timestamp: string;
  smokeMotorTarifario?: {
    consumoM3: number;
    totalCalculado: number;
  };
}

/**
 * Inicializa el dominio para la app móvil y corre un smoke test del motor
 * tarifario para confirmar que el wiring funciona en runtime (no solo en
 * tipos). Devuelve un objeto serializable para mostrarlo en pantalla.
 */
export function bootstrapApp(): ResultadoBootstrap {
  try {
    // Smoke test: liquidación trivial con parámetros mínimos.
    // No depende de persistencia, sólo de la función pura del dominio.
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
      mensaje: 'MediApp - Dominio cargado correctamente',
      timestamp: new Date().toISOString(),
      smokeMotorTarifario: {
        consumoM3: resultado.consumo,
        totalCalculado: resultado.total,
      },
    };
  } catch (error) {
    return {
      estado: 'ERROR',
      mensaje: `Falló el bootstrap del dominio: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }
}
