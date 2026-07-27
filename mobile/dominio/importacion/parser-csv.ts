/**
 * Parser CSV puro para importacion de suscriptores + medidores.
 *
 * Diseño: funcion pura, sin IO. El caller lee el archivo y le pasa el
 * texto. Esto permite testear sin tocar disco y reusar el parser desde
 * mobile (donde el texto viene del DocumentPicker, no de fs).
 *
 * Formatos aceptados:
 *
 * NUEVO (9 columnas — desde COR-09):
 *   nombre_apellidos,cedula,municipio,direccion,estrato,
 *   matricula_inmobiliaria,numero_catastral,fecha_instalacion,
 *   observaciones_medidor
 *
 *   `cedula` y `municipio` son requeridos por el dominio
 *   `crearSuscriptor` (el suscriptor es una persona ubicada
 *   geográficamente — sin estos datos el dominio rechaza el alta).
 *   Si vienen vacíos en una fila, el parser los preserva como `''`
 *   para que el importador falle con `MENSAJES_ERROR_SUSCRIPTOR.*`
 *   y el operador vea el motivo claro, no un "undefined" críptico.
 *
 * LEGACY (9 columnas — backward compat con CSVs anteriores al
 * multi-tenant / antes de COR-09):
 *   codigo,nombre_apellidos,direccion,estrato,matricula_inmobiliaria,
 *   numero_catastral,numero_medidor,fecha_instalacion,observaciones_medidor
 *
 *   En este formato `cedula` y `municipio` quedan como `undefined` en
 *   la FilaCSV, y el importador los rellena con `''` antes de
 *   invocar `crearSuscriptor`, que los rechaza (la migración de esos
 *   datos legacy es tarea de una fase posterior, no de este parser).
 *
 * Politica de errores: un error por linea NO aborta. Se acumulan en
 * `errores` y las filas validas siguen en `filas`. Asi el usuario ve
 * TODOS los problemas de una corrida y los corrige juntos.
 *
 * Soporte CSV: comillas dobles para campos con coma (RFC 4180 minimo).
 * NO soporta comillas escapadas (`""`) ni saltos de linea dentro de
 * campos — el dominio EPC no los necesita y agregar complejidad sin
 * caso de uso es YAGNI.
 */

import type { ErrorParseo, FilaCSV, ResultadoParseo } from './types';

/**
 * Header NUEVO (9 columnas, desde COR-09): cedula y municipio son
 * posiciones explícitas. El dominio `crearSuscriptor` los exige NO
 * vacíos, así que el CSV debe traerlos por fila. Verificado por los
 * tests T-CSV-1..4 en `parser-csv.test.ts`.
 */
const HEADER_NUEVO = [
  'nombre_apellidos',
  'cedula',
  'email',
  'telefono',
  'municipio',
  'direccion',
  'estrato',
  'matricula_inmobiliaria',
  'numero_catastral',
  'fecha_instalacion',
  'observaciones_medidor',
] as const;

const HEADER_NUEVO_SIN_CONTACTO = [
  'nombre_apellidos',
  'cedula',
  'municipio',
  'direccion',
  'estrato',
  'matricula_inmobiliaria',
  'numero_catastral',
  'fecha_instalacion',
  'observaciones_medidor',
] as const;

/**
 * Header nuevo exportado: lo usa `ImportarCsv.tsx` (UI) para anunciar
 * las 9 columnas que el parser espera. Exportar la misma constante
 * desde ambos lados y comparar token-a-token en tests mantiene el
 * contrato vivo — si la UI cambia una columna sin actualizar el
 * parser (o viceversa), el test de contrato en
 * `__tests__/pantallas/importar-csv.test.tsx` rompe (COR-09).
 */
export { HEADER_NUEVO };

/** Header legacy (9 columnas): backward compat con CSVs anteriores
 *  a COR-09. Cedula y municipio quedan `undefined` en FilaCSV. */
const HEADER_LEGACY = [
  'codigo',
  'nombre_apellidos',
  'direccion',
  'estrato',
  'matricula_inmobiliaria',
  'numero_catastral',
  'numero_medidor',
  'fecha_instalacion',
  'observaciones_medidor',
] as const;

/** Alias para el header esperado por defecto (nuevo de 9 cols). */
const HEADER_ESPERADO = HEADER_NUEVO;

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea una linea CSV respetando comillas dobles para campos con coma.
 *
 * No soporta `""` escapado ni newlines dentro de comillas (YAGNI para
 * el dominio EPC).
 */
function parsearLineaCSV(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      dentroComillas = !dentroComillas;
      continue;
    }
    if (c === ',' && !dentroComillas) {
      campos.push(actual);
      actual = '';
      continue;
    }
    actual += c;
  }
  campos.push(actual);
  return campos;
}

/**
 * Parsea un CSV completo y devuelve filas validas + errores acumulados.
 * Acepta tanto el formato nuevo (7 cols) como el legacy (9 cols).
 */
export function parsearCSV(texto: string): ResultadoParseo {
  const filas: FilaCSV[] = [];
  const errores: ErrorParseo[] = [];

  // Soporta CRLF y LF; ignora lineas totalmente vacias.
  const lineas = texto.split(/\r?\n/);

  if (lineas.length === 0 || lineas[0]?.trim() === '') {
    return {
      filas: [],
      errores: [
        { linea: 1, mensaje: 'CSV vacio: falta el header esperado' },
      ],
    };
  }

  const headerCampos = parsearLineaCSV(lineas[0]!).map((c) => c.trim());

  const esNuevoContacto =
    headerCampos.length === HEADER_NUEVO.length &&
    HEADER_NUEVO.every((esperado, i) => headerCampos[i] === esperado);

  const esNuevoSinContacto =
    headerCampos.length === HEADER_NUEVO_SIN_CONTACTO.length &&
    HEADER_NUEVO_SIN_CONTACTO.every((esperado, i) => headerCampos[i] === esperado);

  const esNuevo = esNuevoContacto || esNuevoSinContacto;

  const esLegacy =
    headerCampos.length === HEADER_LEGACY.length &&
    HEADER_LEGACY.every((esperado, i) => headerCampos[i] === esperado);

  if (!esNuevo && !esLegacy) {
    return {
      filas: [],
      errores: [
        {
          linea: 1,
          mensaje: `header invalido: se esperaba '${HEADER_ESPERADO.join(',')}' (9 cols) o el formato legado de 9 columnas`,
        },
      ],
    };
  }

  for (let i = 1; i < lineas.length; i++) {
    const cruda = lineas[i] ?? '';
    if (cruda.trim() === '') continue;
    const numLinea = i + 1; // 1-indexed para el usuario
    const campos = parsearLineaCSV(cruda);

    const expectedCols = esLegacy
      ? HEADER_LEGACY.length
      : esNuevoContacto
        ? HEADER_NUEVO.length
        : HEADER_NUEVO_SIN_CONTACTO.length;
    if (campos.length !== expectedCols) {
      errores.push({
        linea: numLinea,
        mensaje: `cantidad de columnas (${campos.length}) no coincide con el header (${expectedCols})`,
      });
      continue;
    }

    let codigo: string | undefined;
    let nombre_apellidos: string;
    let cedula: string;
    let email: string | undefined;
    let telefono: string | undefined;
    let municipio: string;
    let direccion: string;
    let estratoCrudo: string;
    let matricula: string;
    let catastral: string;
    let numero_medidor: string | undefined;
    let fecha_instalacion: string;
    let observaciones: string;

    if (esLegacy) {
      const trimmed = campos.map((c) => c.trim());
      [
        codigo,
        nombre_apellidos,
        direccion,
        estratoCrudo,
        matricula,
        catastral,
        numero_medidor,
        fecha_instalacion,
        observaciones,
      ] = trimmed as [string, string, string, string, string, string, string, string, string];
      // En LEGACY cedula/municipio no existen: los dejamos `undefined`.
      // El importador rellena con `''` antes de invocar crearSuscriptor.
      cedula = '' as string;
      municipio = '' as string;
    } else if (esNuevoContacto) {
      const trimmed = campos.map((c) => c.trim());
      [
        nombre_apellidos,
        cedula,
        email,
        telefono,
        municipio,
        direccion,
        estratoCrudo,
        matricula,
        catastral,
        fecha_instalacion,
        observaciones,
      ] = trimmed as [string, string, string, string, string, string, string, string, string, string, string];
      codigo = undefined;
      numero_medidor = undefined;
    } else {
      const trimmed = campos.map((c) => c.trim());
      [
        nombre_apellidos,
        cedula,
        municipio,
        direccion,
        estratoCrudo,
        matricula,
        catastral,
        fecha_instalacion,
        observaciones,
      ] = trimmed as [string, string, string, string, string, string, string, string, string];
      codigo = undefined;
      numero_medidor = undefined;
    }

    const estratoNum = Number(estratoCrudo!);
    if (
      !Number.isInteger(estratoNum) ||
      estratoNum < 1 ||
      estratoNum > 6
    ) {
      errores.push({
        linea: numLinea,
        mensaje: `estrato invalido '${estratoCrudo}': debe ser entero entre 1 y 6`,
      });
      continue;
    }

    if (!REGEX_FECHA_ISO.test(fecha_instalacion! ?? '')) {
      errores.push({
        linea: numLinea,
        mensaje: `fecha_instalacion invalida '${fecha_instalacion}': se esperaba formato YYYY-MM-DD`,
      });
      continue;
    }

    // Construimos sin claves opcionales si vienen vacias, para que
    // `Object.keys` y deep-equal en tests no las vean como undefined.
    // EXCEPCION: cedula y municipio del header NUEVO se preservan como
    // string ('' si vienen vacíos) para que `crearSuscriptor` falle con
    // MENSAJES_ERROR_SUSCRIPTOR.* y el operador vea el motivo claro.
    // Ver tests T-CSV-1 y T-CSV-4 en parser-csv.test.ts (COR-09).
    const fila: Mutable<FilaCSV> = {
      linea: numLinea,
      nombre_apellidos: nombre_apellidos!,
      direccion: direccion!,
      estrato: estratoNum,
      fecha_instalacion: fecha_instalacion!,
    };
    if (codigo) fila.codigo = codigo;
    if (numero_medidor) fila.numero_medidor = numero_medidor;
    if (matricula) fila.matricula_inmobiliaria = matricula;
    if (catastral) fila.numero_catastral = catastral;
    if (observaciones) fila.observaciones_medidor = observaciones;
    if (!esLegacy) {
      // Cedula y municipio del NUEVO header: SIEMPRE se setean (aún si
      // vacíos). En LEGACY no se setean (quedan undefined), y el
      // importador rellena con '' antes de `crearSuscriptor`.
      fila.cedula = cedula!;
      fila.municipio = municipio!;
      if (email) fila.email = email;
      if (telefono) fila.telefono = telefono;
    }

    filas.push(fila);
  }

  return { filas, errores };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
