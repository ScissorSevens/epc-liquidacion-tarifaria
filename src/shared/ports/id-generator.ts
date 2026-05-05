/**
 * Port IdGenerator — abstracción síncrona sobre generación de identificadores
 * únicos (típicamente UUID v4).
 *
 * El dominio NUNCA debe importar `crypto.randomUUID` directamente. Los
 * módulos que asignan ids a aggregates reciben un `IdGenerator` por
 * inyección.
 *
 * Implementaciones: ver `src/shared/adapters/id-generator-uuid.ts`.
 */
export interface IdGenerator {
  uuid(): string;
}
