/**
 * Importador de filas CSV a (Suscriptor, Medidor).
 *
 * Politica explicita (no aborta nunca):
 *  - Si `codigo` del suscriptor ya existe -> SKIP suscriptor, registrar
 *    motivo 'suscriptor_duplicado'. PERO igual intentar crear el medidor
 *    asociado al suscriptor existente (caso real: cliente registrado
 *    recibe un medidor adicional).
 *  - Si `numero_medidor` ya existe -> SKIP medidor, registrar motivo
 *    'medidor_duplicado'. El suscriptor SI se crea si era nuevo.
 *  - Cualquier excepcion durante persistencia (FK, CHECK constraint,
 *    validacion de dominio): se acumula en `errores` y se sigue con la
 *    proxima fila. NO romper el lote por una fila mala.
 *
 * Hexagonal: depende solo de los puertos `SuscriptorRepository` y
 * `MedidorRepository`, no de implementaciones SQLite. Asi se puede
 * testear con in-memory si quisieramos.
 *
 * Performance: sin transaccion explicita. Cada `crear()` del
 * adapter SQLite ya envuelve su INSERT. Para lotes grandes (>1000
 * filas) conviene envolver el bucle en una transaccion.
 */

import type { SuscriptorRepository, Suscriptor } from '../suscriptores';
import { crearSuscriptor } from '../suscriptores';
import type { MedidorRepository } from '../medidores';
import { crearMedidor } from '../medidores';
import type {
  ErrorImportacion,
  FilaCSV,
  ItemSaltado,
  ResultadoImportacion,
} from './types';

export async function importarSuscriptoresYMedidores(
  filas: ReadonlyArray<FilaCSV>,
  repoSus: SuscriptorRepository,
  repoMed: MedidorRepository,
): Promise<ResultadoImportacion> {
  let suscriptoresCreados = 0;
  let medidoresCreados = 0;
  const saltados: ItemSaltado[] = [];
  const errores: ErrorImportacion[] = [];

  // Obtener el max codigo actual para auto-generacion correlativa.
  const maxCodigoActual = await repoSus.maxCodigo();
  let contadorCodigo = maxCodigoActual ? Number.parseInt(maxCodigoActual, 10) : 0;

  for (const fila of filas) {
    let suscriptor: Suscriptor | null = null;

    // Resolver codigo: si viene del CSV (legacy) usarlo; si no, auto-generar.
    const codigo: string = fila.codigo !== undefined
      ? fila.codigo
      : (() => { contadorCodigo++; return String(contadorCodigo).padStart(4, '0'); })();

    const numero_medidor: string = fila.numero_medidor ?? `MED-${codigo}`;

    // --- Suscriptor ---
    try {
      const previo = await repoSus.buscarPorCodigo(codigo);
      if (previo) {
        suscriptor = previo;
        saltados.push({
          linea: fila.linea,
          motivo: 'suscriptor_duplicado',
          codigo,
        });
      } else {
        const borrador = crearSuscriptor({
          codigo,
          nombre_apellidos: fila.nombre_apellidos,
          cedula: fila.cedula ?? '',
          municipio: fila.municipio ?? '',
          ...(fila.sector !== undefined && { sector: fila.sector }),
          direccion: fila.direccion,
          estrato: fila.estrato as Suscriptor['estrato'],
          aplica_subsidio: fila.aplica_subsidio ?? false,
          id_prestador: 0,
          categoria_uso: 'residencial',
          ...(fila.matricula_inmobiliaria
            ? { matricula_inmobiliaria: fila.matricula_inmobiliaria }
            : {}),
          ...(fila.numero_catastral
            ? { numero_catastral: fila.numero_catastral }
            : {}),
          estado: 'activo',
        });
        suscriptor = await repoSus.crear(borrador);
        suscriptoresCreados++;
      }
    } catch (e) {
      errores.push({
        linea: fila.linea,
        mensaje: `error al crear suscriptor '${codigo}': ${e instanceof Error ? e.message : String(e)}`,
      });
      // Sin suscriptor no podemos asociar medidor; pasamos a la siguiente fila.
      continue;
    }

    // --- Medidor ---
    try {
      const medPrevio = await repoMed.buscarPorNumero(numero_medidor);
      if (medPrevio) {
        saltados.push({
          linea: fila.linea,
          motivo: 'medidor_duplicado',
          numero_medidor,
        });
        continue;
      }
      await repoMed.crear(
        crearMedidor({
          numero_medidor,
          id_suscriptor: suscriptor.id_suscriptor,
          fecha_instalacion: fila.fecha_instalacion,
          estado: 'activo',
          ...(fila.observaciones_medidor
            ? { observaciones: fila.observaciones_medidor }
            : {}),
        }),
      );
      medidoresCreados++;
    } catch (e) {
      errores.push({
        linea: fila.linea,
        mensaje: `error al crear medidor '${numero_medidor}': ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return { suscriptoresCreados, medidoresCreados, saltados, errores };
}
