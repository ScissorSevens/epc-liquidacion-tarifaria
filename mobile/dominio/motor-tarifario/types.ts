/**
 * Tipos del motor tarifario conforme a Res CRA 825/2017 (arts. 9-10)
 * modificado por Res CRA 907/2019 art. 14. Multi-tenant.
 *
 * El motor es pure function: NO accede a storage. El caller
 * (`liquidarLectura`, `bootstrap`) resuelve `ParametrosTarifa` y
 * `AcuerdoMunicipal` vigentes y los pasa como argumentos.
 */

import type { CategoriaUso } from '../categorias-uso';
import type { AcuerdoMunicipal } from '../acuerdo-municipal';
import type { ParametrosTarifa } from '../parametros-tarifa';

export type Estrato = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Entrada al motor. Trae TODO el contexto multi-tenant inline: el
 * caller es responsable de resolver ParametrosTarifa y AcuerdoMunicipal
 * vigentes del prestador antes de invocar.
 */
export interface EntradaCalculo {
  readonly id_prestador: number;
  readonly consumo_m3: number;
  readonly estrato: Estrato;
  readonly categoria_uso: CategoriaUso;
}

/**
 * Bloque de consumo: rangos [desde_m3, hasta_m3] a precio uniforme.
 * 825/2017 NO obliga a bloques múltiples (prestador decide). El motor
 * actualmente retorna 1 bloque global; en futuro se puede extender
 * para bloques (básico + complementario + suntuario).
 */
export interface BloqueConsumo {
  readonly desde_m3: number;
  readonly hasta_m3: number;
  readonly m3_facturados: number;
  readonly precio_unitario: number;  // $/m³
  readonly subtotal: number;          // pesos enteros
}

/**
 * Metadata del cálculo: trazabilidad + flags de comportamiento.
 */
export interface MetadataCalculo {
  readonly norma_aplicada: string;
  readonly acuerdo_id: number | null;
  readonly parametros_id: number;
  readonly cmviaa_aplicado: boolean;
  readonly minimo_vital_aplicado: boolean;
  readonly factor_capeado: boolean;
  readonly version_motor: string;
  readonly calculo_timestamp: string;  // ISO 8601
}

/**
 * Resultado del cálculo. Inmutable. El motor retorna TODOS los
 * componentes desglosados para auditoría + display en ResultadoCalculo.
 */
export interface ResultadoCalculo {
  readonly id_prestador: number;
  readonly estrato: Estrato;
  readonly categoria_uso: CategoriaUso;
  readonly consumo_m3: number;
  readonly consumo_efectivo_m3: number;
  readonly bloques: readonly BloqueConsumo[];
  /** Cargo fijo (art. 9 Res 825/2017 = CMA/N). Pesos enteros. */
  readonly cargo_fijo: number;
  /** CC unitario ($/m³) según art. 10 mod 907/2019 art. 14. 2 decimales. */
  readonly cc_unitario: number;
  /** CC total = cc_unitario × consumo_efectivo. Pesos enteros. */
  readonly cc_total: number;
  readonly subsidio: number;
  readonly contribucion: number;
  readonly total: number;
  /** Factor aplicado (negativo=subsidio, positivo=contribución, 0=pleno). */
  readonly factor_aplicado: number;
  readonly metadata: MetadataCalculo;
  /** Solo en batch, cuando la entrada es inválida. */
  readonly error?: string;
}

// Re-exports para conveniencia de callers
export type { AcuerdoMunicipal, ParametrosTarifa, CategoriaUso };
