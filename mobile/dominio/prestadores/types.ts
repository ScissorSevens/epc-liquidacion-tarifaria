/**
 * Tipos del módulo PRESTADORES — multi-tenant según Q1-Q5 del design.
 *
 * Modelo: DB única con FK id_prestador en suscriptor/lectura/factura.
 * El id_prestador=0 está reservado para el prestador legacy "EPC-LEGACY"
 * (ver migration 009_prestador.sql) que mantiene compatibilidad con
 * datos preexistentes.
 */

export type EstadoPrestador = 'activo' | 'suspendido';

export type SegmentoPrestador = 1 | 2;

/**
 * Segmento según Res CRA 825/2017 art. 6 literal:
 *   - Segmento 1: prestadores con suscriptores urbanos en el rango
 *     "entre 2.501 y 5.000" (num_suscriptores_urbanos entre 2501 y 5000).
 *   - Segmento 2: resto (≤2.500 urbanos O rurales puros O rurales ≥50%
 *     del total).
 *
 * EPC rural = segmento 2 (la mayoría de los 300 prestadores vinculados
 * son rurales puros).
 */
export interface Prestador {
  readonly id_prestador: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly nit: string;
  readonly representante_legal: string;
  readonly representante_legal_cedula: string;
  readonly municipio: string;
  readonly departamento: string;
  readonly segmento: SegmentoPrestador;
  readonly num_suscriptores_urbanos: number;
  readonly num_suscriptores_rurales: number;
  readonly contacto: string | null;
  readonly estado: EstadoPrestador;
  readonly created_at: string;
  readonly updated_at: string;
  /**
   * Área de Prestación del Servicio (APS) declarada ante la CRA
   * (Res CRA 825/2017 Art. 5). Opcional: `null` para prestadores
   * legacy sin APS registrada.
   *
   * Fase 1 (`param-tarifa-res-825-compliance-phase1`).
   */
  readonly aps: string | null;
}

export type PrestadorBorrador = Omit<Prestador, 'id_prestador' | 'created_at' | 'updated_at'>;

/**
 * Input para crear un prestador. `estado`, `contacto` y `aps` son opcionales
 * para que la factory `crearPrestador` aplique defaults (`'activo'`, `null`,
 * `null` respectivamente). El resto replica el shape de `PrestadorBorrador`
 * y se exige en creación.
 */
export type CrearPrestadorInput = Omit<
  PrestadorBorrador,
  'estado' | 'contacto' | 'aps'
> & {
  readonly estado?: EstadoPrestador;
  readonly contacto?: string | null;
  readonly aps?: string | null;
};

export type ActualizarPrestadorInput = Partial<
  Pick<
    Prestador,
    | 'nombre'
    | 'nit'
    | 'municipio'
    | 'departamento'
    | 'segmento'
    | 'num_suscriptores_urbanos'
    | 'num_suscriptores_rurales'
    | 'contacto'
    | 'representante_legal'
    | 'representante_legal_cedula'
    | 'aps'
  >
>;

/**
 * Filtros para listar prestadores. La paginación es 50 por defecto
 * (alineado con endpoint backend). `search` busca en codigo/nombre/
 * municipio/NIT (LIKE %search%).
 */
export interface FiltrosListarPrestador {
  readonly estado?: EstadoPrestador;
  readonly segmento?: SegmentoPrestador;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Puerto del repositorio de prestadores. La implementación SQLite vive
 * en `src/prestadores/prestador-repository-sqlite.ts` y se espeja en
 * `mobile/dominio/prestadores/`.
 */
export interface PrestadorRepository {
  crear(data: CrearPrestadorInput): Promise<Prestador>;
  obtenerPorId(id_prestador: number): Promise<Prestador | null>;
  existePorCodigo(codigo: string): Promise<boolean>;
  listar(filtros?: FiltrosListarPrestador): Promise<readonly Prestador[]>;
  actualizar(id_prestador: number, cambios: ActualizarPrestadorInput): Promise<Prestador>;
  suspender(id_prestador: number): Promise<Prestador>;
  reactivar(id_prestador: number): Promise<Prestador>;
  eliminar(id: number): Promise<void>;
}

/**
 * Catálogo de mensajes de error del módulo prestadores. Single source of
 * truth para que tests e implementaciones compartan literales en español.
 */
export const MENSAJES_ERROR_PRESTADOR = {
  CODIGO_VACIO: 'codigo no puede estar vacío',
  CODIGO_LARGO: 'codigo no puede superar 50 caracteres',
  CODIGO_DUPLICADO: 'ya existe un prestador con ese codigo',
  NOMBRE_VACIO: 'nombre no puede estar vacío',
  NOMBRE_LARGO: 'nombre no puede superar 200 caracteres',
  NIT_VACIO: 'nit no puede estar vacío',
  NIT_LARGO: 'nit no puede superar 20 caracteres',
  REPRESENTANTE_LEGAL_VACIO: 'representante_legal no puede estar vacío',
  CEDULA_REP_LEGAL_INVALIDA:
    'cédula del representante legal debe tener entre 6 y 12 dígitos',
  MUNICIPIO_VACIO: 'municipio no puede estar vacío',
  MUNICIPIO_LARGO: 'municipio no puede superar 100 caracteres',
  DEPARTAMENTO_VACIO: 'departamento no puede estar vacío',
  DEPARTAMENTO_LARGO: 'departamento no puede superar 100 caracteres',
  SEGMENTO_INVALIDO: 'segmento debe ser 1 o 2',
  NUM_URBANOS_NEGATIVO: 'num_suscriptores_urbanos no puede ser negativo',
  NUM_RURALES_NEGATIVO: 'num_suscriptores_rurales no puede ser negativo',
  ESTADO_INVALIDO: "estado debe ser 'activo' o 'suspendido'",
  PRESTADOR_NO_ENCONTRADO: 'prestador no encontrado',
} as const;
