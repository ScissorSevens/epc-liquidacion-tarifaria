/**
 * Parser CSV puro para importacion de suscriptores + medidores.
 *
 * Diseño: funcion pura, sin IO. El caller lee el archivo y le pasa el
 * texto. Esto permite testear sin tocar disco y reusar el parser desde
 * mobile (donde el texto viene del DocumentPicker, no de fs).
 *
 * Formato esperado (header en orden estricto):
 *   codigo,nombre_apellidos,direccion,estrato,matricula_inmobiliaria,
 *   numero_catastral,numero_medidor,fecha_instalacion,observaciones_medidor
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

const HEADER_ESPERADO = [
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
  const headerOk =
    headerCampos.length === HEADER_ESPERADO.length &&
    HEADER_ESPERADO.every((esperado, i) => headerCampos[i] === esperado);
  if (!headerOk) {
    return {
      filas: [],
      errores: [
        {
          linea: 1,
          mensaje: `header invalido: se esperaba '${HEADER_ESPERADO.join(',')}'`,
        },
      ],
    };
  }

  for (let i = 1; i < lineas.length; i++) {
    const cruda = lineas[i] ?? '';
    if (cruda.trim() === '') continue;
    const numLinea = i + 1; // 1-indexed para el usuario
    const campos = parsearLineaCSV(cruda);

    if (campos.length !== HEADER_ESPERADO.length) {
      errores.push({
        linea: numLinea,
        mensaje: `cantidad de columnas (${campos.length}) no coincide con el header (${HEADER_ESPERADO.length})`,
      });
      continue;
    }

    const [
      codigo,
      nombre_apellidos,
      direccion,
      estratoCrudo,
      matricula,
      catastral,
      numero_medidor,
      fecha_instalacion,
      observaciones,
    ] = campos.map((c) => c.trim());

    const estratoNum = Number(estratoCrudo);
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

    if (!REGEX_FECHA_ISO.test(fecha_instalacion ?? '')) {
      errores.push({
        linea: numLinea,
        mensaje: `fecha_instalacion invalida '${fecha_instalacion}': se esperaba formato YYYY-MM-DD`,
      });
      continue;
    }

    // Construimos sin claves opcionales si vienen vacias, para que
    // `Object.keys` y deep-equal en tests no las vean como undefined.
    const fila: Mutable<FilaCSV> = {
      linea: numLinea,
      codigo: codigo!,
      nombre_apellidos: nombre_apellidos!,
      direccion: direccion!,
      estrato: estratoNum,
      numero_medidor: numero_medidor!,
      fecha_instalacion: fecha_instalacion!,
    };
    if (matricula) fila.matricula_inmobiliaria = matricula;
    if (catastral) fila.numero_catastral = catastral;
    if (observaciones) fila.observaciones_medidor = observaciones;

    filas.push(fila);
  }

  return { filas, errores };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
