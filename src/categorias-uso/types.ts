/**
 * Categoría de uso del suscriptor. Define cómo el motor tarifario
 * aplica subsidio/contribución (ver Q10 spec y motor-tarifario.ts:
 * calcularFactor).
 *
 *  - residencial: aplica subsidios E1-E3 o contribuciones E5-E6
 *    según estrato + Acuerdo Municipal.
 *  - comercial: SOLO contribución del Acuerdo (factor_contribucion_
 *    comercial, default +0.50), NUNCA subsidio por estrato.
 *  - industrial: SOLO contribución del Acuerdo (factor_contribucion_
 *    industrial, default +0.30), NUNCA subsidio por estrato.
 *  - oficial: factor 0 (tarifa plena), NUNCA subsidio NUNCA
 *    contribución.
 *  - especial: alias de residencial (placeholder Q10). Forward-
 *    compatible con reglas futuras que EPC pueda necesitar.
 *
 * Default para suscriptores nuevos: 'residencial' (migration 012).
 */
export type CategoriaUso = 'residencial' | 'comercial' | 'industrial' | 'oficial' | 'especial';

export const CATEGORIAS_USO: readonly CategoriaUso[] = [
  'residencial',
  'comercial',
  'industrial',
  'oficial',
  'especial',
] as const;

export const CATEGORIA_USO_DEFAULT: CategoriaUso = 'residencial';

export const MENSAJES_ERROR_CATEGORIA_USO = {
  VALOR_INVALIDO: "categoria_uso debe ser 'residencial'|'comercial'|'industrial'|'oficial'|'especial'",
  REQUERIDO: 'categoria_uso requerido',
} as const;

/**
 * Etiquetas legibles para UI. Centralizadas para que la app mobile y
 * el backend .NET puedan reutilizar las mismas descripciones.
 */
export const ETIQUETAS_CATEGORIA_USO: Readonly<Record<CategoriaUso, string>> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  industrial: 'Industrial',
  oficial: 'Oficial',
  especial: 'Especial',
};
