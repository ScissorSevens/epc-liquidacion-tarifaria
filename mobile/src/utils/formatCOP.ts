// mobile/src/utils/formatCOP.ts
//
// Helper display-only para formatear pesos colombianos (COP) en el
// card ResumenCargos de ParametrosTarifa (parametros-tarifa-impeccable-v2
// Commit 2 — D3 del design).
//
// Contrato:
//   - Input: number (cargos resultantes del calculo tarifario).
//   - Output: string con formato `$ X.XXX.XXX` (es-CO, cents truncados).
//   - Defensivo: NaN / Infinity / -Infinity → "$ 0" (no rompe la UI
//     si el dominio devuelve algo raro).
//
// Decisiones de design (D3 — parametros-tarifa-impeccable-v2):
//   - SOLO display. No parsea input del usuario (los FormField siguen
//     aceptando numero crudo). Bidireccional dejaria inputs con
//     `$`/`€` que rompen los tests existentes.
//   - `maximumFractionDigits: 0` — los cargos tarifarios son COP enteros
//     (no se calculan cents). Truncar evita ruido visual.
//   - `Intl.NumberFormat('es-CO')` da el formato natural con separador
//     de miles `.` y prefijo `$ ` (espacio entre simbolo y numero).
//   - Defensive check evita `'$NaN'` o `'$∞'` en runtime edge cases.

/**
 * Formatea un numero como peso colombiano display-only.
 *
 * @param value Numero a formatear.
 * @returns String formato `$ X.XXX.XXX` o `$ 0` si no es finito.
 *
 * NOTA: `Intl.NumberFormat('es-CO', {style:'currency'})` usa un
 * caracter NBSP (`\u00A0`) entre el simbolo `$` y el numero (no un
 * espacio normal). Esto rompe busquedas `getByText('$ 12.000.000')`
 * en jest-expo si el caller no lo sabe. Normalizamos a espacio regular
 * para que `getByText` con espacios funcione y los tests puedan copiar
 * el formato exacto del design.
 */
export function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return '$ 0';
  const formatted = value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
  // Reemplaza NBSP (\u00A0) por espacio regular.
  return formatted.replace(/\u00A0/g, ' ');
}