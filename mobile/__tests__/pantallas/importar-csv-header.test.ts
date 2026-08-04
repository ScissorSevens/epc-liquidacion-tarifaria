/**
 * Test de contrato: el header que la UI de ImportarCsv anuncia al usuario
 * DEBE coincidir token-a-token con el header que parsearCSV acepta.
 *
 * Bug original (COR-09): la UI mostraba "7 columnas" sin `cedula` ni
 * `municipio`, pero el dominio `crearSuscriptor` exige ambos NO vacíos.
 * Resultado: CSVs que la UI calificaba como "válidos" fallaban al
 * persistir con MENSAJES_ERROR_SUSCRIPTOR.CEDULA_VACIA / MUNICIPIO_VACIO.
 *
 * Este test enforce que la UI y el parser compartan la misma noción
 * de header. Si alguien edita uno sin tocar el otro, el test rompe.
 *
 * Si jest rompe por side-effects al importar ImportarCsv.tsx (que
 * requiere expo-document-picker, expo-file-system, react-native),
 * mockeamos inline con jest.doMock en lugar de importar el componente
 * entero — solo necesitamos la constante HEADER_ESPERADO_TXT.
 */

// Mockear imports nativos ANTES del import. Si los mocks no están
// en __mocks__/ los registramos inline aquí. jest-expo ya mockea
// @expo/vector-icons y react-native vía preset, pero no necesariamente
// expo-document-picker / expo-file-system.
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  File: class FakeFile {
    constructor(_uri: string) {}
    async text(): Promise<string> {
      return '';
    }
  },
}));

import { HEADER_ESPERADO_TXT } from '../../src/pantallas/header-csv';
import { HEADER_NUEVO, parsearCSV } from '../../dominio/importacion/parser-csv';

describe('ImportarCsv — contrato de header con parser (COR-09)', () => {
  it('T-CSV-3: HEADER_ESPERADO_TXT de la UI coincide token-a-token con HEADER_NUEVO del parser', () => {
    const uiTokens = HEADER_ESPERADO_TXT.split(',').map((s) => s.trim());
    expect(uiTokens).toEqual([...HEADER_NUEVO]);
  });

  it('T-CSV-3b: el header que anuncia la UI es parseable por parsearCSV sin errores', () => {
    // El HEADER_ESPERADO_TXT, usado como primera línea de un CSV,
    // debe ser aceptado por el parser. Si la UI miente, el parser
    // devuelve un error de header mismatch.
    const csv =
      HEADER_ESPERADO_TXT +
      '\n' +
      'Juan Perez,12345678,,,Bogotá,Calle 1,3,,,2024-01-15,';
    const r = parsearCSVForTest(csv);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(1);
  });
});

// Wrapper para evitar un import top-level que jest hoiste arriba del
// jest.mock (jest.mock es hoisted, pero queremos el import del parser
// después de los mocks — el import dentro de la función funciona).
function parsearCSVForTest(texto: string) {
  return parsearCSV(texto);
}
