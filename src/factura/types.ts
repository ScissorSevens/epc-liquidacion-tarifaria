/**
 * Tipos del módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Convención: `MENSAJES_ERROR_FACTURA` vive en `types.ts` (alineado con
 * operarios, suscriptores, medidores, periodos). El spec dice `factura.ts`
 * — inconsistencia menor, ver design.md §"Spec adjustments".
 */

import type { Liquidacion } from '../calculo/types';
import type { ResultadoCalculo } from '../motor-tarifario';
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

export interface FacturaSnapshotSuscriptor {
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly direccion: string;
  readonly estrato: 1 | 2 | 3 | 4 | 5 | 6;
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
 * Snapshot completo del aggregate FACTURA. NESTED por aggregate de origen
 * (design D5) — al evolucionar Suscriptor/Medidor/etc, el cambio queda
 * aislado en su sub-objeto.
 */
export interface FacturaSnapshot {
  readonly suscriptor: FacturaSnapshotSuscriptor;
  readonly medidor: FacturaSnapshotMedidor;
  readonly periodo: FacturaSnapshotPeriodo;
  readonly operario: FacturaSnapshotOperario;
  readonly liquidacion: FacturaSnapshotLiquidacion;
  readonly consumosHistoricos: readonly ConsumoHistorico[]; // 0..6
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
 * `actualizar` valida transiciones legales: BORRADOR→EMITIDA, EMITIDA→ANULADA,
 * EMITIDA→PAGADA.
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
  CONSUMO_HISTORICO_INVALIDO:
    'consumos_historicos no puede tener más de 6 elementos',
  FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL:
    'factura solo puede anularse desde estado EMITIDA',
} as const;
