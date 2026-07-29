/**
 * Helpers de verificacion y pago de la factura.
 *
 * - calcularCodigoVerificacion: SHA-256 del payload canonico + truncado
 *   a 10 chars base36 (0-9, A-Z). Es un codigo legible + verificable
 *   por el operario / auditor sin correr el motor completo.
 * - generarReferenciaPago: formato determinista
 *   `{id_prestador}-{id_periodo}-{consecutivo}-{checksum}` derivado de
 *   la Factura. NO UUID: la referencia se deriva para que sistemas
 *   externos (bancos, conciliacion) puedan verificarla sin lookup.
 * - generarQrPago: JSON con 4 campos (codigo_verificacion, valor_total,
 *   fecha_emision, referencia_pago). Es el payload que los lectores
 *   QR de banca virtual consumen.
 *
 * Todos los helpers son PUROS. No mutan la factura, no tocan persistencia.
 */

import type { Factura } from './types';
import type { Hasher, IdGenerator } from '../shared/ports';

/**
 * Longitud del codigo de verificacion. 10 chars base36 — contrato
 * normativo Res CRA 1038/2026: codigo legible por el usuario + robusto
 * para busqueda (~60 bits de entropia en 36^10).
 */
const CODIGO_VERIFICACION_LONGITUD = 10;
const BASE36_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Valida que un string sea exactamente 10 chars base36 (0-9, A-Z).
 * Usado en tests y como guard del formato normativo.
 */
export function esCodigoVerificacionValido(codigo: string): boolean {
  if (codigo.length !== CODIGO_VERIFICACION_LONGITUD) return false;
  for (const ch of codigo) {
    if (!BASE36_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Helper interno: deriva un codigo base36 de longitud fija desde un
 * hash. Filtra chars no-hex (compat con hasher fake en tests) y pad
 * con '0' para llegar a 16 hex chars.
 */
function hashABase36(hash: string, longitud: number): string {
  const hexOnly = (hash + '0'.repeat(16))
    .split('')
    .filter((ch) => /[0-9a-fA-F]/.test(ch))
    .join('')
    .slice(0, 16)
    .padEnd(16, '0');
  const valor = parseInt(hexOnly, 16);
  const base36Full = valor.toString(36).toUpperCase();
  return base36Full.slice(0, longitud).padStart(longitud, '0');
}

/**
 * Calcula el codigo de verificacion publico de la factura.
 *
 * Algoritmo (Res CRA 1038/2026):
 *   1. Toma el hash canonico (hex SHA-256, 64 chars).
 *   2. Filtra solo chars hex validos (defensa ante hasher fake en tests).
 *   3. Toma los primeros 16 chars hex (8 bytes = 64 bits).
 *   4. Convierte ese fragmento de hex a entero sin signo.
 *   5. Codifica en base36 (0-9, A-Z), primeros 10 chars.
 *
 * Es deterministe: misma Factura (mismo hash) → mismo codigo. NO
 * depende del timestamp ni de la id de la factura — solo del contenido.
 *
 * Hash canonico v2: incluye `prestador` y `metadata.hash_version: 'v2'`.
 * Hash canonico v1: snapshot reducido (sin prestador). Ambos producen
 * codigos validos porque el codigo es funcion pura del hash.
 */
export function calcularCodigoVerificacion(factura: Factura): string {
  return hashABase36(factura.hash, CODIGO_VERIFICACION_LONGITUD);
}

/**
 * Genera una referencia de pago determinista.
 *
 * Formato: `{id_prestador}-{id_periodo}-{consecutivo}-{checksum}`
 *
 * Donde:
 *  - `id_prestador`: del prestador (snapshot).
 *  - `id_periodo`: YYYYMM del periodo (snapshot).
 *  - `consecutivo`: input de la emision (parametro del caller).
 *  - `checksum`: 4 chars base36 derivado de SHA-256 sobre la tripla.
 *
 * Determinista: misma tripla (prestador, periodo, consecutivo) → misma
 * referencia. Esto permite busqueda y conciliacion con sistemas externos
 * sin necesidad de lookup.
 *
 * El `idGen` se mantiene en la firma por compatibilidad historica pero
 * NO se usa: la referencia se deriva de la Factura, no del generador.
 */
export function generarReferenciaPago(
  factura: Factura,
  consecutivo: number,
  hasher: Hasher,
  _idGen?: IdGenerator,
): string {
  void _idGen;
  const idPrestador = factura.snapshot.prestador.id_prestador;
  const idPeriodo = factura.snapshot.periodo.id_periodo;
  const checksumSeed = `${idPrestador}-${idPeriodo}-${consecutivo}`;
  const checksumHex = hasher.sha256(checksumSeed).slice(0, 16);
  const checksum = hashABase36(checksumHex, 4);
  return `${idPrestador}-${idPeriodo}-${consecutivo}-${checksum}`;
}

/**
 * Payload QR para banca virtual: JSON con 4 campos canonicos.
 *
 * Shape:
 *   {
 *     codigo_verificacion: string (10 base36),
 *     valor_total: number (en pesos, sin comas),
 *     fecha_emision: string (ISO 8601 YYYY-MM-DD),
 *     referencia_pago: string (formato {prestador}-{periodo}-{consecutivo}-{checksum})
 *   }
 *
 * Por que JSON y no pipe-string: los lectores QR de banca virtual
 * modernos parsean JSON estructurado. El pipe-string anterior era
 * fragil y NO incluia los 4 campos normativos.
 *
 * El JSON se serializa con orden canonico explicito (mismo orden en
 * todas las emisiones) para garantizar determinismo: misma Factura
 * → mismo QR.
 */
export function generarQrPago(factura: Factura): string {
  const liquidacionTotal = factura.snapshot.liquidacion.resultado.total;
  const otrosValoresSum = factura.snapshot.otros_valores.reduce(
    (acc, ov) => acc + ov.valor,
    0,
  );
  const valorTotal = liquidacionTotal + otrosValoresSum + factura.snapshot.saldo_anterior;
  const payload = {
    codigo_verificacion: factura.codigo_verificacion,
    valor_total: valorTotal,
    fecha_emision: factura.fecha_emision,
    referencia_pago: factura.referencia_pago ?? '',
  };
  return JSON.stringify(payload);
}

// Re-export Hasher for callers that want to use it consistently.
export type { Hasher, IdGenerator, Factura };
