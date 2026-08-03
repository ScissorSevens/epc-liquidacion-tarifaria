/**
 * Helper puro `armarTicketEscPos(factura, ancho)` y compania.
 *
 * Genera lineas de texto pre-computadas con comandos ESC/POS inline
 * (LF, separadores ASCII). Determinista: misma Factura (mismo
 * `fecha_emision`) produce mismo output. Testeable sin RN ni
 * Bluetooth — sin device, sin permisos, sin mock de reloj.
 *
 * Anchos por papel:
 *   - 58mm → 32 cols
 *   - 80mm → 42 cols
 *
 * Wrap: greedy word-break (corta en espacios) + char-break fallback
 * (parte con dash al final de linea).
 *
 * Caracteres no-PC437 (tildes, eñe, diacriticos) se mapean al ASCII
 * legible mas cercano via `MAPA_CARACTERES`.
 *
 * Spec: `factura-impresion-termica` REQ 2-5.
 */

import type { Factura } from '../factura/types';
import { MAPA_CARACTERES, ANCHO_POR_PAPEL, type AnchoPapel } from './types';

// Re-exports para que tests y callers puedan importar helpers + tokens
// desde el mismo path (`'../esc-pos'`).
export { MAPA_CARACTERES, ANCHO_POR_PAPEL };
export type { AnchoPapel };

/**
 * Genera lineas de texto pre-computadas para imprimir en termica.
 * Sin CRLF al final (lo agrega el adapter al enviar).
 */
export function armarTicketEscPos(
  factura: Factura,
  ancho: AnchoPapel,
): string[] {
  const cols = ANCHO_POR_PAPEL[ancho];
  const lineas: string[] = [];

  // ── Header (3 lineas) ─────────────────────────────────────────────────────
  lineas.push(centrarLinea(factura.snapshot.prestador.nombre, cols));
  lineas.push(centrarLinea(`NIT ${factura.snapshot.prestador.nit}`, cols));
  lineas.push(centrarLinea(factura.snapshot.prestador.municipio, cols));
  lineas.push('====');

  // ── Suscriptor ────────────────────────────────────────────────────────────
  lineas.push(`Suscriptor: ${factura.snapshot.suscriptor.codigo}`);
  const nombreEnvuelto = envolverLinea(
    factura.snapshot.suscriptor.nombre_apellidos,
    cols,
  );
  for (const l of nombreEnvuelto) lineas.push(l);
  lineas.push(`CC ${factura.snapshot.suscriptor.cedula}`);
  const dirEnvuelta = envolverLinea(
    factura.snapshot.suscriptor.direccion,
    cols,
  );
  for (const l of dirEnvuelta) lineas.push(l);
  lineas.push(`Mun: ${factura.snapshot.suscriptor.municipio}`);
  lineas.push(`Estrato: ${factura.snapshot.suscriptor.estrato}`);
  lineas.push('----');

  // ── Medidor ───────────────────────────────────────────────────────────────
  lineas.push(`Medidor: ${factura.snapshot.medidor.numero_medidor}`);
  lineas.push(`Estado: ${factura.snapshot.medidor.estado}`);
  lineas.push('----');

  // ── Periodo ───────────────────────────────────────────────────────────────
  lineas.push(`Periodo: ${factura.snapshot.periodo.id_periodo}`);
  lineas.push(`Emision: ${formatearFechaCorta(factura.fecha_emision)}`);
  lineas.push('----');

  // ── Lectura ───────────────────────────────────────────────────────────────
  lineas.push(`Lectura actual: ${factura.snapshot.lectura.lectura_actual} m3`);
  lineas.push(
    `Lectura anterior: ${factura.snapshot.lectura.lectura_anterior} m3`,
  );
  lineas.push(`Consumo: ${factura.snapshot.liquidacion.resultado.consumo_m3} m3`);
  lineas.push('====');

  // ── Liquidacion (desglose) ────────────────────────────────────────────────
  const resultado = factura.snapshot.liquidacion.resultado;
  lineas.push('Liquidacion:');
  lineas.push(`Cargo Fijo: ${formatearMontoCorto(resultado.cargo_fijo)}`);
  lineas.push(`Consumo: ${formatearMontoCorto(resultado.cc_total)}`);
  if (resultado.subsidio > 0) {
    lineas.push(`Subsidio: -${formatearMontoCorto(resultado.subsidio)}`);
  }
  if (resultado.contribucion > 0) {
    lineas.push(
      `Contribucion: +${formatearMontoCorto(resultado.contribucion)}`,
    );
  }

  // ── Otros valores ─────────────────────────────────────────────────────────
  for (const ov of factura.snapshot.otros_valores) {
    lineas.push(
      `${ov.concepto}: ${formatearMontoCorto(ov.valor)}`,
    );
  }

  // ── Saldo anterior ────────────────────────────────────────────────────────
  if (factura.snapshot.saldo_anterior > 0) {
    lineas.push(
      `Saldo anterior: ${formatearMontoCorto(factura.snapshot.saldo_anterior)}`,
    );
  }

  lineas.push('----');

  // ── Total ─────────────────────────────────────────────────────────────────
  const total =
    resultado.total +
    factura.snapshot.otros_valores.reduce((acc, ov) => acc + ov.valor, 0) +
    factura.snapshot.saldo_anterior;
  lineas.push(padRight('TOTAL:', Math.floor(cols / 2)));
  lineas.push(padRight(formatearMontoCorto(total), cols));
  lineas.push('====');

  // ── Footer ────────────────────────────────────────────────────────────────
  if (factura.referencia_pago) {
    lineas.push(`Ref. pago: ${factura.referencia_pago}`);
  }
  lineas.push(`Cod. Verificacion: ${factura.codigo_verificacion}`);
  lineas.push(`Factura: ${factura.numero_factura}`);
  lineas.push(`Operario: ${factura.snapshot.operario.nombre}`);

  // Aplicar normalizacion ASCII a todas las lineas (defensa contra
  // tildes que se hayan colado).
  return lineas.map(normalizarParaImpresora);
}

/**
 * Envuelve texto a `anchoCols` con algoritmo greedy word-break +
 * char-break fallback (parte con dash al final de linea).
 */
export function envolverLinea(texto: string, anchoCols: number): string[] {
  if (texto.length <= anchoCols) return [texto];

  const palabras = texto.split(' ');
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    // Palabra unitariamente mas larga que el ancho → char-break con dash.
    if (palabra.length > anchoCols) {
      if (actual.length > 0) {
        lineas.push(actual);
        actual = '';
      }
      let restante = palabra;
      while (restante.length > anchoCols) {
        lineas.push(restante.slice(0, anchoCols - 1) + '-');
        restante = restante.slice(anchoCols - 1);
      }
      actual = restante;
      continue;
    }

    // Word-break: si agregar la palabra + espacio excede el ancho, nueva linea.
    if (actual.length === 0) {
      actual = palabra;
    } else if (actual.length + 1 + palabra.length <= anchoCols) {
      actual = actual + ' ' + palabra;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual.length > 0) lineas.push(actual);
  return lineas;
}

/** Centra un texto agregando padding a la izquierda hasta `anchoCols`. */
export function centrarLinea(texto: string, anchoCols: number): string {
  if (texto.length >= anchoCols) return texto.slice(0, anchoCols);
  const paddingTotal = anchoCols - texto.length;
  const paddingIzq = Math.floor(paddingTotal / 2);
  const paddingDer = paddingTotal - paddingIzq;
  return ' '.repeat(paddingIzq) + texto + ' '.repeat(paddingDer);
}

/** Llena con espacios a la derecha hasta `anchoCols`. */
export function padRight(texto: string, anchoCols: number): string {
  if (texto.length >= anchoCols) return texto;
  return texto + ' '.repeat(anchoCols - texto.length);
}

/** Normaliza caracteres no-PC437 a ASCII fallback via `MAPA_CARACTERES`. */
export function normalizarParaImpresora(texto: string): string {
  // NFC normalization primero para estabilidad de formas compuestas.
  const nfc = texto.normalize('NFC');
  let out = '';
  for (const ch of nfc) {
    out += MAPA_CARACTERES[ch] ?? ch;
  }
  return out;
}

const MESES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
] as const;

/** Formatea ISO 8601 (YYYY-MM-DD) a "DD MMM YYYY" (espanol, mayusculas). */
export function formatearFechaCorta(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const anio = match[1];
  const mesNum = parseInt(match[2], 10);
  const dia = match[3];
  if (mesNum < 1 || mesNum > 12) return iso;
  return `${dia} ${MESES[mesNum - 1]} ${anio}`;
}

/** Formatea COP sin decimales con separador de miles (punto). */
export function formatearMontoCorto(monto: number): string {
  if (!Number.isFinite(monto)) return '0';
  const redondeado = Math.round(monto);
  const negativo = redondeado < 0;
  const absStr = Math.abs(redondeado).toString();
  const conPunto = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negativo ? `-${conPunto}` : conPunto;
}
