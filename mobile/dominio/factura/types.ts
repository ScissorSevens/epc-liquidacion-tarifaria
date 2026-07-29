/**
 * Tipos del módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Convención: `MENSAJES_ERROR_FACTURA` vive en `types.ts` (alineado con
 * operarios, suscriptores, medidores, periodos). El spec dice `factura.ts`
 * — inconsistencia menor, ver design.md §"Spec adjustments".
 */

import type { Liquidacion } from '../calculo/types';
import type { ResultadoCalculo } from '../motor-tarifario';
import type { Prestador } from '../prestadores/types';
import type { Suscriptor } from '../suscriptores/types';
import type { Medidor } from '../medidores/types';
import type { Periodo } from '../periodos/types';
import type { Operario } from '../operarios/types';

export type EstadoFactura = 'BORRADOR' | 'EMITIDA' | 'PAGADA' | 'ANULADA';

/**
 * Numero de factura per-device. Formato `{deviceId}-{consecutivo}`
 * (ej: `MZ-001-2981`). Validación de formato vive en la factory.
 */
export type NumeroFactura = string;

export interface ConsumoHistorico {
  readonly id_periodo: string; // YYYYMM
  readonly consumo_m3: number;
  readonly total_facturado: number;
}

/**
 * Snapshot del suscriptor al momento de emisión. Conformado por los
 * campos EXIGIDOS por Res CRA 1038/2026 §3 (datos del suscriptor /
 * usuario del servicio) que ya viven en la entidad `Suscriptor`.
 *
 * - Código identificador único del suscriptor.
 * - Nombre y apellidos.
 * - Cédula del titular (Res CRA 1038 §3 identificación).
 * - Email y teléfono (Res CRA 1038 §3 contacto) — opcionales porque
 *   la captura de campo no siempre los consigue.
 * - Municipio, sector, calle y dirección completa (Res CRA 1038 §3
 *   ubicación del predio).
 * - Estrato socioeconómico (Res CRA 1038 §3 clasificación).
 * - Matrícula inmobiliaria y número catastral — opcionales, no exigidos
 *   por la norma pero presentes en `Suscriptor`.
 *
 * NO se exponen: `id_suscriptor` (interno), `aplica_subsidio` (cálculo),
 * `estado` (filtro operativo), `created_at` (timestamp de fila).
 */
export interface FacturaSnapshotSuscriptor {
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly cedula: string;
  readonly email?: string;
  readonly telefono?: string;
  readonly municipio: string;
  readonly sector?: string;
  readonly calle?: string;
  readonly direccion: string;
  readonly estrato: 1 | 2 | 3 | 4 | 5 | 6;
  readonly matricula_inmobiliaria?: string;
  readonly numero_catastral?: string;
  /** FK al prestador del suscriptor (denormalizado en el snapshot). */
  readonly id_prestador: number;
  /** Categoría de uso (Q10 spec). */
  readonly categoria_uso: 'residencial' | 'comercial' | 'industrial' | 'oficial' | 'especial';
}

/**
 * Snapshot del prestador que emitió la factura. Se incluye en el
 * snapshot de la factura para que el reporte y la factura emitida
 * tengan la información del prestador al momento del cálculo.
 *
 * Res CRA 1038/2026 §1: el PDF/impresión de la factura debe identificar
 * al prestador que la expide. Requerimos: id, codigo, nombre, NIT,
 * municipio, departamento y representante legal. NO exponemos
 * `representante_legal_cedula`, `contacto`, `segmento`,
 * `num_suscriptores_*`, `estado`, ni timestamps: no son exigidos por
 * la norma y reducen duplicación.
 */
export interface FacturaSnapshotPrestador {
  readonly id_prestador: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly nit: string;
  readonly municipio: string;
  readonly departamento: string;
  readonly representante_legal: string;
}

export interface FacturaSnapshotMedidor {
  readonly numero_medidor: string;
}

export interface FacturaSnapshotPeriodo {
  readonly id_periodo: string;
  readonly fecha_inicio: string;
  readonly fecha_fin: string;
  readonly fecha_pago_sin_recargo: string;
  readonly fecha_pago_con_recargo: string;
  readonly dias_consumo: number;
}

export interface FacturaSnapshotOperario {
  readonly id_operario: number;
  readonly nombre: string;
  readonly dispositivo_id: string;
}

export interface FacturaSnapshotLiquidacion {
  readonly id: string;
  readonly hash: string;
  readonly resultado: ResultadoCalculo;
}

/**
 * Identifica la versión del serializador del snapshot. Cuando se
 * agregan campos al `FacturaSnapshot` (design D — versionado hash), el
 * cálculo del hash v2 los incluye. Facturas históricas v1 siguen
 * verificables porque su payload no fue recalculado.
 */
export type HashVersion = 'v1' | 'v2';

/**
 * Metadata de la factura para trazabilidad. No se persiste en columnas
 * dedicadas (idempotencia con schema legacy): vive en el snapshot
 * JSON bajo la clave `metadata`.
 */
export interface FacturaMetadata {
  readonly hash_version: HashVersion;
}

/**
 * Snapshot completo del aggregate FACTURA. NESTED por aggregate de origen
 * (design D5) — al evolucionar Suscriptor/Medidor/etc, el cambio queda
 * aislado en su sub-objeto.
 *
 * v2 (FacturaCompliance-Fase1, Res CRA 1038/2026): agrega `prestador`
 * con datos del prestador al momento de emisión.
 */
export interface FacturaSnapshot {
  readonly suscriptor: FacturaSnapshotSuscriptor;
  readonly medidor: FacturaSnapshotMedidor;
  readonly periodo: FacturaSnapshotPeriodo;
  readonly operario: FacturaSnapshotOperario;
  readonly prestador: FacturaSnapshotPrestador;
  readonly liquidacion: FacturaSnapshotLiquidacion;
  readonly consumosHistoricos: readonly ConsumoHistorico[]; // 0..6
  readonly metadata: FacturaMetadata;
  readonly observaciones?: string;
}

export interface Factura {
  readonly id: string; // UUID
  readonly numero_factura: NumeroFactura;
  readonly estado: EstadoFactura;
  readonly fecha_emision: string; // ISO 8601 (YYYY-MM-DD)
  readonly snapshot: FacturaSnapshot;
  readonly hash: string; // SHA-256 sobre snapshot + numero_factura + fecha_emision
  readonly motivo_anulacion?: string;
  readonly fecha_anulacion?: string; // ISO 8601 (YYYY-MM-DD), set por anularFactura
  readonly reemplaza_a?: string; // id de factura anulada que esta reemplaza
  readonly created_at: string;
}

export interface EmitirFacturaInput {
  readonly suscriptor: Suscriptor;
  readonly medidor: Medidor;
  readonly periodo: Periodo;
  readonly operario: Operario;
  readonly prestador: Prestador;
  readonly liquidacion: Liquidacion;
  readonly consumosHistoricos: readonly ConsumoHistorico[];
  readonly fechaEmision: string; // ISO 8601 (YYYY-MM-DD)
  readonly consecutivo: number; // viene del ConsecutivoFacturaProvider
  readonly observaciones?: string;
}

/**
 * Puerto del repositorio. Contrato de tipos — implementación SQLite en Iter 7.
 * Validaciones de unicidad (NUMERO_FACTURA_DUPLICADO_EN_PERIODO,
 * LIQUIDACION_YA_FACTURADA) son responsabilidad de `crear`.
 *
 * `actualizar` MUST:
 *  - Persistir TODOS los campos mutables presentes en `cambios` (incluido
 *    `fecha_anulacion` y `motivo_anulacion`).
 *  - Validar transiciones legales invocando `esTransicionLegal(actual, nueva)`
 *    SOLO cuando `cambios.estado` difiera del estado actual. Si la transición
 *    es ilegal, lanzar `Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL)`
 *    con `cause = { codigo: 'TRANSICION_ILEGAL', actual, intentada }`.
 *  - Devolver la factura íntegra ya persistida.
 */
export interface FacturaRepository {
  crear(factura: Factura): Promise<Factura>;
  buscarPorId(id: string): Promise<Factura | null>;
  buscarPorPeriodo(idPeriodo: string): Promise<readonly Factura[]>;
  buscarPorSuscriptor(idSuscriptor: number): Promise<readonly Factura[]>;
  actualizar(
    id: string,
    cambios: {
      estado: 'EMITIDA' | 'ANULADA' | 'PAGADA';
      motivo_anulacion?: string;
      fecha_anulacion?: string;
    },
  ): Promise<Factura>;
  listar(): Promise<readonly Factura[]>;
}

/**
 * Puerto del provider de consecutivos per-device. In-memory para tests,
 * SQLite atómico (`INSERT ... ON CONFLICT ... RETURNING`) en Iter 7.
 */
export interface ConsecutivoFacturaProvider {
  proximo(dispositivoId: string): Promise<number>;
}

/**
 * Catálogo de mensajes de error del módulo. Tests y código importan de la
 * misma fuente para impedir mistypes. Las 12 claves del spec.
 */
export const MENSAJES_ERROR_FACTURA = {
  LIQUIDACION_NO_ACTIVA: 'liquidacion debe estar en estado ACTIVA',
  LIQUIDACION_INTEGRIDAD_ROTA:
    'liquidacion tiene hash inválido — no se puede emitir factura',
  SUSCRIPTOR_NO_ACTIVO: 'suscriptor debe estar en estado activo',
  MEDIDOR_NO_PERTENECE_A_SUSCRIPTOR:
    'medidor.id_suscriptor no coincide con suscriptor.id',
  MEDIDOR_NO_ACTIVO: 'medidor debe estar en estado activo',
  PERIODO_NO_FACTURABLE:
    "periodo debe estar en estado 'cerrado' o 'facturado' para emitir factura",
  FECHA_EMISION_ANTES_FIN_PERIODO:
    'fecha de emisión no puede ser anterior a periodo.fecha_fin',
  OPERARIO_NO_ACTIVO: 'operario debe estar en estado activo',
  OPERARIO_SIN_DISPOSITIVO:
    'operario debe tener dispositivo_id asignado para emitir facturas en campo',
  NUMERO_FACTURA_DUPLICADO_EN_PERIODO:
    'ya existe una Factura con ese numero_factura en el periodo',
  LIQUIDACION_YA_FACTURADA:
    'ya existe una Factura EMITIDA para esta Liquidacion (1:1)',
  FACTURA_NO_ENCONTRADA: 'factura no encontrada en el repositorio',
  CONSUMO_HISTORICO_INVALIDO:
    'consumos_historicos no puede tener más de 6 elementos',
  FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL:
    'factura solo puede anularse desde estado EMITIDA',
  CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE:
    'liquidacionAnulada.id no coincide con la liquidacion de la facturaOriginal',
  TRANSICION_ILEGAL:
    'transición de estado no permitida para esta factura',
  RESTRICCION_UNICIDAD:
    'violación de unicidad en el repositorio de facturas',
} as const;
