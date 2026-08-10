/**
 * Wrapper `calcularLiquidacionConAmbito` — invoca gate `validarAmbito`
 * antes de delegar al motor puro `calcularLiquidacion`.
 *
 * Por qué existe como wrapper y no como parte de `calcularLiquidacion`:
 *   - El motor es pure function con 40 callers legacy (ver `grep` en
 *     commit anterior). Cambiar su firma para forzar `prestador`
 *     rompería toda la base.
 *   - El gate es de aplicación (Fase 4.x: `emitirFactura`,
 *     `bootstrapCompleto`), no de dominio puro. El motor
 *     `calcularLiquidacion` queda como función pura reusable.
 *   - Migrar todos los callers para que pasen `prestador` queda como
 *     tarea de Phase 4 (integración).
 *
 * Decisión documentada en `design.md` decisión 2 ("Gate validarAmbito
 * antes de liquidación como función wrapper").
 *
 * Cambio `param-tarifa-res-825-compliance-phase2` (task 2.8 GREEN).
 *
 * Task 4.8 (Fase 2): propaga `validacion_ambito` al metadata del
 * `ResultadoCalculo` retornado para que `emitirFactura` lo persista
 * en el snapshot. Sin esto, la auditoría regulatoria no podría
 * reconstruir el Subtítulo CRA aplicado al momento del cálculo.
 */

import { validarAmbito } from '../ambito-tarifario/validar-ambito';
import type {
  ParametrosTarifa,
  ResultadoCalculo,
  EntradaCalculo,
  SnapshotValidacionAmbito,
} from './types';
import type {
  AcuerdoMunicipal,
} from '../acuerdo-municipal';
import type { PrestadorAmbitoInfo } from '../ambito-tarifario/types';

const MENSAJES = {
  AMBITO_NO_APLICA: 'AMBITO_NO_APLICA: el prestador está fuera del ámbito de la metodología tarifaria configurada',
  AMBITO_INDETERMINADO: 'AMBITO_INDETERMINADO: cantidad de suscriptores del prestador no definida aún',
} as const;

/**
 * Proyecta `ResultadoAmbito` + `cantidad_suscriptores` del prestador
 * al type `SnapshotValidacionAmbito` snake_case (spec compliance).
 *
 * Es un helper puro: misma entrada → misma salida. Vive aqui (no en
 * `validar-ambito.ts`) porque es específico del contrato del snapshot,
 * no del resultado del gate.
 */
function proyectarValidacionAmbitoParaSnapshot(
  ambito: ReturnType<typeof validarAmbito>,
  cantidadSuscriptores: number | null,
): SnapshotValidacionAmbito {
  return {
    estado: ambito.estado,
    subtitulo: ambito.subtitulo,
    norma_aplicable: ambito.normaAplicable,
    // `motivo` = el campo `evidencia` del ResultadoAmbito. La spec
    // pide `motivo` (sin acentos, alcance regulatorio).
    motivo: ambito.evidencia,
    cantidad_suscriptores: cantidadSuscriptores,
    fecha_verificacion: ambito.fecha_verificacion,
  };
}

/**
 * Igual a `calcularLiquidacion` pero invoca `validarAmbito` antes.
 *
 * @param entrada            Entrada del cálculo (con `id_prestador`).
 * @param parametros          ParametrosTarifa del prestador.
 * @param acuerdo             Acuerdo Municipal (puede ser null).
 * @param prestador           Información mínima del prestador para gate.
 * @param fecha_emision       ISO 8601 de la fecha del cálculo (también
 *                            puede venir en `entrada.fecha_emision`).
 * @returns                   ResultadoCalculo inmutable. Su metadata
 *                            incluye `validacion_ambito` con
 *                            `estado='APLICA'` (gates NO_APLICA /
 *                            INDETERMINADO throw antes).
 * @throws                     Error con clave AMBITO_* si `validarAmbito`
 *                             retorna ≠APLICA.
 */
export function calcularLiquidacionConAmbito(
  entrada: EntradaCalculo & { fecha_emision?: string },
  parametros: ParametrosTarifa,
  acuerdo: AcuerdoMunicipal | null,
  prestador: PrestadorAmbitoInfo,
  fecha_emision?: string,
): ResultadoCalculo {
  const fecha = fecha_emision ?? entrada.fecha_emision ?? new Date().toISOString();
  const ambito = validarAmbito(prestador, fecha);

  if (ambito.estado === 'NO_APLICA') {
    throw new Error(`${MENSAJES.AMBITO_NO_APLICA} | evidencia: ${ambito.evidencia}`);
  }
  if (ambito.estado === 'INDETERMINADO') {
    throw new Error(`${MENSAJES.AMBITO_INDETERMINADO} | evidencia: ${ambito.evidencia}`);
  }

  // Lazy import para evitar ciclos entre módulos (motor ↔ ambito).
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { calcularLiquidacion } = require('./motor-tarifario');
  const resultado = calcularLiquidacion(entrada, parametros, acuerdo);
  // Patch del resultado para incluir `validacion_ambito` en metadata.
  // `ResultadoCalculo` es readonly (deep-frozen por el caller), pero
  // sus campos son planos — podemos reasignar `metadata` con spread
  // propio sin violar la inmutabilidad del resto.
  return {
    ...resultado,
    metadata: {
      ...resultado.metadata,
      validacion_ambito: proyectarValidacionAmbitoParaSnapshot(
        ambito,
        prestador.cantidad_suscriptores,
      ),
    },
  };
}
