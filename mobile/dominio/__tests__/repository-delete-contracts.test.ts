import { resolve } from 'path';
import * as ts from 'typescript';

function compilarContrato(codigo: string): readonly ts.Diagnostic[] {
  const archivoVirtual = resolve(__dirname, 'repository-delete-contracts.fixture.ts');
  const rutaTsconfig = resolve(process.cwd(), 'tsconfig.json');
  const config = ts.readConfigFile(rutaTsconfig, ts.sys.readFile);

  if (config.error !== undefined) {
    return [config.error];
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const opciones: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(opciones);
  const getSourceFileOriginal = host.getSourceFile.bind(host);

  host.fileExists = (archivo) =>
    resolve(archivo) === archivoVirtual || ts.sys.fileExists(archivo);
  host.readFile = (archivo) =>
    resolve(archivo) === archivoVirtual ? codigo : ts.sys.readFile(archivo);
  host.getSourceFile = (archivo, lenguaje, onError, shouldCreateNewSourceFile) =>
    resolve(archivo) === archivoVirtual
      ? ts.createSourceFile(archivo, codigo, lenguaje, true)
      : getSourceFileOriginal(archivo, lenguaje, onError, shouldCreateNewSourceFile);

  const programa = ts.createProgram({
    rootNames: [archivoVirtual],
    options: opciones,
    host,
  });

  return ts
    .getPreEmitDiagnostics(programa)
    .filter((diagnostico) =>
      diagnostico.file === undefined
        ? true
        : resolve(diagnostico.file.fileName) === archivoVirtual,
    );
}

function formatearDiagnosticos(diagnosticos: readonly ts.Diagnostic[]): string[] {
  return diagnosticos.map((diagnostico) =>
    ts.flattenDiagnosticMessageText(diagnostico.messageText, '\n'),
  );
}

function esperarEliminarTipado(importacion: string, nombreInterfaz: string): void {
  const diagnosticos = compilarContrato(`
    import type { ${nombreInterfaz} } from '${importacion}';

    declare const repository: ${nombreInterfaz};
    const resultado: Promise<void> = repository.eliminar(42);
    void resultado;
  `);

  expect(formatearDiagnosticos(diagnosticos)).toEqual([]);
}

describe('contratos eliminar de los repositorios de dominio', () => {
  it('PrestadorRepository expone eliminar(id: number): Promise<void>', () => {
    esperarEliminarTipado('../prestadores/types', 'PrestadorRepository');
  });

  it('OperarioRepository expone eliminar(id: number): Promise<void>', () => {
    esperarEliminarTipado('../operarios/types', 'OperarioRepository');
  });

  it('AcuerdoMunicipalRepository expone eliminar(id: number): Promise<void>', () => {
    esperarEliminarTipado('../acuerdo-municipal/types', 'AcuerdoMunicipalRepository');
  });

  it('ParametrosTarifaRepository expone eliminar(id: number): Promise<void>', () => {
    esperarEliminarTipado('../parametros-tarifa/types', 'ParametrosTarifaRepository');
  });

  it('el repo Expo de acuerdos satisface AcuerdoRepoPort sin casts', () => {
    const diagnosticos = compilarContrato(`
      import type { AcuerdoRepoPort } from '../../src/composition/bootstrap-completo';
      import type { AcuerdoMunicipalRepositoryExpoSqlite } from '../../src/persistencia/expo-sqlite/acuerdo-municipal-repository-expo-sqlite';

      declare const repository: AcuerdoMunicipalRepositoryExpoSqlite;
      const port: AcuerdoRepoPort = repository;
      void port;
    `);

    expect(formatearDiagnosticos(diagnosticos)).toEqual([]);
  });
});
