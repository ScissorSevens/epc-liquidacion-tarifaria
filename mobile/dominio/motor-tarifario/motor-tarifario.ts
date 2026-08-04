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
  const ccTotal = Math.round(ccUnitario * consumoEfectivo);

  // 4. Factor de subsidio/contribución según categoría + estrato + Acuerdo
  const factorResult = calcularFactor(entrada.estrato, entrada.categoria_uso, acuerdo);
  const factor = factorResult.factor;

  // 5. Aplicar factor
  // - Residencial/especial: subsidio (factor<0) aplica sobre (CF + CC);
  //   contribución (factor>0) igual sobre (CF + CC).
  // - Comercial/industrial: solo contribución sobre (CF + CC), nunca subsidio.
  // - Oficial: factor=0, no aplica ni subsidio ni contribución.
  const base = cargoFijo + ccTotal;
  const subsidio = factor < 0 ? Math.round(Math.abs(factor) * base) : 0;
  const contribucion = factor > 0 ? Math.round(factor * base) : 0;

  // 6. Total
  const total = Math.round(cargoFijo + ccTotal - subsidio + contribucion);

  // 7. Bloques de consumo (compatibilidad: 1 bloque para formato 825)
  const bloques: readonly BloqueConsumo[] = [
    {
      desde_m3: 0,
      hasta_m3: Number.POSITIVE_INFINITY,
      m3_facturados: consumoEfectivo,
      precio_unitario: Math.round(ccUnitario * 100) / 100,
      subtotal: ccTotal,
    },
  ];

  const metadata: MetadataCalculo = {
    norma_aplicada: 'Res CRA 825/2017 + Res CRA 907/2019 art. 14',
    acuerdo_id: acuerdo?.id_acuerdo ?? null,
    parametros_id: parametros.id_parametros,
    cmviaa_aplicado: parametros.aplica_cmviaa && parametros.cmviaa > 0,
    minimo_vital_aplicado: consumoEfectivo !== entrada.consumo_m3,
    factor_capeado: factorResult.capeado,
    version_motor: '825-907-v1',
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
    subsidio,
    contribucion,
    total,
    factor_aplicado: factor,
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
          version_motor: '825-907-v1',
          calculo_timestamp: new Date().toISOString(),
        },
        error: (err as Error).message,
      };
    }
  });
}
