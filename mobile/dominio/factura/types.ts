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
import type { EvidenciaFoto, Lectura } from '../captura-lecturas/types';
import { nullIfEmpty } from '../shared/strings';
import type { ConceptoOtroValor, OtroValor } from './otros-valores-catalogo';

export type { ConceptoOtroValor, OtroValor } from './otros-valores-catalogo';
// `OtrosValoresCatalogo` y `crearOtroValor` fueron removidos en
// `factura-compliance-cleanup` Task 5 (phase-out del constante legacy).
// El catalogo regulatorio vive en la tabla SQLite `concepto_otro_valor`.
// Para construir un `OtroValor` en tests/UI, instanciar el type directo:
//   { concepto: 'RECONEXION', valor: 1000 }

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
 * - Email y teléfono (Res CRA 1038 §3 contacto) — `null` cuando la
 *   captura de campo no los consigue (NO `undefined`: el snapshot es
 *   contrato normativo, no API parcial).
 * - Municipio, sector, calle y dirección completa (Res CRA 1038 §3
 *   ubicación del predio).
 * - Estrato socioeconómico (Res CRA 1038 §3 clasificación).
 * - Estado (`activo` | `suspendido` | `facturado`): denormalizado del
 *   origen para auditoría histórica (la factura no cambia si luego
 *   el suscriptor se suspende).
 * - Matrícula inmobiliaria y número catastral — `null` cuando no
 *   existen en el origen (NO exigidos por la norma pero presentes
 *   en `Suscriptor`).
 *
 * NO se exponen: `id_suscriptor` (interno), `aplica_subsidio` (cálculo),
 * `created_at` (timestamp de fila).
 */
export interface FacturaSnapshotSuscriptor {
  readonly codigo: string;
  readonly nombre_apellidos: string;
  readonly cedula: string;
  readonly email: string | null;
  readonly telefono: string | null;
  readonly municipio: string;
  readonly sector: string | null;
  readonly calle: string | null;
  readonly direccion: string;
  readonly estrato: 1 | 2 | 3 | 4 | 5 | 6;
  readonly estado: 'activo' | 'suspendido' | 'facturado';
  readonly matricula_inmobiliaria: string | null;
  readonly numero_catastral: string | null;
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
 * al prestador que la expide. Requerimos 8 campos: id, codigo, nombre,
 * NIT, municipio, departamento, representante legal y representante
 * legal cédula. `representante_legal` y `representante_legal_cedula`
 * admiten `null` para preservar el shape cuando el origen no los trae
 * (cargues legacy, datos incompletos en captura de campo).
 *
 * NO exponemos: `contacto`, `segmento`, `num_suscriptores_*`,
 * `estado`, ni timestamps: no son exigidos por la norma y reducen
 * duplicación.
 */
export interface FacturaSnapshotPrestador {
  readonly id_prestador: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly nit: string;
  readonly municipio: string;
  readonly departamento: string;
  readonly representante_legal: string | null;
  readonly representante_legal_cedula: string | null;
}

/**
 * Snapshot del medidor al momento de emisión. Res CRA 1038/2026 §3
 * exige identificar el instrumento de medición que origina la
 * liquidación. Datos: id interno, número de medidor, estado al
 * momento de la captura, fecha de instalación y observaciones.
 *
 * NO se expone `created_at` (timestamp de fila).
 */
export interface FacturaSnapshotMedidor {
  readonly id_medidor: number;
  readonly numero_medidor: string;
  readonly estado: 'activo' | 'inactivo' | 'reemplazado';
  readonly fecha_instalacion: string;
  readonly observaciones?: string;
}

export interface FacturaSnapshotPeriodo {
  readonly id_periodo: string;
  readonly fecha_inicio: string;
  readonly fecha_fin: string;
  readonly fecha_pago_sin_recargo: string;
  readonly fecha_pago_con_recargo: string;
  readonly dias_consumo: number;
}

/**
 * Snapshot del operario que emitió la factura. Res CRA 1038/2026 §9
 * exige identificar al operario de campo responsable de la lectura.
 *
 * **Security**: `password_hash` NUNCA se incluye — quedaría en
 * evidencia impresa de la factura. El hash del snapshot excluye
 * password_hash, garantizando que un cambio de password no invalida
 * la firma forense de la factura.
 *
 * NO se expone: `created_at` (timestamp de fila).
 */
export interface FacturaSnapshotOperario {
  readonly id_operario: number;
  readonly id_prestador: number;
  readonly numero_cedula: string;
  readonly nombre: string;
  readonly email: string;
  readonly rol: 'operario' | 'supervisor' | 'admin';
  readonly estado: 'activo' | 'inactivo';
  readonly dispositivo_id: string;
}

export interface FacturaSnapshotLiquidacion {
  readonly id: string;
  readonly hash: string;
  readonly resultado: ResultadoCalculo;
}

/**
 * Snapshot de la lectura que origina la liquidación. Res CRA 1038/2026
 * §3 y §10 exigen publicar la lectura del medidor que da origen a la
 * factura. Datos proyectados de la entidad `Lectura`:
 *
 * - lectura_actual / lectura_anterior: valores del medidor (m³).
 * - estado_validacion: 'pendiente' | 'validado' | 'error' — estado
 *   del workflow de la lectura al momento de la emisión (alias del
 *   EstadoValidacion del módulo captura-lecturas). Se proyecta al
 *   snapshot para auditoría histórica.
 * - evidencia_foto_path / evidencia_foto_hash: null cuando no hay
 *   foto tomada. **Claves planas** (NO objeto `evidencia` anidado) —
 *   el snapshot normativo se aplana para que el reporte y la factura
 *   emitida tengan las 7 claves top-level estables.
 * - timestamp_captura: ISO 8601 del momento de captura.
 * - observaciones: `null` cuando no hay notas (NO `undefined`: snapshot
 *   es contrato normativo, no API parcial).
 *
 * NO se proyecta: id_lectura (interno), id_medidor (ya en snapshot.medidor),
 * id_periodo (ya en snapshot.periodo), id_operario (ya en snapshot.operario),
 * estado_sync (workflow), timestamp_sync (workflow), id_prestador
 * (ya en snapshot.prestador).
 */
export interface FacturaSnapshotLectura {
  readonly lectura_actual: number;
  readonly lectura_anterior: number;
  readonly estado_validacion: 'pendiente' | 'validado' | 'error';
  readonly evidencia_foto_path: string | null;
  readonly evidencia_foto_hash: string | null;
  readonly timestamp_captura: string;
  readonly observaciones: string | null;
}

/**
 * Helper de proyeccion Lectura → FacturaSnapshotLectura.
 *
 * Aplana `lectura.evidencia` a claves top-level y proyecta los 7
 * campos normativos. `estado_validacion` se copia del origen;
 * valores nulos o `undefined` se preservan como `null`.
 */
export function extraerSnapshotLectura(lectura: Lectura): FacturaSnapshotLectura {
  if (lectura === null || lectura === undefined) {
    throw new Error('extraerSnapshotLectura: lectura es requerida');
  }
  const estadoValidacion = lectura.estado_validacion;
  const evidencia = lectura.evidencia;
  const evidenciaFotoPath =
    evidencia === undefined || evidencia === null
      ? null
      : nullIfEmpty(evidencia.foto_path);
  const evidenciaFotoHash =
    evidencia === undefined || evidencia === null
      ? null
      : nullIfEmpty(evidencia.foto_hash);
  const observaciones = nullIfEmpty(lectura.observaciones);
  const snap: FacturaSnapshotLectura = {
    lectura_actual: lectura.lectura_actual,
    lectura_anterior: lectura.lectura_anterior,
    estado_validacion: estadoValidacion,
    evidencia_foto_path: evidenciaFotoPath,
    evidencia_foto_hash: evidenciaFotoHash,
    timestamp_captura: lectura.timestamp_captura,
    observaciones,
  };
  return Object.freeze(snap);
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
 * v2 (FacturaCompliance-Fase1, Res CRA 1038/2026): agrega `prestador`,
 * `lectura`, `otros_valores`, `saldo_anterior` con datos completos al
 * momento de emisión.
 */
export interface FacturaSnapshot {
  readonly suscriptor: FacturaSnapshotSuscriptor;
  readonly medidor: FacturaSnapshotMedidor;
  readonly periodo: FacturaSnapshotPeriodo;
  readonly operario: FacturaSnapshotOperario;
  readonly prestador: FacturaSnapshotPrestador;
  readonly lectura: FacturaSnapshotLectura;
  readonly liquidacion: FacturaSnapshotLiquidacion;
  readonly consumosHistoricos: readonly ConsumoHistorico[]; // 0..6
  readonly otros_valores: readonly OtroValor[];
  readonly saldo_anterior: number;
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
  /**
   * Codigo de verificacion publico, 16 chars hex. Es un derivado
   * estable del hash canonico + discriminador. Lectura legible para
   * impresion en la factura y verificacion manual por el auditor.
   */
  readonly codigo_verificacion: string;
  /**
   * Version de la tarifa aplicada al momento del calculo. Copiada
   * de `liquidacion.resultado.metadata.version_motor` para trazabilidad
   * regulatoria (Res CRA 825/2017 art. 9 sobre metodologia tarifaria).
   */
  readonly version_tarifa_aplicada: string;
  /**
   * Referencia de pago unica (UUID v4). Se setea al persistir la
   * factura via emitirFacturaConRepo (con IdGenerator). Las facturas
   * en BORRADOR previas al repo no tienen este campo.
   */
  readonly referencia_pago?: string;
  /**
   * Payload QR para banca virtual. Formato:
   *   EPC|{referencia_pago}|{timestamp}
   * Generado al persistir (cuando se asigna referencia_pago).
   */
  readonly qr_pago?: string;
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
  readonly lectura: Lectura;
  readonly liquidacion: Liquidacion;
  readonly consumosHistoricos: readonly ConsumoHistorico[];
  readonly fechaEmision: string; // ISO 8601 (YYYY-MM-DD)
  readonly consecutivo: number; // viene del ConsecutivoFacturaProvider
  readonly otrosValores?: readonly OtroValor[];
  readonly saldoAnterior?: number;
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
 * Puerto de reloj. Inyectado para garantizar determinismo en tests
 * y para que `emitirFactura` y `corregirFactura` produzcan campos
 * dependientes del tiempo (ej: timestamp) reproducibles.
 *
 * Implementación default: `relojSistema()` retorna `new Date().toISOString()`.
 * Implementación test: `relojFijo('2026-02-01T10:00:00.000Z')`.
 */
export interface Clock {
  /** Retorna timestamp ISO 8601 actual. */
  now(): string;
}

/** Reloj de sistema — `new Date().toISOString()`. Default para producción. */
export const relojSistema: Clock = Object.freeze({
  now: () => new Date().toISOString(),
});

/**
 * Helper de test: retorna un Clock fijo con un timestamp constante.
 * Garantiza determinismo de codigo_verificacion, qr_pago, etc.
 */
export function relojFijo(timestamp: string): Clock {
  return Object.freeze({ now: () => timestamp });
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
  CONCEPTO_NO_AUTORIZADO:
    'concepto de otro valor no autorizado por el catálogo regulatorio',
  CLOCK_REQUERIDO_PARA_REFERENCIA:
    'clock es requerido para generar referencia_pago determinista',
  FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL:
    'factura solo puede anularse desde estado EMITIDA',
  CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE:
    'liquidacionAnulada.id no coincide con la liquidacion de la facturaOriginal',
  TRANSICION_ILEGAL:
    'transición de estado no permitida para esta factura',
  TOTAL_NEGATIVO_NO_PERMITIDO:
    'el total de la factura no puede ser negativo',
  RESTRICCION_UNICIDAD:
    'violación de unicidad en el repositorio de facturas',
  // Catálogo de errores del servicio de aplicación móvil.
  EMITIR_FACTURA_SUSCRIPTOR_NO_ENCONTRADO: 'EMITIR_FACTURA_SUSCRIPTOR_NO_ENCONTRADO',
  EMITIR_FACTURA_MEDIDOR_NO_ENCONTRADO: 'EMITIR_FACTURA_MEDIDOR_NO_ENCONTRADO',
  EMITIR_FACTURA_PERIODO_NO_ENCONTRADO: 'EMITIR_FACTURA_PERIODO_NO_ENCONTRADO',
  EMITIR_FACTURA_OPERARIO_NO_ENCONTRADO: 'EMITIR_FACTURA_OPERARIO_NO_ENCONTRADO',
  EMITIR_FACTURA_LIQUIDACION_NO_ENCONTRADA: 'EMITIR_FACTURA_LIQUIDACION_NO_ENCONTRADA',
  EMITIR_FACTURA_LECTURA_NO_ENCONTRADA: 'EMITIR_FACTURA_LECTURA_NO_ENCONTRADA',
  EMITIR_FACTURA_PRESTADOR_NO_ENCONTRADO: 'EMITIR_FACTURA_PRESTADOR_NO_ENCONTRADO',
} as const;
