/**
 * Motor tarifario conforme a Res CRA 825/2017 (arts. 9-10) mod. por
 * Res CRA 907/2019 art. 14. Multi-tenant con FK id_prestador.
 *
 * Pure function: NO accede a storage ni globals. El caller
 * (`liquidarLectura`, `bootstrap`) resuelve `ParametrosTarifa` y
 * `AcuerdoMunicipal` vigentes del prestador y los pasa como
 * argumentos.
 *
 * Fórmulas (art. 9 y art. 10 Res 825/2017 + art. 14 Res 907/2019):
 *   CFac         = CMAac / Nac                            (art. 9)
 *   ASPac        = max(ASac - IPUF * 12 * Nac, 1)         (art. 17, 19)
 *   CCac_unit    = (CMOac + CMIac + CMTac) / ASPac
 *                  + (aplica_cmviaa ? cmviaa : 0)         (art. 10 mod 907/2019)
 *   CCac_total   = CCac_unit * consumo_efectivo_m3
 *   consumo_ef   = aplica_minimo_vital && residencial
 *                  ? max(0, consumo - m3_gratis)
 *                  : consumo
 *   factor       = AcuerdoMunicipal[strato]
 *                  capeado a topes L142/1994 art. 99.6
 *   total        = CFac + CCac_total - subsidio + contribucion
 *
 * Reglas por categoría de uso (Q10 spec):
 *   - residencial: subsidios E1-E3 o contribuciones E5-E6 según Acuerdo
 *   - comercial:   SOLO contribución del Acuerdo (factor_contribucion_comercial)
 *   - industrial:  SOLO contribución del Acuerdo (factor_contribucion_industrial)
 *   - oficial:     factor 0 (tarifa plena)
 *   - especial:    alias de residencial
 *
 * Topes legales L142/1994 art. 99.6 (aplicados por caparFactorEstrato):
 *   E1 ∈ [-1.0, -0.60]   E5 ∈ [0, +0.50]
 *   E2 ∈ [-1.0, -0.50]   E6 ∈ [0, +0.60]
 *   E3 ∈ [-1.0, -0.40]
 *   E4 = 0
 */

import type {
  AcuerdoMunicipal,
  BloqueConsumo,
  CategoriaUso,
  EntradaCalculo,
  Estrato,
  MetadataCalculo,
  ParametrosTarifa,
  ResultadoCalculo,
} from './types';
import { aplicarConsumoBasico } from './consumo-basico';

/** Topes legales L142/1994 art. 99.6 — referencia normativa. */
export const TOPES_NACIONALES = {
  SUBSIDIO: { 1: -0.60, 2: -0.50, 3: -0.40 } as const,
  CONTRIBUCION: { 5: +0.50, 6: +0.60 } as const,
} as const;

/**
 * Cap al tope nacional L142/1994 art. 99.6 según estrato. Si el factor
 * del Acuerdo está dentro del rango legal, se respeta. Si excede
 * (más subsidio o más contribución que el tope), se capa al tope y
 * el caller puede detectar la violación leyendo
 * `resultado.metadata.factor_capeado`.
 *
 * Comercial/industrial/oficial NO se capan (sus factores vienen del
 * Acuerdo con DEFAULT en schema, no del tope).
 */
export function caparFactorEstrato(
  factor: number,
  estrato: Estrato,
  categoria: CategoriaUso,
): number {
  if (categoria === 'comercial' || categoria === 'industrial' || categoria === 'oficial') {
    return factor;
  }
  if (estrato === 1) return Math.max(factor, TOPES_NACIONALES.SUBSIDIO[1]);
  if (estrato === 2) return Math.max(factor, TOPES_NACIONALES.SUBSIDIO[2]);
  if (estrato === 3) return Math.max(factor, TOPES_NACIONALES.SUBSIDIO[3]);
  if (estrato === 4) return 0;
  if (estrato === 5) return Math.min(factor, TOPES_NACIONALES.CONTRIBUCION[5]);
  if (estrato === 6) return Math.min(factor, TOPES_NACIONALES.CONTRIBUCION[6]);
  throw new Error(`Estrato fuera de rango 1-6: ${estrato}`);
}

/**
 * Determina el factor a aplicar según categoría + estrato + Acuerdo.
 * Capea a topes L142/1994 art. 99.6.
 */
export function calcularFactor(
  estrato: Estrato,
  categoria: CategoriaUso,
  acuerdo: AcuerdoMunicipal | null,
): { factor: number; capeado: boolean } {
  // Oficial: tarifa plena, factor 0
  if (categoria === 'oficial') {
    return { factor: 0, capeado: false };
  }

  // Comercial: SOLO contribución comercial del Acuerdo
  if (categoria === 'comercial') {
    const f = acuerdo?.factor_contribucion_comercial ?? 0.50;
    return { factor: f, capeado: false };
  }

  // Industrial: SOLO contribución industrial del Acuerdo
  if (categoria === 'industrial') {
    const f = acuerdo?.factor_contribucion_industrial ?? 0.30;
    return { factor: f, capeado: false };
  }

  // Residencial / Especial: subsidios por estrato o topes nacionales
  if (categoria === 'residencial' || categoria === 'especial') {
    let factorAcuerdo: number;
    if (estrato === 1) factorAcuerdo = acuerdo?.factor_subsidio_e1 ?? TOPES_NACIONALES.SUBSIDIO[1];
    else if (estrato === 2) factorAcuerdo = acuerdo?.factor_subsidio_e2 ?? TOPES_NACIONALES.SUBSIDIO[2];
    else if (estrato === 3) factorAcuerdo = acuerdo?.factor_subsidio_e3 ?? TOPES_NACIONALES.SUBSIDIO[3];
    else if (estrato === 4) return { factor: 0, capeado: false };
    else if (estrato === 5) factorAcuerdo = acuerdo?.factor_contribucion_e5 ?? TOPES_NACIONALES.CONTRIBUCION[5];
    else if (estrato === 6) factorAcuerdo = acuerdo?.factor_contribucion_e6 ?? TOPES_NACIONALES.CONTRIBUCION[6];
    else throw new Error(`Estrato fuera de rango 1-6: ${estrato}`);

    const capeado = caparFactorEstrato(factorAcuerdo, estrato, categoria);
    return { factor: capeado, capeado: capeado !== factorAcuerdo };
  }

  throw new Error(`Categoría no soportada: ${categoria}`);
}

/**
 * Calcula Cargo por Consumo unitario ($/m³) según Res 825/2017 art. 10
 * modificado por Res 907/2019 art. 14.
 *
 * ASP (denominador) corrige el agua total a nivel prestador por pérdidas
 * estándar IPUF=6 m³/suscriptor/mes × 12 meses × N suscriptores
 * (art. 17, 19 Res 825/2017). NO multiplica el consumo individual.
 *
 * @deprecated Mantener por dos razones regulatorias/operativas (Decisión 6
 *   del design `param-tarifa-res-825-compliance-phase2`):
 *
 *   1. **Rompe tests**: 2 tests de `motor-tarifario.test.ts:423-443`
 *      verifican esta función directamente. Eliminarla rompe la suite.
 *
 *   2. **Auditoría histórica**: el motor principal usa
 *      `parametros.cargo_consumo_resultante` PRE-CALCULADO al guardar
 *      (ver `motor-tarifario.ts:217-228` y `calcular.ts`). Esta función
 *      queda como referencia legacy del cálculo "live" original; reescribirla
 *      o cambiar su firma alteraría el cálculo histórico documentado en
 *      commits previos.
 *
 *   En código NUEVO, usar `calcularLiquidacion` que ya consume el CC
 *   pre-calculado. NO eliminar esta función ni cambiar su firma.
 */
export function calcularCCUnitario(parametros: ParametrosTarifa): number {
  if (!parametros.suscriptores_promedio || parametros.suscriptores_promedio <= 0) {
    throw new Error('ParametrosTarifa.suscriptores_promedio requerido y > 0');
  }
  const perdidas = parametros.ipuf_m3_suscriptor_mes * 12 * parametros.suscriptores_promedio;
  const asp = Math.max(parametros.agua_suministrada_m3_anio - perdidas, 1);

  const costoVariableBase = parametros.cmo + parametros.cmi + parametros.cmt;
  const costoAmbiental = parametros.aplica_cmviaa && parametros.cmviaa > 0
    ? parametros.cmviaa
    : 0;

  return costoVariableBase / asp + costoAmbiental;
}

/**
 * Aplica mínimo vital (descuento m³ antes del cálculo) si corresponde.
 * Solo aplica a categoría residencial. Si flag es false o m3_gratis es 0,
 * retorna el consumo sin modificar.
 */
export function aplicarMinimoVital(
  consumo: number,
  parametros: ParametrosTarifa,
  categoria: CategoriaUso,
): number {
  if (!parametros.aplica_minimo_vital) return consumo;
  if (parametros.m3_gratis_minimo_vital <= 0) return consumo;
  if (categoria !== 'residencial') return consumo;
  return Math.max(0, consumo - parametros.m3_gratis_minimo_vital);
}

/**
 * FUNCIÓN PRINCIPAL: pure function, determinista.
 *
 * Recibe `ParametrosTarifa` y `AcuerdoMunicipal` vigentes del
 * prestador (caller los resuelve). NO accede a storage.
 *
 * Para la misma entrada + parametros + acuerdo, retorna el mismo
 * ResultadoCalculo bit-exact (escenario spec 21: 100 invocaciones
 * idénticas → outputs idénticos).
 */
export function calcularLiquidacion(
  entrada: EntradaCalculo,
  parametros: ParametrosTarifa,
  acuerdo: AcuerdoMunicipal | null,
): ResultadoCalculo {
  // 1. Validaciones tempranas
  if (!parametros) {
    throw new Error('ParametrosTarifa requerido, no usar fallback');
  }
  if (parametros.id_prestador !== entrada.id_prestador) {
    throw new Error(
      `Parametros.id_prestador (${parametros.id_prestador}) ≠ entrada.id_prestador (${entrada.id_prestador})`,
    );
  }
  if (entrada.estrato < 1 || entrada.estrato > 6) {
    throw new Error(`Estrato fuera de rango 1-6: ${entrada.estrato}`);
  }
  if (entrada.consumo_m3 < 0) {
    throw new Error('consumo_m3 no puede ser negativo');
  }

  // Gate `acuerdo.estado` — solo ACTIVO aplica factores del Acuerdo.
  // Cambio `param-tarifa-res-825-compliance-phase2` (task 2.10 GREEN).
  //
  // Backward-compat: Acuerdo legacy del 04-08 NO seteaba `estado`
  // (era opcional). El check SKIP si el campo NO está definido
  // explícitamente, asumiendo ACTIVO. Esto evita romper los 40 callers
  // que no setean el campo.
  //
  // Si el campo está definido y ≠ 'ACTIVO' (BORRADOR, VENCIDO,
  // DEROGADO), el motor lanza error. La capa de aplicación
  // (`emitirFactura`) debe capturar este error, registrar el
  // incidente en metadata y decidir si degrada a warning (usa
  // topes L142) o bloquea (factor 0) — alineado con guía §10.1.
  if (acuerdo !== null && acuerdo.estado !== undefined && acuerdo.estado !== 'ACTIVO') {
    throw new Error(
      `ACUERDO_NO_ACTIVO: el Acuerdo Municipal está en estado '${acuerdo.estado}' (id_acuerdo=${acuerdo.id_acuerdo}). ` +
        `Solo AcuerdoMunicipal.estado='ACTIVO' aplica factores de subsidio/contribución. ` +
        `Active el Acuerdo cargando acto_administrativo_url antes de liquidar.`,
    );
  }

  // 2. Cargo Fijo (Art. 9 Res CRA 825/2017)
  //    Usa cargo_fijo_resultante PRE-CALCULADO al guardar (calcular.ts:101).
  //    Si recalculáramos CMA/N acá, cualquier modificación retroactiva de
  //    metodología tarifaria invalidaría facturas históricas (key insight:
  //    "future methodology changes don't break historic facturas").
  const cargoFijo = Math.round(parametros.cargo_fijo_resultante);

  // 3. Cargo por Consumo unitario + aplicación al consumo del usuario
  //    Mismo principio: usa cargo_consumo_resultante PRE-CALCULADO
  //    (calcular.ts:114). NO recalcula con CCUnitario()/ASP — eso
  //    cambiaría el CC_unit cada vez que cambien CMO/CMI/CMT en el admin,
  //    rompiendo la auditoría histórica.
  const ccUnitario = parametros.cargo_consumo_resultante;
  const consumoEfectivo = aplicarMinimoVital(
    entrada.consumo_m3,
    parametros,
    entrada.categoria_uso,
  );

  // 4. Consumo basico vs excedente (Res CRA 750/2016 art. 3).
  //    El limite basico depende de la altitud del prestador. Si los
  //    parametros no tienen altitud (data legacy), usamos periodo=1
  //    (facturacion mensual estandar) — fallback conservador a 16 m3.
  const altitud = parametros.altitud_msnm ?? null;
  const division = aplicarConsumoBasico(consumoEfectivo, altitud, 1);
  const consumoBasicoM3 = division.basico;
  const consumoExcedenteM3 = division.excedente;
  const valorBasico = Math.round(consumoBasicoM3 * ccUnitario);
  const valorExcedente = Math.round(consumoExcedenteM3 * ccUnitario);
  const ccTotal = valorBasico + valorExcedente;

  // 5. Factor de subsidio/contribución según categoría + estrato + Acuerdo
  const factorResult = calcularFactor(entrada.estrato, entrada.categoria_uso, acuerdo);
  let factor = factorResult.factor;

  // Gate `estado_verificacion` — PENDIENTE/RECHAZADO + E1-E3 residencial
  // aplican factor 0 (regulatorio: no subsidiar sin verificación oficial).
  // Cambio `param-tarifa-res-825-compliance-phase2` (tasks 2.12 / 2.14 GREEN).
  //
  // Regulación (Resolución CRA 825/2017 + L142/1994 art. 99.6): un
  // suscriptor residencial E1-E3 SOLO recibe subsidio si el prestador
  // verificó oficialmente su estrato. Sin verificación (PENDIENTE) o
  // con verificación rechazada (RECHAZADO), se cobra CF+CC plenos
  // (factor 0) y se registra el motivo regulatorio en metadata.
  //
  // Alcance:
  //   - E1-E3 residencial (o especial, alias) → gate aplica.
  //   - E4 neutro, E5/E6 contribuciones → NO gate (la contribución no
  //     depende de verificación oficial del estrato).
  //   - Comercial/industrial/oficial → NO gate (no subsidian anyway).
  //
  // Backward-compat: si `estado_verificacion` no está definido en la
  // entrada (callers legacy del motor), se asume VERIFICADO — no rompe
  // los 40 callers que no setean el campo.
  let motivoNoSubsidio: string | null = null;
  const verificacion: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO' =
    entrada.estado_verificacion ?? 'VERIFICADO';
  const requiereSubsidio =
    (entrada.categoria_uso === 'residencial' || entrada.categoria_uso === 'especial') &&
    entrada.estrato >= 1 &&
    entrada.estrato <= 3;

  if (requiereSubsidio && (verificacion === 'PENDIENTE' || verificacion === 'RECHAZADO')) {
    motivoNoSubsidio =
      verificacion === 'PENDIENTE'
        ? 'suscripcion_pendiente_verificacion'
        : 'suscripcion_rechazada';
    // Override factor para que todos los cálculos downstream (subsidio
    // legacy, contribución, factor_reportado) queden en 0.
    factor = 0;
  }

  // 6. Aplicar subsidio por bloques (Res CRA 825/2017 compliance).
  //    - Si el Acuerdo tiene los 3 porcentajes nuevos (cf/basico/excedente):
  //      se aplican POR BLOQUE (Res CRA 825 + Res CRA 750/2016).
  //    - Si NO los tiene (legacy): fallback al factor unico sobre (CF + CC),
  //      manteniendo backward-compat con datos legacy.
  //    - Comercial/industrial/oficial: subsidios no aplican (contribucion
  //      o tarifa plena).
  let subsidioCf = 0;
  let subsidioBasico = 0;
  let subsidioExcedente = 0;
  let subsidioLegacy = 0;
  let factorReportado = factor;

  if (entrada.categoria_uso === 'residencial' || entrada.categoria_uso === 'especial') {
    const tiene3Porcentajes =
      acuerdo !== null &&
      acuerdo.factor_subsidio_e1_cf !== undefined &&
      acuerdo.factor_subsidio_e1_basico !== undefined;

    if (tiene3Porcentajes) {
      // Residencial con 3 porcentajes separados (compliance nuevo)
      let factorCf = 0;
      let factorBasico = 0;
      let factorExcedente = 0;

      // Gate verificación: si PENDIENTE/RECHAZADO, NO leemos del
      // Acuerdo — los 3 porcentajes quedan en 0 y el subsidio total
      // queda en 0. Cambio `param-tarifa-res-825-compliance-phase2`
      // (tasks 2.12/2.14 GREEN).
      if (motivoNoSubsidio === null) {
        if (entrada.estrato === 1) {
          factorCf = acuerdo?.factor_subsidio_e1_cf ?? 0;
          factorBasico = acuerdo?.factor_subsidio_e1_basico ?? 0;
          factorExcedente = acuerdo?.factor_subsidio_e1_excedente ?? 0;
        } else if (entrada.estrato === 2) {
          factorCf = acuerdo?.factor_subsidio_e2_cf ?? 0;
          factorBasico = acuerdo?.factor_subsidio_e2_basico ?? 0;
          factorExcedente = acuerdo?.factor_subsidio_e2_excedente ?? 0;
        } else if (entrada.estrato === 3) {
          factorCf = acuerdo?.factor_subsidio_e3_cf ?? 0;
          factorBasico = acuerdo?.factor_subsidio_e3_basico ?? 0;
          factorExcedente = acuerdo?.factor_subsidio_e3_excedente ?? 0;
        }
      }
      // E4/E5/E6: 3 porcentajes subsidiables no aplican (E4=neutro,
      // E5/E6 son contribuciones).

      // Capea cada factor a los topes L142/1994 art. 99.6.
      const factorCfCapeado = caparFactorEstrato(factorCf, entrada.estrato, entrada.categoria_uso);
      const factorBasicoCapeado = caparFactorEstrato(factorBasico, entrada.estrato, entrada.categoria_uso);

      subsidioCf = factorCfCapeado < 0 ? Math.round(Math.abs(factorCfCapeado) * cargoFijo) : 0;
      subsidioBasico = factorBasicoCapeado < 0 ? Math.round(Math.abs(factorBasicoCapeado) * valorBasico) : 0;
      // Por norma, subsidio_excedente es SIEMPRE 0 (Res CRA 825 art. 14).
      // El factor_excedente se ignora aun si viniera != 0 (defensa).
      subsidioExcedente = 0;
      // factor_aplicado: para legacy compat, reportamos el factor cf (legacy era
      // un factor unico sobre el subtotal; el mas representativo es el de cf
      // porque el de basico puede ser distinto).
      factorReportado = factorCfCapeado;
    } else {
      // Legacy: factor unico sobre (CF + CC)
      const base = cargoFijo + ccTotal;
      subsidioLegacy = factor < 0 ? Math.round(Math.abs(factor) * base) : 0;
    }
  } else {
    // Comercial/industrial: solo contribucion (factor legacy).
    // Oficial: factor=0, sin subsidio ni contribucion.
    const base = cargoFijo + ccTotal;
    subsidioLegacy = factor < 0 ? Math.round(Math.abs(factor) * base) : 0;
  }

  const subsidio = subsidioCf + subsidioBasico + subsidioExcedente + subsidioLegacy;

  // 7. Contribucion (solo aplica a E5/E6/comercial/industrial).
  //    Las contribuciones siguen siendo factor unico sobre el subtotal
  //    (Res CRA 825 + L142/1994 art. 99.6).
  const baseContribucion = cargoFijo + ccTotal;
  const contribucion = factor > 0 ? Math.round(factor * baseContribucion) : 0;

  // 8. Total
  const total = Math.round(cargoFijo + ccTotal - subsidio + contribucion);

  // 9. Bloques de consumo: 2 bloques (basico + excedente) para auditoría
  //    detallada. Compatible con la spec seccion 9 de la guia de validacion.
  const bloques: readonly BloqueConsumo[] = [
    ...(consumoBasicoM3 > 0 ? [{
      desde_m3: 0,
      hasta_m3: consumoBasicoM3,
      m3_facturados: consumoBasicoM3,
      precio_unitario: Math.round(ccUnitario * 100) / 100,
      subtotal: valorBasico,
    }] : []),
    ...(consumoExcedenteM3 > 0 ? [{
      desde_m3: consumoBasicoM3,
      hasta_m3: Number.POSITIVE_INFINITY,
      m3_facturados: consumoExcedenteM3,
      precio_unitario: Math.round(ccUnitario * 100) / 100,
      subtotal: valorExcedente,
    }] : []),
    ...(consumoEfectivo === 0 ? [{
      desde_m3: 0,
      hasta_m3: Number.POSITIVE_INFINITY,
      m3_facturados: 0,
      precio_unitario: Math.round(ccUnitario * 100) / 100,
      subtotal: 0,
    }] : []),
  ];

  const metadata: MetadataCalculo = {
    norma_aplicada: 'Res CRA 825/2017 + Res CRA 907/2019 art. 14 + Res CRA 750/2016',
    acuerdo_id: acuerdo?.id_acuerdo ?? null,
    parametros_id: parametros.id_parametros,
    cmviaa_aplicado: parametros.aplica_cmviaa && parametros.cmviaa > 0,
    minimo_vital_aplicado: consumoEfectivo !== entrada.consumo_m3,
    factor_capeado: factorResult.capeado,
    motivo_no_subsidio: motivoNoSubsidio,
    version_motor: '825-907-v2', // bump: subsidios por bloques
    calculo_timestamp: new Date().toISOString(),
  };

  return {
    id_prestador: parametros.id_prestador,
    estrato: entrada.estrato,
    categoria_uso: entrada.categoria_uso,
    consumo_m3: entrada.consumo_m3,
    consumo_efectivo_m3: consumoEfectivo,
    bloques,
    cargo_fijo: cargoFijo,
    cc_unitario: Math.round(ccUnitario * 100) / 100,
    cc_total: ccTotal,
    consumo_basico_m3: consumoBasicoM3,
    consumo_excedente_m3: consumoExcedenteM3,
    valor_basico: valorBasico,
    valor_excedente: valorExcedente,
    subsidio_cf: subsidioCf,
    subsidio_basico: subsidioBasico,
    subsidio_excedente: subsidioExcedente,
    subsidio,
    contribucion,
    total,
    factor_aplicado: factorReportado,
    metadata,
  };
}

/**
 * Liquidación batch — procesa múltiples entradas. Si una entrada
 * tiene error, captura el error y sigue con las demás.
 *
 * @param entradas entradas con sus parametros+acuerdo inline (cada
 *   entrada trae su contexto multi-tenant).
 * @param parametrosPorEntrada función que resuelve los Parametros
 *   vigentes del prestador de cada entrada.
 * @param acuerdoPorEntrada función que resuelve el Acuerdo vigente.
 */
export interface EntradaBatch {
  readonly entrada: EntradaCalculo;
  readonly parametros: ParametrosTarifa;
  readonly acuerdo: AcuerdoMunicipal | null;
}

export function calcularBatch(entradas: readonly EntradaBatch[]): readonly ResultadoCalculo[] {
  return entradas.map(({ entrada, parametros, acuerdo }) => {
    try {
      return calcularLiquidacion(entrada, parametros, acuerdo);
    } catch (err) {
      return {
        id_prestador: entrada.id_prestador,
        estrato: entrada.estrato,
        categoria_uso: entrada.categoria_uso,
        consumo_m3: entrada.consumo_m3,
        consumo_efectivo_m3: 0,
        bloques: [],
        cargo_fijo: 0,
        cc_unitario: 0,
        cc_total: 0,
        consumo_basico_m3: 0,
        consumo_excedente_m3: 0,
        valor_basico: 0,
        valor_excedente: 0,
        subsidio_cf: 0,
        subsidio_basico: 0,
        subsidio_excedente: 0,
        subsidio: 0,
        contribucion: 0,
        total: 0,
        factor_aplicado: 0,
        metadata: {
          norma_aplicada: 'ERROR',
          acuerdo_id: null,
          parametros_id: 0,
          cmviaa_aplicado: false,
          minimo_vital_aplicado: false,
          factor_capeado: false,
          version_motor: '825-907-v2',
          calculo_timestamp: new Date().toISOString(),
        },
        error: (err as Error).message,
      };
    }
  });
}
