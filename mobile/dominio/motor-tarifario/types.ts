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
import type {
  EstadoAmbito,
  SubtituloCRA,
} from '../ambito-tarifario/types';

export type Estrato = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Snapshot persistido del resultado de `validarAmbito()` para
 * trazabilidad regulatoria (Res CRA 825/2017 + Res CRA 1032/2026).
 *
 * Decisión 4 del design `param-tarifa-res-825-compliance-phase2`:
 * "Snapshot en tabla `factura.validacion_ambito` → Auditoría completa
 * (regulatoria)". Este type modela la forma snake_case que el spec
 * exige en el snapshot (Res CRA 825/2017 + 1032/2026 art. 2.1.2.1.1.1).
 *
 * Diferencias con `ResultadoAmbito` del módulo `ambito-tarifario`:
 *   - `norma_aplicable` (snake_case) vs `normaAplicable` (camelCase).
 *   - `motivo` (sin acentos, alcance regulatorio) vs `evidencia` (literal
 *     del motor). Se proyectan del mismo string fuente.
 *   - `cantidad_suscriptores`: dato DEL prestador (no parte del
 *     `ResultadoAmbito`), se incluye acá para auditoría regulatoria
 *     porque la norma exige saber "cuántos suscriptores tenía el
 *     prestador al momento de la liquidación".
 *
 * Se popula en `calcularLiquidacionConAmbito` (wrapper que llama
 * `validarAmbito` antes del motor puro) y se propaga al snapshot de
 * `emitirFactura` via `metadata.validacion_ambito`.
 *
 * Fase 2 (`param-tarifa-res-825-compliance-phase2`, task 4.8).
 */
export interface SnapshotValidacionAmbito {
  readonly estado: EstadoAmbito;
  readonly subtitulo: SubtituloCRA | null;
  readonly norma_aplicable: string | null;
  readonly motivo: string;
  readonly cantidad_suscriptores: number | null;
  readonly fecha_verificacion: string;
}

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
  /**
   * Estado de verificación oficial del estrato del suscriptor.
   * Default 'VERIFICADO' para compatibilidad con callers existentes
   * (la verificación normalmente la hace el caller aguas arriba y solo
   * las entradas verificadas llegan al motor).
   *
   * Si 'PENDIENTE' o 'RECHAZADO' en E1-E3 residencial, el motor aplica
   * factor 0 con metadata `motivo_no_subsidio: '...'`.
   *
   * Fase 2 (`param-tarifa-res-825-compliance-phase2`).
   */
  readonly estado_verificacion?: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO';
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
  /**
   * Motivo regulatorio por el cual NO se aplicó subsidio aunque
   * categoría/estrato lo permitirían. Populated solo cuando el motor
   * bloquea el subsidio por gates regulatorios (verificación oficial
   * del estrato, etc.).
   *
   * Valores:
   *   - `'suscripcion_pendiente_verificacion'` — admin aún no verificó
   *     el estrato del suscriptor (Resolución CRA 825/2017 + L142/1994).
   *   - `'suscripcion_rechazada'` — admin rechazó el estrato del
   *     suscriptor (impugnación regulatoria).
   *
   * `null` cuando el subsidio aplicó normalmente (o cuando el suscriptor
   * no calificaba para subsidio por estrato/categoría de todos modos).
   *
   * Fase 2 (`param-tarifa-res-825-compliance-phase2`, tasks 2.12/2.14).
   */
  readonly motivo_no_subsidio?: string | null;
  readonly version_motor: string;
  readonly calculo_timestamp: string;  // ISO 8601
  /**
   * Snapshot de `validarAmbito()` (Res CRA 825/2017 + 1032/2026).
   * Solo se popula cuando el caller usa `calcularLiquidacionConAmbito`
   * (wrapper que invoca `validarAmbito` antes del motor puro). En
   * `calcularLiquidacion` puro, este campo es `undefined` para
   * backward-compat con los 40 callers legacy.
   *
   * Decisión 4 del design `param-tarifa-res-825-compliance-phase2`:
   * se persiste al snapshot de la Factura para auditoría regulatoria.
   *
   * Fase 2 (`param-tarifa-res-825-compliance-phase2`, task 4.8).
   */
  readonly validacion_ambito?: SnapshotValidacionAmbito;
}

/**
 * Resultado del cálculo. Inmutable. El motor retorna TODOS los
 * componentes desglosados para auditoría + display en ResultadoCalculo.
 *
 * Extension `compliance-cra-825-subsidios-bloques` (Res CRA 825/2017 +
 * Res CRA 750/2016): el subsidio se aplica por bloques (cargo fijo +
 * consumo basico), no sobre el subtotal. El excedente NO se subsidia.
 * Los nuevos campos (`consumo_basico_m3`, `consumo_excedente_m3`,
 * `valor_basico`, `valor_excedente`, `subsidio_cf`, `subsidio_basico`,
 * `subsidio_excedente`) son para auditoria. El campo legacy `subsidio`
 * se conserva (suma de `subsidio_cf` + `subsidio_basico`) para
 * backward-compat con pantallas y reportes existentes.
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
  /** m3 del consumo basico (Res CRA 750/2016). Subsidiables.
   * OPTIONAL por backward-compat: el motor siempre lo popula, pero
   * fixtures de tests existentes NO lo setean (legacy compat). */
  readonly consumo_basico_m3?: number;
  /** m3 del consumo excedente (por encima del limite basico). NO subsidiables. */
  readonly consumo_excedente_m3?: number;
  /** Valor en pesos del consumo basico = basico * cc_unitario. */
  readonly valor_basico?: number;
  /** Valor en pesos del consumo excedente = excedente * cc_unitario. */
  readonly valor_excedente?: number;
  /** Subsidio sobre Cargo Fijo (factor_subsidio_eN_cf × CF). */
  readonly subsidio_cf?: number;
  /** Subsidio sobre Consumo Basico (factor_subsidio_eN_basico × valor_basico). */
  readonly subsidio_basico?: number;
  /** Subsidio sobre Excedente (siempre 0 por Res CRA 825/2017 art. 14). */
  readonly subsidio_excedente?: number;
  /** Suma de subsidio_cf + subsidio_basico. Legacy: usado por UI/reportes. */
  readonly subsidio: number;
  readonly contribucion: number;
  readonly total: number;
  /** Factor aplicado (negativo=subsidio, positivo=contribución, 0=pleno).
   * Legacy: para subsidios por bloques se reporta el promedio ponderado
   * (o 0 si los 3 porcentajes nuevos estan disponibles — los 3
   * porcentajes por bloque dan mas precision que un unico factor). */
  readonly factor_aplicado: number;
  readonly metadata: MetadataCalculo;
  /** Solo en batch, cuando la entrada es inválida. */
  readonly error?: string;
}

// Re-exports para conveniencia de callers
export type { AcuerdoMunicipal, ParametrosTarifa, CategoriaUso };
