/**
 * Port Hasher — abstracción síncrona sobre algoritmos de hash criptográfico.
 *
 * El dominio NUNCA debe importar `crypto` directamente: rompe el bundle
 * Metro de RN y viola la regla hexagonal (dominio → runtime). Los módulos
 * que necesitan hashes reciben un `Hasher` por inyección.
 *
 * Implementaciones: ver `src/shared/adapters/hasher-js.ts`.
 */
export interface Hasher {
  sha256(input: string): string;
}
