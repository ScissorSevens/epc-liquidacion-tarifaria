/**
 * Validación pura del form `ParametrosTarifa`.
 *
 * Cleanup F3 del verify-report de `parametros-tarifa-screen-decomposition`:
 * extraer `validarTodo()` (60+ lineas inline en `useParametrosFormState.ts`)
 * a un módulo puro testeable en aislamiento. La función del hook
 * queda como un thin wrapper de 1 linea que pasa los values.
 *
 * No toca React, ni el ciclo de vida, ni el state. Recibe un subset
 * del form (los campos que necesitan validación) y retorna `FormErrors`.
 *
 * Reglas implementadas (mantienen el contrato exacto del código inline
 * original para no romper los tests existentes):
 *   - Res CRA 825/2017 Art. 15: CMA minimo por servicio (acueducto).
 *   - Res CRA 825/2017 Art. 18: CMOG minimo por servicio (acueducto).
 *   - Suscriptores > 0 (defensa anti division por cero).
 *   - Vigente desde NO posterior a vigente hasta.
 *   - URLs validas http(s) en acto_adopcion y documento_soporte_url
 *     (opcionales: empty se permite, se valida solo si hay contenido).
 *   - Res CRA 825/2017 Art. 11: Indexación IPC con años > 2000 + factor > 0.
 *
 * Servicio hardcoded 'acueducto' (Hallazgo #6 del audit deferred:
 * la app solo cubre acueducto por ahora). Multi-servicio es mejora
 * futura.
 */

import { validarCmaMinimo, validarCmogMinimo } from '../../../../dominio/parametros-tarifa';
import { parseEntero } from './parse-numeric';
import type { FormErrors } from '../../../componentes/scroll-to-first-error';

/**
 * Subset de los FormValues que la validación necesita.
 *
 * Solo los 11 campos que tienen reglas de validación (CMA, CMOG,
 * suscriptores, fechas de vigencia, URLs, IPC). El resto (periodo,
 * cmi, cmt, cmviaa, altitud, etc.) se persisten sin validación
 * inline porque su tipo lo garantiza (numeric strings, switch
 * boolean, etc.).
 */
export interface ParametrosFormValidationInput {
  readonly cma: string;
  readonly cmo: string;
  readonly suscriptoresPromedio: string;
  readonly vigenteDesde: string;
  readonly vigenteHasta: string;
  readonly actoAdopcion: string;
  readonly documentoSoporteUrl: string;
  readonly anioBase: string;
  readonly anioDestino: string;
  readonly factorIpc: string;
  readonly ipufIndice: string;
}

/**
 * Validador de URL http(s). Empty input retorna `true` (campo opcional,
 * la validación a nivel callsite salta el chequeo). Matchea exactamente
 * la regex original de `ParametrosTarifa.tsx`:
 *   `/^https?:\/\/[^\s/$.?#].[^\s]*$/i`
 */
export function esUrlValida(s: string): boolean {
  if (s === '') return true;
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s);
}

/**
 * Validación pura del form. Retorna `FormErrors` (objeto vacío si OK).
 *
 * Cada regla documenta el articulo normativo que la origina. Las
 * funciones de dominio (`validarCmaMinimo`, `validarCmogMinimo`)
 * THROW en error — se envuelven en try/catch para poblar el campo
 * correspondiente del FormErrors. Esto preserva el contrato del
 * diseño original (D4 hallazgo crítico del design):
 *   "la función THROWS, no retorna string — D4 hallazgo crítico
 *    del design".
 */
export function validarParametrosForm(
  input: ParametrosFormValidationInput,
): FormErrors {
  const errors: FormErrors = {};
  const cmaNum = parseFloat(input.cma);
  const cmoNum = parseFloat(input.cmo);

  // Res CRA 825/2017 Art. 15: CMA minimo por servicio.
  try {
    validarCmaMinimo(cmaNum, 'acueducto');
  } catch (e) {
    errors.cma = (e as Error).message;
  }
  // Res CRA 825/2017 Art. 18: CMOG minimo por servicio.
  try {
    validarCmogMinimo(cmoNum, 'acueducto');
  } catch (e) {
    errors.cmo = (e as Error).message;
  }

  // Suscriptores > 0 (defensa anti division por cero).
  if (parseEntero(input.suscriptoresPromedio) <= 0) {
    errors.suscriptores = 'Suscriptores debe ser > 0';
  }
  // Vigente desde NO puede ser posterior a vigente hasta.
  if (
    input.vigenteDesde !== '' &&
    input.vigenteHasta !== '' &&
    input.vigenteDesde > input.vigenteHasta
  ) {
    errors.vigenteHasta = 'Vigente hasta debe ser posterior a vigente desde';
  }
  // URLs validas en acto_adopcion y documento_soporte_url (opcionales).
  if (input.actoAdopcion.trim() !== '' && !esUrlValida(input.actoAdopcion.trim())) {
    errors.actoAdopcion = 'Debe ser una URL válida (http:// o https://)';
  }
  if (
    input.documentoSoporteUrl.trim() !== '' &&
    !esUrlValida(input.documentoSoporteUrl.trim())
  ) {
    errors.documentoSoporteUrl = 'Debe ser una URL válida (http:// o https://)';
  }

  // Res CRA 825/2017 Art. 11: Indexacion IPC.
  //   - Años > 2000 (sanity check, no permite indices anormales).
  //   - Factor > 0 (multiplicador no puede ser 0 ni negativo).
  const anioBaseNum = parseEntero(input.anioBase);
  const anioDestinoNum = parseEntero(input.anioDestino);
  const factorIpcNum = parseFloat(input.factorIpc);
  const ipufIndiceNum = parseFloat(input.ipufIndice);
  if (anioBaseNum <= 2000) {
    errors.anioBase = 'Anio base debe ser > 2000';
  }
  if (anioDestinoNum <= 2000) {
    errors.anioDestino = 'Anio destino debe ser > 2000';
  }
  if (Number.isNaN(factorIpcNum) || factorIpcNum <= 0) {
    errors.factorIpc = 'Factor IPC debe ser > 0';
  }
  if (Number.isNaN(ipufIndiceNum) || ipufIndiceNum <= 0) {
    errors.ipufIndice = 'IPUF indice debe ser > 0';
  }
  return errors;
}
