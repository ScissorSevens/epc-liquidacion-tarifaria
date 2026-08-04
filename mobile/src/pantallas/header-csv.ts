// mobile/src/pantallas/header-csv.ts
//
// Constante separada del componente ImportarCsv.tsx para que los tests
// de contrato (importar-csv-header.test.ts) puedan importarla sin
// arrastrar el arbol de dependencias nativas que el componente React
// requiere (react-native, expo-*, get-bootstrap → expo-sqlite, etc).
//
// El componente ImportarCsv.tsx re-importa este archivo via
// `import { HEADER_ESPERADO_TXT } from './header-csv'`, manteniendo una
// unica fuente de verdad.
//
// Header nuevo (11 columnas): email y telefono son opcionales;
// cedula y municipio son requeridos por el dominio crearSuscriptor.
// DEBE coincidir token-a-token con HEADER_NUEVO en parser-csv.ts.
export const HEADER_ESPERADO_TXT =
  'nombre_apellidos,cedula,email,telefono,municipio,direccion,estrato,matricula_inmobiliaria,numero_catastral,fecha_instalacion,observaciones_medidor';