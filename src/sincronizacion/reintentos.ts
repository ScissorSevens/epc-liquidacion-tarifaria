/**
 * Cálculo de delay exponencial para reintentos.
 * Función pura — sin side effects, fácil de testear.
 *
 * Fórmula: delay = 1000 * 2^(intentos - 1)
 *   intento 1 → 1000ms
 *   intento 2 → 2000ms
 *   intento 3 → 4000ms
 *   intento 4 → 8000ms
 *   intento 5 → 16000ms
 */

export const MAX_INTENTOS = 5;

export function calcularDelayReintento(intentos: number): number {
  if (intentos < 1) {
    throw new Error(`intentos debe ser >= 1, recibido: ${intentos}`);
  }
  return 1000 * Math.pow(2, intentos - 1);
}

/**
 * Determina si un item está listo para reintentarse según su último intento.
 */
export function listoParaReintentar(intentos: number, ultimoIntentoEn: Date | null): boolean {
  if (intentos === 0 || ultimoIntentoEn === null) {
    return true; // primer intento — sin restricción
  }
  const delayRequerido = calcularDelayReintento(intentos);
  const transcurrido = Date.now() - ultimoIntentoEn.getTime();
  return transcurrido >= delayRequerido;
}
