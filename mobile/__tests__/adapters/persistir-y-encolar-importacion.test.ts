// mobile/__tests__/adapters/persistir-y-encolar-importacion.test.ts
//
// Test del adapter `persistirYEncolarImportacion`.
//
// Por que existe:
//   El importador del dominio (`importarSuscriptoresYMedidores`)
//   persiste pero NO encola para sincronizar. El sync Camino 3 exige
//   que TODA entidad creada en el lote vaya a la cola con el orden
//   correcto: SUSCRIPTOR primero, MEDIDOR despues con `dependeDe` al
//   item del suscriptor (cuando ambos son nuevos en el lote).
//
//   Este adapter envuelve la importacion + el encolado, devolviendo
//   el reporte original + la lista de items encolados.
//
// Reglas:
//  - Suscriptor creado en el lote → encolar SUSCRIPTOR.
//  - Suscriptor duplicado (ya existia) → NO encolar (ya esta sincronizado o
//    pendiente de un lote previo).
//  - Medidor creado → encolar MEDIDOR. dependeDe = [idItemSuscriptor]
//    SI el suscriptor tambien fue creado en este lote, o SI hay un item
//    SUSCRIPTOR PENDIENTE/ENVIANDO en cola para ese suscriptor.
//  - Medidor duplicado / fila en errores → NO encolar.
//
// Corre con jest del root, sin expo-sqlite (mocks puros).

import { persistirYEncolarImportacion } from '../../src/adapters/persistir-y-encolar-importacion';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import type { Medidor } from '@dominio/medidores/types';
import type { FilaCSV } from '@dominio/importacion/types';

// --- Helpers de fixtures ---

function fila(over: Partial<FilaCSV> = {}): FilaCSV {
  return {
    linea: 2,
    codigo: '1001',
    nombre_apellidos: 'Suscriptor 1',
    cedula: '123456789',
    municipio: 'Bogota',
    direccion: 'Direccion 1',
    estrato: 2,
    numero_medidor: 'MED-001',
    fecha_instalacion: '2024-01-01',
    ...over,
  };
}

function suscriptorDe(codigo: string, id: number): Suscriptor {
  return {
    id_suscriptor: id,
    codigo,
    nombre_apellidos: `Suscriptor ${codigo}`,
    cedula: '123456789',
    municipio: 'Bogota',
    direccion: 'Direccion X',
    estrato: 2,
    aplica_subsidio: false,
    id_prestador: 0,
    categoria_uso: 'residencial',
    estado: 'activo',
    created_at: '2026-05-07T00:00:00.000Z',
  };
}

function medidorDe(numero: string, id: number, idSus: number): Medidor {
  return {
    id_medidor: id,
    numero_medidor: numero,
    id_suscriptor: idSus,
    fecha_instalacion: '2024-01-01',
    estado: 'activo',
    created_at: '2026-05-07T00:00:00.000Z',
  };
}

/**
 * Fabrica un set de mocks plug-and-play. La cola es un array
 * in-memory; los repos son objetos jest.fn que el caller puede
 * sobrescribir por test.
 */
function setup(opts: {
  suscriptoresPorCodigo: Record<string, Suscriptor | null>;
  medidoresPorNumero: Record<string, Medidor | null>;
  itemsExistentes?: ItemCola[];
}) {
  const cola: ItemCola[] = [...(opts.itemsExistentes ?? [])];

  const suscriptorRepo = {
    buscarPorCodigo: jest.fn(async (codigo: string) =>
      opts.suscriptoresPorCodigo[codigo] ?? null,
    ),
    crear: jest.fn(),
    buscarPorId: jest.fn(),
    existePorCodigo: jest.fn(),
    listar: jest.fn(),
    actualizar: jest.fn(),
    eliminar: jest.fn(),
    maxCodigo: jest.fn(async () => null),
  };

  const medidorRepo = {
    buscarPorNumero: jest.fn(async (numero: string) =>
      opts.medidoresPorNumero[numero] ?? null,
    ),
    crear: jest.fn(),
    buscarPorId: jest.fn(),
    existePorNumero: jest.fn(),
    listarPorSuscriptor: jest.fn(),
    listar: jest.fn(),
    actualizar: jest.fn(),
    eliminar: jest.fn(),
  };

  const colaRepo = {
    guardar: jest.fn(async (item: ItemCola) => {
      cola.push(item);
    }),
    listar: jest.fn(async () => [...cola]),
  };

  let uuidCount = 0;
  const idGenerator = {
    uuid: jest.fn(() => `uuid-${++uuidCount}`),
  };

  let hashCount = 0;
  const hasher = {
    sha256: jest.fn((_s: string | Uint8Array) => `hash-${++hashCount}`),
  };

  return { suscriptorRepo, medidorRepo, colaRepo, idGenerator, hasher, cola };
}

describe('persistirYEncolarImportacion', () => {
  it('encola_suscriptor_y_medidor_cuando_ambos_son_creados_en_el_lote', async () => {
    // El importador real va a llamar a buscarPorCodigo (devuelve null →
    // crea), luego a crear (devuelve suscriptor con id=10). Mockeamos
    // el comportamiento del importador: el adapter despues de la
    // importacion lee de nuevo via buscarPorCodigo / buscarPorNumero.
    //
    // Estrategia: el adapter NO mockea al importador; lo invoca. Pero
    // como el importador llama a `buscarPorCodigo` ANTES de crear y
    // DESPUES no, el adapter despues del importer hace un nuevo
    // `buscarPorCodigo` para resolver el id real. Para simplificar:
    // configuramos `buscarPorCodigo` a que devuelva null en la primera
    // llamada (el importador piensa que no existe y crea) y el
    // suscriptor en las siguientes (el adapter lo encuentra).

    const susCreado = suscriptorDe('1001', 10);
    const medCreado = medidorDe('MED-001', 100, 10);

    const s = setup({
      suscriptoresPorCodigo: {},
      medidoresPorNumero: {},
    });

    // Stateful mock: primera llamada null, despues devuelve el creado.
    s.suscriptorRepo.buscarPorCodigo
      .mockImplementationOnce(async () => null)
      .mockImplementation(async () => susCreado);
    s.suscriptorRepo.crear.mockImplementation(async () => susCreado);

    s.medidorRepo.buscarPorNumero
      .mockImplementationOnce(async () => null)
      .mockImplementation(async () => medCreado);
    s.medidorRepo.crear.mockImplementation(async () => medCreado);

    const filas = [fila({ codigo: '1001', numero_medidor: 'MED-001' })];

    const out = await persistirYEncolarImportacion({
      filas,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.reporte.suscriptoresCreados).toBe(1);
    expect(out.reporte.medidoresCreados).toBe(1);
    expect(out.itemsEncolados).toHaveLength(2);

    const enc = s.colaRepo.guardar.mock.calls.map((c) => c[0] as ItemCola);
    const encSus = enc.find((i) => i.tipo === 'SUSCRIPTOR');
    const encMed = enc.find((i) => i.tipo === 'MEDIDOR');

    expect(encSus).toBeDefined();
    expect(encMed).toBeDefined();
    expect(encSus!.payload).toEqual(susCreado);
    expect(encMed!.payload).toEqual(medCreado);
    expect(encMed!.dependeDe).toEqual([encSus!.id]);
    expect(encSus!.estado).toBe('PENDIENTE');
    expect(encMed!.estado).toBe('PENDIENTE');
  });

  it('no_encola_suscriptor_duplicado_pero_si_encola_medidor_nuevo_sin_dependeDe_si_no_hay_pending', async () => {
    // Suscriptor ya existe (duplicado) y NO esta en cola → medidor
    // nuevo se encola SIN dependeDe (el suscriptor ya fue sincronizado
    // en algun lote previo).
    const susExistente = suscriptorDe('2002', 20);
    const medNuevo = medidorDe('MED-002', 200, 20);

    const s = setup({
      suscriptoresPorCodigo: { '2002': susExistente },
      medidoresPorNumero: {},
    });

    s.medidorRepo.buscarPorNumero
      .mockImplementationOnce(async () => null)
      .mockImplementation(async () => medNuevo);
    s.medidorRepo.crear.mockImplementation(async () => medNuevo);

    const filas = [fila({ codigo: '2002', numero_medidor: 'MED-002' })];

    const out = await persistirYEncolarImportacion({
      filas,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.reporte.suscriptoresCreados).toBe(0);
    expect(out.reporte.medidoresCreados).toBe(1);

    const enc = s.colaRepo.guardar.mock.calls.map((c) => c[0] as ItemCola);
    expect(enc.filter((i) => i.tipo === 'SUSCRIPTOR')).toHaveLength(0);
    const encMed = enc.find((i) => i.tipo === 'MEDIDOR');
    expect(encMed).toBeDefined();
    expect(encMed!.dependeDe).toBeUndefined();
  });

  it('medidor_apunta_a_item_pending_existente_si_suscriptor_ya_estaba_pero_pendiente_en_cola', async () => {
    // Suscriptor ya existe (duplicado) PERO hay item SUSCRIPTOR
    // PENDIENTE en cola para ese suscriptor → el medidor nuevo debe
    // dependeDe ese item para preservar el orden.
    const susExistente = suscriptorDe('3003', 30);
    const medNuevo = medidorDe('MED-003', 300, 30);

    const itemPendienteSus: ItemCola = {
      id: 'pending-sus-30',
      tipo: 'SUSCRIPTOR',
      payload: susExistente,
      hashLocal: 'hash-prev',
      estado: 'PENDIENTE',
      intentos: 0,
      ultimoError: null,
      ultimoIntentoEn: null,
      creadoEn: new Date('2026-05-06T00:00:00.000Z'),
    };

    const s = setup({
      suscriptoresPorCodigo: { '3003': susExistente },
      medidoresPorNumero: {},
      itemsExistentes: [itemPendienteSus],
    });

    s.medidorRepo.buscarPorNumero
      .mockImplementationOnce(async () => null)
      .mockImplementation(async () => medNuevo);
    s.medidorRepo.crear.mockImplementation(async () => medNuevo);

    const filas = [fila({ codigo: '3003', numero_medidor: 'MED-003' })];

    const out = await persistirYEncolarImportacion({
      filas,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.reporte.suscriptoresCreados).toBe(0);
    const enc = s.colaRepo.guardar.mock.calls.map((c) => c[0] as ItemCola);
    const encMed = enc.find((i) => i.tipo === 'MEDIDOR');
    expect(encMed).toBeDefined();
    expect(encMed!.dependeDe).toEqual(['pending-sus-30']);
  });

  it('respeta_errores_del_importador_y_no_encola_los_que_fallaron', async () => {
    // Suscriptor crear() throws → la fila va a errores y NO encolamos
    // suscriptor ni medidor.
    const s = setup({
      suscriptoresPorCodigo: {},
      medidoresPorNumero: {},
    });

    s.suscriptorRepo.crear.mockRejectedValue(new Error('boom'));

    const filas = [fila({ codigo: '4004', numero_medidor: 'MED-004' })];

    const out = await persistirYEncolarImportacion({
      filas,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.reporte.errores).toHaveLength(1);
    expect(out.reporte.suscriptoresCreados).toBe(0);
    expect(out.reporte.medidoresCreados).toBe(0);
    expect(s.colaRepo.guardar).not.toHaveBeenCalled();
    expect(out.itemsEncolados).toHaveLength(0);
  });

  it('medidores_duplicados_no_son_encolados', async () => {
    // Suscriptor nuevo + medidor duplicado → encolar SUSCRIPTOR pero
    // NO MEDIDOR.
    const susCreado = suscriptorDe('5005', 50);
    const medExistente = medidorDe('MED-005', 500, 50);

    const s = setup({
      suscriptoresPorCodigo: {},
      medidoresPorNumero: { 'MED-005': medExistente },
    });

    s.suscriptorRepo.buscarPorCodigo
      .mockImplementationOnce(async () => null)
      .mockImplementation(async () => susCreado);
    s.suscriptorRepo.crear.mockImplementation(async () => susCreado);

    const filas = [fila({ codigo: '5005', numero_medidor: 'MED-005' })];

    const out = await persistirYEncolarImportacion({
      filas,
      suscriptorRepo: s.suscriptorRepo,
      medidorRepo: s.medidorRepo,
      colaRepo: s.colaRepo,
      idGenerator: s.idGenerator,
      hasher: s.hasher,
    });

    expect(out.reporte.suscriptoresCreados).toBe(1);
    expect(out.reporte.medidoresCreados).toBe(0);
    expect(out.reporte.saltados.some((s) => s.motivo === 'medidor_duplicado')).toBe(true);

    const enc = s.colaRepo.guardar.mock.calls.map((c) => c[0] as ItemCola);
    expect(enc.filter((i) => i.tipo === 'SUSCRIPTOR')).toHaveLength(1);
    expect(enc.filter((i) => i.tipo === 'MEDIDOR')).toHaveLength(0);
  });
});
