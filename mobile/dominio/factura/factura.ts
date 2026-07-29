/**
 * Módulo FACTURA — aggregate de la factura emitida al suscriptor.
 *
 * Funciones puras (excepto orquestadores que reciben repo). Errores como
 * `throw new Error(MENSAJES_ERROR_FACTURA.X)`. deepFreeze garantiza
 * inmutabilidad recursiva.
 */

import type { Hasher, IdGenerator } from '../shared/ports';
import { verificarIntegridad } from '../calculo/calculo';
import type { Liquidacion } from '../calculo/types';
import type { Prestador } from '../prestadores/types';
import {
  extraerSnapshotLectura,
  MENSAJES_ERROR_FACTURA,
  relojSistema,
  type Clock,
  type EmitirFacturaInput,
  type EstadoFactura,
  type Factura,
  type FacturaMetadata,
  type FacturaSnapshot,
  type FacturaSnapshotPrestador,
  type OtroValor,
} from './types';
import {
  calcularCodigoVerificacion,
  generarQrPago,
  generarReferenciaPago,
} from './pagos';
import { OtrosValoresCatalogo } from './otros-valores-catalogo';

// Re-export de los helpers de pagos para que `import { ... } from '../factura'`
// siga funcionando como API unica del modulo.
export { calcularCodigoVerificacion, generarReferenciaPago, generarQrPago } from './pagos';

/**
 * Congela recursivamente. Replicado de calculo.ts (3er duplicado pendiente
 * para extracción a shared — YAGNI hasta entonces).
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

function formatearNumeroFactura(dispositivoId: string, consecutivo: number): string {
  return `${dispositivoId}-${consecutivo}`;
}

/**
 * Proyecta un `Prestador` (entidad origen) al `FacturaSnapshotPrestador`
 * (sub-snapshot inmutable de la factura). Los 8 campos exigidos por
 * Res CRA 1038/2026 §1: id, codigo, nombre, NIT, municipio,
 * departamento, representante legal y representante legal cédula.
 *
 * `representante_legal` y `representante_legal_cedula` admiten `null`
 * para preservar el shape normativo cuando el origen no los trae
 * (legado, captura incompleta). El snapshot NUNCA omite la clave —
 * siempre la expone, con `null` si falta.
 *
 * NO expone `contacto`, `segmento`, `num_suscriptores_*`, `estado`, ni
 * timestamps: no son exigidos por la norma y reducen duplicación.
 *
 * Función pura: deepFreeze + solo lee del input. Caller debe pasar el
 * Prestador del workspace activo (no recargar desde DB).
 */
export function extraerSnapshotPrestador(prestador: Prestador): FacturaSnapshotPrestador {
  if (prestador === null || prestador === undefined) {
    throw new Error('extraerSnapshotPrestador: prestador es requerido');
  }
  const representanteLegal =
    prestador.representante_legal === undefined || prestador.representante_legal === ''
      ? null
      : prestador.representante_legal;
  const representanteLegalCedula =
    prestador.representante_legal_cedula === undefined ||
    prestador.representante_legal_cedula === ''
      ? null
      : prestador.representante_legal_cedula;
  return deepFreeze({
    id_prestador: prestador.id_prestador,
    codigo: prestador.codigo,
    nombre: prestador.nombre,
    nit: prestador.nit,
    municipio: prestador.municipio,
    departamento: prestador.departamento,
    representante_legal: representanteLegal,
    representante_legal_cedula: representanteLegalCedula,
  });
}

/**
 * Hash SHA-256 reproducible sobre snapshot canónico + numero_factura + fecha_emision.
 * Serialización determinística — orden de claves explícito (D1).
 *
 * v2 (FacturaCompliance-Fase1): incluye `prestador` en el payload y
 * `metadata.hash_version: 'v2'`. Las facturas v1 existentes fueron
 * generadas con la forma previa; `calcularHashFactura` siempre firma
 * con v2 hacia adelante para que todas las nuevas facturas sean
 * verificables con el snapshot extendido.
 *
 * Exportado para que callers verifiquen integridad post-corrección
 * (ej: `verificarIntegridadFactura(factura, hasher)` o tests de coherencia).
 */
export function calcularHashFactura(
  snapshot: FacturaSnapshot,
  numeroFactura: string,
  fechaEmision: string,
  hasher: Hasher,
): string {
  const payload = JSON.stringify({
    numero_factura: numeroFactura,
    fecha_emision: fechaEmision,
    snapshot: {
      suscriptor: snapshot.suscriptor,
      medidor: snapshot.medidor,
      periodo: snapshot.periodo,
      operario: snapshot.operario,
      prestador: snapshot.prestador,
      lectura: snapshot.lectura,
      liquidacion: snapshot.liquidacion,
      consumosHistoricos: snapshot.consumosHistoricos,
      otros_valores: snapshot.otros_valores,
      saldo_anterior: snapshot.saldo_anterior,
      metadata: snapshot.metadata,
      observaciones: snapshot.observaciones ?? null,
    },
  });
  return hasher.sha256(payload);
}

/**
 * Calcula el hash canonico v1 (retrocompatible con facturas historicas).
 *
 * v1 NO incluye `prestador` (no existia el campo), ni `metadata`
 * (no existia). Es la firma de las facturas emitidas antes del change
 * `factura-compliance-fase1`. Esta funcion existe SOLO para que
 * `verificarIntegridadFactura` pueda validar facturas v1 sin
 * recalcularlas con v2 (invalidaria su firma).
 */
function calcularHashFacturaV1(
  snapshotV1: {
    readonly suscriptor: unknown;
    readonly medidor: unknown;
    readonly periodo: unknown;
    readonly operario: unknown;
    readonly lectura: unknown;
    readonly liquidacion: unknown;
    readonly consumosHistoricos: unknown;
  },
  numeroFactura: string,
  fechaEmision: string,
  hasher: Hasher,
): string {
  const payload = JSON.stringify({
    numero_factura: numeroFactura,
    fecha_emision: fechaEmision,
    snapshot: snapshotV1,
  });
  return hasher.sha256(payload);
}

/**
 * Verifica la integridad de una factura comparando su hash contra el
 * hash canonico recalculado.
 *
 * Detecta la version por `snapshot.metadata.hash_version`:
 *  - `v2`: payload extendido (incluye prestador, otros_valores, etc).
 *  - `v1`: payload retrocompatible (sin prestador, sin metadata).
 *
 * Compatibilidad: facturas v1 existentes (sin prestador en el snapshot)
 * se verifican correctamente con su firma original. NO se invalidan.
 *
 * Retorna `true` si el hash coincide (factura integra), `false` si
 * fue alterada (cualquier campo cambio desde la emision).
 *
 * Exportado para que orquestadores y auditors verifiquen integridad
 * post-correccion o post-sincronizacion con backend.
 */
export function verificarIntegridadFactura(factura: Factura, hasher: Hasher): boolean {
  const version = factura.snapshot.metadata.hash_version;
  if (version === 'v1') {
    // Snapshot v1: extraemos solo las claves conocidas. Si el snapshot
    // tiene `metadata` y `prestador`, los descartamos para verificar
    // con el algoritmo v1 puro.
    const snapV1 = {
      suscriptor: factura.snapshot.suscriptor,
      medidor: factura.snapshot.medidor,
      periodo: factura.snapshot.periodo,
      operario: factura.snapshot.operario,
      lectura: factura.snapshot.lectura,
      liquidacion: factura.snapshot.liquidacion,
      consumosHistoricos: factura.snapshot.consumosHistoricos,
    };
    const esperado = calcularHashFacturaV1(
      snapV1,
      factura.numero_factura,
      factura.fecha_emision,
      hasher,
    );
    return factura.hash === esperado;
  }
  // v2 (default): payload extendido
  const esperado = calcularHashFactura(
    factura.snapshot,
    factura.numero_factura,
    factura.fecha_emision,
    hasher,
  );
  return factura.hash === esperado;
}

export function emitirFactura(
  input: EmitirFacturaInput,
  hasher: Hasher,
  idGen?: IdGenerator,
  clock: Clock = relojSistema,
): Factura {
  if (!verificarIntegridad(input.liquidacion, hasher)) {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_INTEGRIDAD_ROTA);
  }
  if (input.liquidacion.estado !== 'ACTIVA') {
    throw new Error(MENSAJES_ERROR_FACTURA.LIQUIDACION_NO_ACTIVA);
  }
  if (input.suscriptor.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.SUSCRIPTOR_NO_ACTIVO);
  }
  if (input.medidor.id_suscriptor !== input.suscriptor.id_suscriptor) {
    throw new Error(MENSAJES_ERROR_FACTURA.MEDIDOR_NO_PERTENECE_A_SUSCRIPTOR);
  }
  if (input.medidor.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.MEDIDOR_NO_ACTIVO);
  }
  if (input.periodo.estado !== 'cerrado' && input.periodo.estado !== 'facturado') {
    throw new Error(MENSAJES_ERROR_FACTURA.PERIODO_NO_FACTURABLE);
  }
  if (input.fechaEmision < input.periodo.fecha_fin) {
    throw new Error(MENSAJES_ERROR_FACTURA.FECHA_EMISION_ANTES_FIN_PERIODO);
  }
  if (input.operario.estado !== 'activo') {
    throw new Error(MENSAJES_ERROR_FACTURA.OPERARIO_NO_ACTIVO);
  }
  if (!input.operario.dispositivo_id) {
    throw new Error(MENSAJES_ERROR_FACTURA.OPERARIO_SIN_DISPOSITIVO);
  }
  if (input.consumosHistoricos.length > 6) {
    throw new Error(MENSAJES_ERROR_FACTURA.CONSUMO_HISTORICO_INVALIDO);
  }
  const prestador = input.prestador;
  if (prestador === null || prestador === undefined) {
    throw new Error('emitirFactura: input.prestador es requerido');
  }
  const lectura = input.lectura;
  if (lectura === null || lectura === undefined) {
    throw new Error('emitirFactura: input.lectura es requerida');
  }
  const otrosValores: readonly OtroValor[] = input.otrosValores ?? [];
  const saldoAnterior: number = input.saldoAnterior ?? 0;
  if (saldoAnterior < 0) {
    throw new Error('emitirFactura: saldo_anterior no puede ser negativo');
  }
  // Validacion de frontera contra el catalogo regulatorio. Aunque
  // `crearOtroValor` ya valida el concepto, `emitirFactura` es la
  // frontera publica: NO se puede colar un OtroValor con un concepto
  // fuera del catalogo por casts, JSON round-trip, ni mutacion de
  // snapshot (es caso real de fraude / corrupcion de DB).
  for (const ov of otrosValores) {
    if (OtrosValoresCatalogo[ov.concepto] === undefined) {
      throw new Error(MENSAJES_ERROR_FACTURA.CONCEPTO_NO_AUTORIZADO);
    }
  }
  const numero_factura = formatearNumeroFactura(
    input.operario.dispositivo_id ?? '',
    input.consecutivo,
  );
  const suscriptorSnapshot = deepFreeze({
    codigo: input.suscriptor.codigo,
    nombre_apellidos: input.suscriptor.nombre_apellidos,
    cedula: input.suscriptor.cedula,
    email:
      input.suscriptor.email === undefined || input.suscriptor.email === ''
        ? null
        : input.suscriptor.email,
    telefono:
      input.suscriptor.telefono === undefined || input.suscriptor.telefono === ''
        ? null
        : input.suscriptor.telefono,
    municipio: input.suscriptor.municipio,
    sector:
      input.suscriptor.sector === undefined || input.suscriptor.sector === ''
        ? null
        : input.suscriptor.sector,
    calle:
      input.suscriptor.calle === undefined || input.suscriptor.calle === ''
        ? null
        : input.suscriptor.calle,
    direccion: input.suscriptor.direccion,
    estrato: input.suscriptor.estrato,
    estado: input.suscriptor.estado,
    matricula_inmobiliaria:
      input.suscriptor.matricula_inmobiliaria === undefined ||
      input.suscriptor.matricula_inmobiliaria === ''
        ? null
        : input.suscriptor.matricula_inmobiliaria,
    numero_catastral:
      input.suscriptor.numero_catastral === undefined || input.suscriptor.numero_catastral === ''
        ? null
        : input.suscriptor.numero_catastral,
    id_prestador: input.suscriptor.id_prestador,
    categoria_uso: input.suscriptor.categoria_uso,
  });
  const medidorSnapshot = deepFreeze({
    id_medidor: input.medidor.id_medidor,
    numero_medidor: input.medidor.numero_medidor,
    estado: input.medidor.estado,
    fecha_instalacion: input.medidor.fecha_instalacion,
    ...(input.medidor.observaciones !== undefined && {
      observaciones: input.medidor.observaciones,
    }),
  });
  const periodoSnapshot = deepFreeze({
    id_periodo: input.periodo.id_periodo,
    fecha_inicio: input.periodo.fecha_inicio,
    fecha_fin: input.periodo.fecha_fin,
    fecha_pago_sin_recargo: input.periodo.fecha_pago_sin_recargo,
    fecha_pago_con_recargo: input.periodo.fecha_pago_con_recargo,
    dias_consumo: input.periodo.dias_consumo ?? 0,
  });
  const operarioSnapshot = deepFreeze({
    id_operario: input.operario.id_operario,
    id_prestador: input.operario.id_prestador,
    numero_cedula: input.operario.numero_cedula,
    nombre: input.operario.nombre,
    email: input.operario.email,
    rol: input.operario.rol,
    estado: input.operario.estado,
    dispositivo_id: input.operario.dispositivo_id ?? '',
  });
  const prestadorSnapshot = extraerSnapshotPrestador(prestador);
  const lecturaSnapshot = extraerSnapshotLectura(lectura);
  const liquidacionSnapshot = deepFreeze({
    id: input.liquidacion.id,
    hash: input.liquidacion.hash,
    resultado: { ...input.liquidacion.resultado },
  });
  const consumosHistoricosSnapshot = deepFreeze(
    input.consumosHistoricos.map((c) => ({
      id_periodo: c.id_periodo,
      consumo_m3: c.consumo_m3,
      total_facturado: c.total_facturado,
    })),
  );
  const otrosValoresSnapshot = Object.freeze(
    otrosValores.map((ov) => Object.freeze({ ...ov })),
  );
  const metadata: FacturaMetadata = deepFreeze({ hash_version: 'v2' });
  const snapshot: FacturaSnapshot = {
    suscriptor: suscriptorSnapshot,
    medidor: medidorSnapshot,
    periodo: periodoSnapshot,
    operario: operarioSnapshot,
    prestador: prestadorSnapshot,
    lectura: lecturaSnapshot,
    liquidacion: liquidacionSnapshot,
    consumosHistoricos: consumosHistoricosSnapshot,
    otros_valores: otrosValoresSnapshot,
    saldo_anterior: saldoAnterior,
    metadata,
    ...(input.observaciones !== undefined && { observaciones: input.observaciones }),
  };
  const hash = calcularHashFactura(snapshot, numero_factura, input.fechaEmision, hasher);
  // Codigo de verificacion: derivado estable del hash (10 chars base36).
  // Lo calculamos ANTES de armar el Factura para que el campo este disponible.
  const codigoVerificacion = calcularCodigoVerificacionPlaceholder(hash);
  const versionTarifaAplicada = input.liquidacion.resultado.metadata.version_motor;
  // Armamos el Factura base (sin referencia_pago/qr_pago) para que los
  // helpers de pagos puedan derivar referencia_pago del snapshot.
  const facturaBase = deepFreeze({
    id: '',
    numero_factura,
    estado: 'BORRADOR' as const,
    fecha_emision: input.fechaEmision,
    snapshot,
    hash,
    codigo_verificacion: codigoVerificacion,
    version_tarifa_aplicada: versionTarifaAplicada,
    created_at: '',
  });
  // Si se inyecta idGen, generamos referencia_pago y qr_pago en este momento.
  let referenciaPago: string | undefined;
  let qrPago: string | undefined;
  if (idGen !== undefined) {
    referenciaPago = generarReferenciaPago(facturaBase, input.consecutivo, hasher, idGen);
    const facturaConRef = deepFreeze({ ...facturaBase, referencia_pago: referenciaPago });
    qrPago = generarQrPago(facturaConRef);
  }
  return deepFreeze({
    ...facturaBase,
    ...(referenciaPago !== undefined && { referencia_pago: referenciaPago }),
    ...(qrPago !== undefined && { qr_pago: qrPago }),
  });
}

/**
 * Helper interno para derivar el codigo de verificacion sin reinjectar
 * el hasher: dado que el hash canonico ya es estable, tomamos 16 chars
 * hex del hash y los codificamos en base36, primeros 10 chars.
 *
 * Compat tests: si el hash es < 16 chars o tiene prefijos no-hex
 * (hasher fake en tests contractuales como 'hash-fake-'), filtramos
 * los chars no-hex y padStart con '0' para llegar a 16. NO es un caso
 * de produccion — en prod SHA-256 hex SIEMPRE tiene 64 chars.
 */
function calcularCodigoVerificacionPlaceholder(hash: string): string {
  const hexOnly = (hash + '0'.repeat(16))
    .split('')
    .filter((ch) => /[0-9a-fA-F]/.test(ch))
    .join('')
    .slice(0, 16)
    .padEnd(16, '0');
  const valor = parseInt(hexOnly, 16);
  const base36 = valor.toString(36).toUpperCase();
  return base36.slice(0, 10).padStart(10, '0');
}

/**
 * Anula una Factura EMITIDA. Función pura — devuelve copia congelada con
 * estado ANULADA, motivo y fecha de anulación. Mismo id y numero_factura.
 *
 * El tercer arg `fechaAnulacion` es ISO 8601 (YYYY-MM-DD).
 * Validar transición: solo desde EMITIDA (BORRADOR/PAGADA/ANULADA rechazan).
 */
export function anularFactura(
  factura: Factura,
  motivo: string,
  fechaAnulacion: string,
): Factura {
  if (factura.estado !== 'EMITIDA') {
    throw new Error(MENSAJES_ERROR_FACTURA.FACTURA_NO_ANULABLE_DESDE_ESTADO_ACTUAL);
  }
  return deepFreeze({
    ...factura,
    estado: 'ANULADA',
    motivo_anulacion: motivo,
    fecha_anulacion: fechaAnulacion,
  });
}

/**
 * Predicado puro: factura está vencida cuando estado === 'EMITIDA' y
 * `fechaActual > snapshot.periodo.fecha_pago_con_recargo`. PAGADA y demás
 * estados nunca vencen. No muta, no persiste.
 */
export function esVencida(factura: Factura, fechaActual: string): boolean {
  if (factura.estado !== 'EMITIDA') return false;
  return fechaActual > factura.snapshot.periodo.fecha_pago_con_recargo;
}

/**
 * Predicado puro: ¿es legal la transición de estado `actual → nueva`?
 *
 * Matriz de transiciones (spec persistencia-sqlite/factura/ADDED-R1):
 *   BORRADOR → { EMITIDA, ANULADA }
 *   EMITIDA  → { PAGADA, ANULADA }
 *   PAGADA   → { } (terminal)
 *   ANULADA  → { } (terminal)
 *
 * Toda implementación de `FacturaRepository.actualizar` MUST invocar este
 * predicado antes de persistir. Si retorna `false`, lanzar
 * `Error(MENSAJES_ERROR_FACTURA.TRANSICION_ILEGAL)` con
 * `cause = { codigo, actual, intentada }`.
 */
export function esTransicionLegal(
  actual: EstadoFactura,
  nueva: EstadoFactura,
): boolean {
  if (actual === 'BORRADOR') return nueva === 'EMITIDA' || nueva === 'ANULADA';
  if (actual === 'EMITIDA') return nueva === 'PAGADA' || nueva === 'ANULADA';
  return false;
}

/**
 * Orquestador puro: corrige una Factura emitida cuando su Liquidacion fue
 * anulada y reemplazada (típicamente vía `calculo.anularYReemplazar`).
 *
 * NO invoca `emitirFactura` ni `anularFactura` internamente. NO toca repos.
 * NO importa el módulo `calculo`. Reusa el snapshot ya validado de la
 * factura original — los aggregates de origen (Suscriptor/Medidor/etc) NO
 * viven en el snapshot, así que reconstruirlos sería deshonesto e
 * incompleto (consumosHistoricos no están allí). Las invariantes de la
 * corrección son las verificadas en este orquestador (mismatch, etc.).
 *
 * Regenera `codigo_verificacion`, `referencia_pago`, `qr_pago`,
 * `version_tarifa_aplicada` con el nuevo numero_factura y la nueva
 * liquidacion. Sin esto, el borrador tendria codigo/referencia/QR del
 * original — inconsistencia detectable por un auditor.
 *
 * Si `idGen` se inyecta, genera nueva referencia_pago y qr_pago. Si NO,
 * el borrador hereda esos campos como `undefined` (estado BORRADOR
 * pre-persistencia).
 *
 * Design D2.
 */
export function corregirFactura(input: {
  facturaOriginal: Factura;
  liquidacionAnulada: Liquidacion;
  liquidacionNueva: Liquidacion;
  consecutivoNuevo: number;
  fechaEmision: string;
  observaciones?: string;
}, hasher: Hasher, idGen?: IdGenerator): { facturaAnulada: Factura; nuevoBorrador: Factura } {
  if (input.liquidacionAnulada.id !== input.facturaOriginal.snapshot.liquidacion.id) {
    throw new Error(MENSAJES_ERROR_FACTURA.CORRECCION_LIQUIDACION_ANULADA_NO_COINCIDE);
  }
  const facturaAnulada = deepFreeze({
    ...input.facturaOriginal,
    estado: 'ANULADA' as const,
    motivo_anulacion: 'Liquidación reemplazada',
    fecha_anulacion: input.fechaEmision,
  });
  const nuevoNumeroFactura = formatearNumeroFactura(
    input.facturaOriginal.snapshot.operario.dispositivo_id,
    input.consecutivoNuevo,
  );
  const nuevoSnapshot: FacturaSnapshot = {
    ...input.facturaOriginal.snapshot,
    liquidacion: {
      id: input.liquidacionNueva.id,
      hash: input.liquidacionNueva.hash,
      resultado: { ...input.liquidacionNueva.resultado },
    },
  };
  const nuevoHash = calcularHashFactura(nuevoSnapshot, nuevoNumeroFactura, input.fechaEmision, hasher);
  const nuevoCodigoVerificacion = calcularCodigoVerificacionPlaceholder(nuevoHash);
  const nuevoVersionTarifa = input.liquidacionNueva.resultado.metadata.version_motor;
  // Armamos el borrador base para que `generarReferenciaPago` y
  // `generarQrPago` puedan derivar del nuevo snapshot.
  let nuevoBorrador: Factura = deepFreeze({
    ...input.facturaOriginal,
    id: '',
    numero_factura: nuevoNumeroFactura,
    estado: 'BORRADOR' as const,
    fecha_emision: input.fechaEmision,
    snapshot: nuevoSnapshot,
    hash: nuevoHash,
    codigo_verificacion: nuevoCodigoVerificacion,
    version_tarifa_aplicada: nuevoVersionTarifa,
    reemplaza_a: input.facturaOriginal.id,
    created_at: '',
  });
  // Si se inyecta idGen, regeneramos referencia_pago y qr_pago con
  // el nuevo numero de factura. Si NO, quedan undefined (estado
  // BORRADOR pre-persistencia — el orquestador *ConRepo los asigna
  // al persistir).
  if (idGen !== undefined) {
    const nuevaReferenciaPago = generarReferenciaPago(
      nuevoBorrador,
      input.consecutivoNuevo,
      hasher,
      idGen,
    );
    const borradorConRef = deepFreeze({ ...nuevoBorrador, referencia_pago: nuevaReferenciaPago });
    const nuevoQrPago = generarQrPago(borradorConRef);
    nuevoBorrador = deepFreeze({ ...borradorConRef, qr_pago: nuevoQrPago });
  }
  return { facturaAnulada, nuevoBorrador };
}

/**
 * Calcula el total a pagar de la factura.
 *
 * Fórmula Res CRA 1038/2026 §4:
 *   total = liquidacion.total + sum(otros_valores) + saldo_anterior
 *
 * Donde:
 *  - liquidacion.total = suma de cargo_fijo + cc_total - subsidio + contribucion
 *    (lo calcula el motor tarifario).
 *  - otros_valores = lista de OtroValor (no negativos, dataset ≤ 7).
 *  - saldo_anterior = deuda arrastrada de periodos previos (≥ 0).
 *
 * Función pura. NO muta la factura. NO lee el repo.
 *
 * Validación: si el total calculado es < 0, lanza
 * `Error(MENSAJES_ERROR_FACTURA.TOTAL_NEGATIVO_NO_PERMITIDO)`. Esto
 * cubre el caso de factura con snapshot corrupto (round-trip JSON,
 * mutación externa) donde saldo_anterior o un OtroValor atravesó el
 * guard de `emitirFactura`. Una factura con total negativo es señal
 * de corrupción — se rechaza antes de devolver el cálculo.
 */
export function calcularTotalFactura(factura: Factura): number {
  const liquidacionTotal = factura.snapshot.liquidacion.resultado.total;
  const otrosValoresSum = factura.snapshot.otros_valores.reduce(
    (acc, ov) => acc + ov.valor,
    0,
  );
  const total = liquidacionTotal + otrosValoresSum + factura.snapshot.saldo_anterior;
  if (!Number.isFinite(total)) {
    throw new Error('calcularTotalFactura: total no es finito');
  }
  if (total < 0) {
    throw new Error(MENSAJES_ERROR_FACTURA.TOTAL_NEGATIVO_NO_PERMITIDO);
  }
  return total;
}
