/**
 * Tipos del dominio `concepto-otro-valor` y contrato del repositorio.
 *
 * Justificacion: este modulo nace en `factura-compliance-hardening` para
 * separar la definicion regulatoria de los conceptos (Res CRA 1038/2026
 * §4 §10) de la constante hardcoded `OtrosValoresCatalogo` que aun vive en
 * `dominio/factura/otros-valores-catalogo.ts`.
 *
 * Versionado: cada seed lleva `version = '1038-2026-v1'` para auditoria
 * regulatoria. Cambios futuros a la lista cerrada de conceptos exigen
 * publicacion de una nueva migration con `version = '1038-2026-vN'`,
 * manteniendo trazabilidad historica.
 *
 * El repository es READ-ONLY por design: las altas / bajas / cambios
 * son regulatorios y se aplican via migrations.
 */

export interface ConceptoOtroValor {
  readonly idConcepto: number;
  readonly codigo: string;
  readonly descripcion: string;
  readonly version: string;
  readonly activo: boolean;
  readonly requiereGlosa: boolean;
  readonly createdAt: string;
}

/**
 * Repository port: solo lectura. La definicion del catalogo vive en SQLite
 * via la migration 021 (versionada) y es read-only desde el codigo.
 *
 * Mantiene paridad semantica con `OtrosValoresCatalogo` (constante legacy)
 * que la UI `OtrosValoresFactura` consume — pero la fuente de verdad es
 * la tabla, no la constante.
 *
 * Async: ambos adapters (Node better-sqlite3 y Expo SQLite) devuelven
 * Promises para coherencia con el resto del proyecto. La UI consume
 * `await repo.listar(true)` y `await repo.buscarPorCodigo(codigo)`.
 */
export interface ConceptoOtroValorRepository {
  listar(activo?: boolean): Promise<readonly ConceptoOtroValor[]>;
  buscarPorCodigo(codigo: string): Promise<ConceptoOtroValor | null>;
}

/** Res CRA 1038/2026 — version regulatoria inicial del catalogo. */
export const CATALOGO_VERSION_INICIAL = '1038-2026-v1';

/**
 * Codigos canónicos de Res CRA 1038/2026. La migration 021 los siembra
 * como `activo=1` y `version = CATALOGO_VERSION_INICIAL`. Esta constante
 * sirve para tests y para el seed factory.
 */
export const CODIGOS_CONCEPTO_OTRO_VALOR = [
  'SALDO_ANTERIOR',
  'INTERESES_AUTORIZADOS',
  'RECONEXION',
  'FINANCIACION',
  'MATERIALES_ACOMETIDA',
  'AJUSTES_DEVOLUCIONES',
  'OTROS_AUTORIZADOS',
] as const;

export type CodigoConceptoOtroValor =
  (typeof CODIGOS_CONCEPTO_OTRO_VALOR)[number];

/**
 * Metadata normativo de los 7 conceptos canónicos.
 *
 * Mantiene paridad con `OtrosValoresCatalogo` (constante legacy) — la
 * migration 021 usa esta tabla para sembrar la DB.
 */
export const DESCRIPCIONES_CONCEPTO_OTRO_VALOR: Readonly<
  Record<CodigoConceptoOtroValor, { descripcion: string; requiereGlosa: boolean }>
> = Object.freeze({
  SALDO_ANTERIOR: Object.freeze({
    descripcion: 'Saldo pendiente de periodos anteriores',
    requiereGlosa: false,
  }),
  INTERESES_AUTORIZADOS: Object.freeze({
    descripcion: 'Intereses de mora autorizados por la regulación',
    requiereGlosa: true,
  }),
  RECONEXION: Object.freeze({
    descripcion: 'Cargo por reconexión del servicio',
    requiereGlosa: false,
  }),
  FINANCIACION: Object.freeze({
    descripcion: 'Cuota de financiación de deuda previa',
    requiereGlosa: true,
  }),
  MATERIALES_ACOMETIDA: Object.freeze({
    descripcion: 'Materiales de acometida',
    requiereGlosa: false,
  }),
  AJUSTES_DEVOLUCIONES: Object.freeze({
    descripcion: 'Ajustes o devoluciones de periodos anteriores',
    requiereGlosa: true,
  }),
  OTROS_AUTORIZADOS: Object.freeze({
    descripcion: 'Otros conceptos autorizados por la regulación',
    requiereGlosa: true,
  }),
});
