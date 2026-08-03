/**
 * Mínimo vital del prestador — tabla relacionada 1:1 con prestador.
 *
 * Separa la noción de "minimo vital" de ParametrosTarifa por 3
 * razones (decisión del user):
 *   1. **Vigencia independiente**: el minimo vital puede cambiar
 *      dentro de un periodo tarifario (ej: Acuerdo Municipal nuevo
 *      que cambia el m³ gratis). ParametrosTarifa tiene periodo 5
 *      años (Res 825/2017); minimo vital puede tener su propio
 *      calendario.
 *   2. **Estratos aplicables**: un prestador puede dar mínimo vital
 *      solo a estratos 1, 2 y 3 (los subsidiables segun L142/1994).
 *      ParametrosTarifa NO modela estratos.
 *   3. **Opcional**: no todos los prestadores configuran mínimo vital.
 *      La fila se crea solo cuando se activa (cf. `minimo_vital: null`
 *      en ParametrosTarifa).
 *
 * Multi-tenant: cada prestador tiene como maximo UN minimo vital
 * vigente en cualquier momento. La unicidad se enforce en SQL via
 * `UNIQUE (id_prestador, vigente_desde)`.
 */

export interface MinimoVital {
  readonly id_minimo_vital: number;
  readonly id_prestador: number;
  /**
   * Metros cubicos gratis por suscriptor / mes. Default 6 (norma del
   * sistema). null = "aplica a TODO el consumo" (caso edge: el
   * prestador regala TODO lo que el suscriptor consuma bajo minimo
   * vital — no usado en la practica pero contemplado).
   */
  readonly metros_cubicos: number | null;
  /**
   * Estratos socioeconomicos a los que aplica el minimo vital.
   * Segun L142/1994 art. 99.1, los prestadores pueden optar por
     subsidiar estratos 1, 2, 3. Contribuciones aplican a 5, 6.
   * Array vacio = "aplica a todos los estratos".
   */
  readonly estratos_aplica: readonly number[];
  readonly vigente_desde: string;
  readonly vigente_hasta: string;
  readonly created_at: string;
}

/** Borrador para crear un MinimoVital (sin id_minimo_vital ni created_at). */
export type MinimoVitalBorrador = Omit<MinimoVital, 'id_minimo_vital' | 'created_at'>;

export interface FiltrosListarMinimoVital {
  readonly id_prestador: number;
  readonly vigenteEn?: string;
}

/**
 * Puerto del repositorio de MinimoVital.
 *
 * Decisión de diseño: NO se persiste dentro de ParametrosTarifa
 * (ver comentario al inicio del archivo). Es una entidad hermana
 * con su propio repositorio para que:
 *   - la vigencia del minimo vital pueda actualizarse sin tocar
 *     ParametrosTarifa (que es inmutable en cierto modo — se crea
 *     un registro nuevo por periodo).
 *   - el motor tarifario pueda JOIN entre las dos tablas cuando
 *     liquide una factura.
 */
export interface MinimoVitalRepository {
  crear(data: MinimoVitalBorrador): Promise<MinimoVital>;
  obtenerPorId(id_minimo_vital: number): Promise<MinimoVital | null>;
  /**
   * Retorna el MinimoVital vigente del prestador en la fecha dada.
   * `null` si no hay minimo vital vigente.
   */
  buscarVigente(id_prestador: number, fecha: string): Promise<MinimoVital | null>;
  listar(filtros: FiltrosListarMinimoVital): Promise<readonly MinimoVital[]>;
  eliminar(id_minimo_vital: number): Promise<void>;
}

export const MENSAJES_ERROR_MINIMO_VITAL = {
  PRESTADOR_REQUERIDO: 'id_prestador requerido',
  METROS_NEGATIVO: 'metros_cubicos no puede ser negativo',
  ESTRATOS_INVALIDO: 'estratos_aplica debe contener enteros 1-6',
  FECHA_DESDE_REQUERIDA: 'vigente_desde requerida',
  FECHA_HASTA_REQUERIDA: 'vigente_hasta requerida',
} as const;
