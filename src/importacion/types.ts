/**
 * Tipos del modulo de importacion CSV de suscriptores + medidores.
 *
 * Se separa parser (texto -> filas validadas) de importador (filas ->
 * persistencia). El parser es puro y testeable sin DB; el importador
 * orquesta repositorios y aplica politica de duplicados.
 */

/**
 * Una fila CSV ya parseada y validada sintacticamente.
 *
 * `linea` se conserva para que los errores posteriores del importador
 * (FK, UK runtime, etc.) puedan referenciar el numero de linea en el
 * archivo original que vio el usuario.
 *
 * Campos opcionales del CSV (matricula, catastral, observaciones)
 * llegan como `undefined` cuando la celda esta vacia, NO como string
 * vacio. Esto preserva la semantica del dominio.
 */
export interface FilaCSV {
  readonly linea: number;
  readonly codigo?: string;           // opcional: se auto-genera si viene vacío
  readonly nombre_apellidos: string;
  readonly direccion: string;
  readonly estrato: number;
  readonly matricula_inmobiliaria?: string;
  readonly numero_catastral?: string;
  readonly aplica_subsidio?: boolean;   // opcional: default false si no viene en el CSV
  readonly numero_medidor?: string;   // opcional: se auto-genera si viene vacío
  readonly fecha_instalacion: string;
  readonly observaciones_medidor?: string;
}

/**
 * Error de parseo asociado a una linea especifica del CSV.
 *
 * `linea` 1 = header; >=2 = filas de datos (1-indexed para matchear
 * lo que el usuario ve en su editor).
 */
export interface ErrorParseo {
  readonly linea: number;
  readonly mensaje: string;
}

/**
 * Resultado del parseo: filas validas + errores acumulados.
 *
 * Politica: un error en una linea NO aborta el parseo del resto.
 * Esto permite al usuario corregir todos los problemas de una vez
 * en lugar de corregir-reintentar uno a uno.
 */
export interface ResultadoParseo {
  readonly filas: ReadonlyArray<FilaCSV>;
  readonly errores: ReadonlyArray<ErrorParseo>;
}

/**
 * Motivo por el que una fila (o parte de ella) NO fue persistida pero
 * tampoco constituye un error: simplemente la entidad ya existia.
 *
 *  - 'suscriptor_duplicado': la fila trae `codigo` que ya existe en BD.
 *    El suscriptor no se crea pero el medidor SI se intenta (asociado
 *    al suscriptor existente — caso real: cliente registrado al que se
 *    le instala un medidor adicional).
 *  - 'medidor_duplicado': la fila trae `numero_medidor` que ya existe.
 *    El medidor no se crea (el suscriptor SI se crea si era nuevo).
 */
export type MotivoSalto = 'suscriptor_duplicado' | 'medidor_duplicado';

export interface ItemSaltado {
  readonly linea: number;
  readonly motivo: MotivoSalto;
  readonly codigo?: string;
  readonly numero_medidor?: string;
}

/**
 * Error ocurrido durante la persistencia de una fila (FK invalida,
 * CHECK constraint, etc.). NO aborta el lote: la siguiente fila se
 * procesa igual.
 */
export interface ErrorImportacion {
  readonly linea: number;
  readonly mensaje: string;
}

export interface ResultadoImportacion {
  readonly suscriptoresCreados: number;
  readonly medidoresCreados: number;
  readonly saltados: ReadonlyArray<ItemSaltado>;
  readonly errores: ReadonlyArray<ErrorImportacion>;
}
