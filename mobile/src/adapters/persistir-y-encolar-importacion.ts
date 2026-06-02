// mobile/src/adapters/persistir-y-encolar-importacion.ts
//
// Adapter orquestador: corre el importador del dominio (que persiste
// suscriptores + medidores en SQLite local) y encola los recien
// creados para el sync Camino 3 mobile→backend.
//
// Por que existe (y por que NO va en `src/` dominio):
//   El dominio puro `src/importacion/importador.ts` quedo congelado en
//   D33: persiste pero NO encola. El sync Camino 3 (D33+) exige encolar
//   SUSCRIPTOR antes que MEDIDOR antes que LECTURA, con `dependeDe`
//   para que el dispatcher de la cola respete el orden incluso con
//   reintentos parciales. Este adapter es el "wrapper mobile" que cierra
//   ese gap sin tocar dominio.
//
// Reglas de encolado:
//  - Suscriptor creado en el lote → encolar SUSCRIPTOR.
//  - Suscriptor duplicado (ya existia en BD) → NO encolar (asumimos
//    que ya fue sincronizado en un lote anterior, o ya tiene un item
//    PENDIENTE/ENVIANDO en cola — en cuyo caso lo usamos para dependeDe).
//  - Medidor creado → encolar MEDIDOR. `dependeDe`:
//      * [idItemSuscriptor] si el suscriptor tambien fue creado en este lote, O
//      * [idItemSuscriptorPending] si hay item SUSCRIPTOR PENDIENTE/ENVIANDO
//        en cola para ese suscriptor (lote previo todavia sin enviar), O
//      * undefined si el suscriptor ya esta sincronizado limpio.
//  - Medidor duplicado / fila con error de persistencia → NO encolar.
//
// Performance: leemos `colaRepo.listar()` UNA vez al inicio (no por
// fila). El set de items pendientes que nos interesa es chico (suscriptores
// del usuario actual, sin enviar) — no escala mal.

import type {
  SuscriptorRepository,
  Suscriptor,
} from '@dominio/suscriptores/types';
import type {
  MedidorRepository,
  Medidor,
} from '@dominio/medidores/types';
import type { ItemCola } from '@dominio/sincronizacion/types';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';
import type {
  FilaCSV,
  ResultadoImportacion,
} from '@dominio/importacion/types';
import { importarSuscriptoresYMedidores } from '@dominio/importacion/importador';

/** Subset estructural de ColaRepository que necesitamos. */
export interface ColaRepoParaImportacion {
  guardar(item: ItemCola): Promise<void>;
  listar(): Promise<ReadonlyArray<ItemCola>>;
}

export interface PersistirYEncolarImportacionDeps {
  readonly filas: ReadonlyArray<FilaCSV>;
  readonly suscriptorRepo: SuscriptorRepository;
  readonly medidorRepo: MedidorRepository;
  readonly colaRepo: ColaRepoParaImportacion;
  readonly idGenerator: IdGenerator;
  readonly hasher: Hasher;
}

export interface PersistirYEncolarImportacionResultado {
  readonly reporte: ResultadoImportacion;
  /** Items efectivamente encolados (orden de insercion). */
  readonly itemsEncolados: ReadonlyArray<ItemCola>;
}

/**
 * Estados de cola que representan "todavia no llego al backend o esta
 * en vuelo": un MEDIDOR nuevo del lote actual debe esperarlos via
 * `dependeDe`. EXITOSO/FALLIDO/CONFLICTO/DESCARTADO ya no bloquean.
 */
const ESTADOS_BLOQUEANTES: ReadonlyArray<ItemCola['estado']> = [
  'PENDIENTE',
  'ENVIANDO',
];

export async function persistirYEncolarImportacion(
  deps: PersistirYEncolarImportacionDeps,
): Promise<PersistirYEncolarImportacionResultado> {
  const {
    filas,
    suscriptorRepo,
    medidorRepo,
    colaRepo,
    idGenerator,
    hasher,
  } = deps;

  // 1. Persistir via dominio.
  const reporte = await importarSuscriptoresYMedidores(
    filas,
    suscriptorRepo,
    medidorRepo,
  );

  // 2. Indexar lineas que NO debemos encolar y motivos por linea.
  const lineasConError = new Set<number>(
    reporte.errores.map((e) => e.linea),
  );
  const lineasSusDuplicado = new Set<number>();
  const lineasMedDuplicado = new Set<number>();
  for (const s of reporte.saltados) {
    if (s.motivo === 'suscriptor_duplicado') {
      lineasSusDuplicado.add(s.linea);
    } else if (s.motivo === 'medidor_duplicado') {
      lineasMedDuplicado.add(s.linea);
    }
  }

  // 3. Snapshot de la cola PREVIO al lote: nos interesa encontrar items
  //    SUSCRIPTOR todavia pendientes para enganchar `dependeDe` desde
  //    medidores nuevos cuyo suscriptor era duplicado.
  const colaPrevia = await colaRepo.listar();
  const itemSusPendientePorIdSuscriptor = new Map<number, string>();
  for (const it of colaPrevia) {
    if (it.tipo !== 'SUSCRIPTOR') continue;
    if (!ESTADOS_BLOQUEANTES.includes(it.estado)) continue;
    const sus = it.payload as Suscriptor;
    if (sus.id_suscriptor !== undefined) {
      itemSusPendientePorIdSuscriptor.set(sus.id_suscriptor, it.id);
    }
  }

  const itemsEncolados: ItemCola[] = [];
  // Mapa codigo→idItem para suscriptores encolados EN ESTE lote.
  // Ojo: el mismo codigo puede aparecer en varias filas (multiples
  // medidores para un mismo suscriptor). Encolamos UNA sola vez.
  const idItemSusPorCodigo = new Map<string, string>();

  for (const fila of filas) {
    if (lineasConError.has(fila.linea)) {
      // El importador fallo en esta fila (suscriptor o medidor) → no
      // encolamos nada. Igualmente puede haber encolado el suscriptor
      // en una fila previa con el mismo codigo; eso es OK.
      continue;
    }

    // --- SUSCRIPTOR ---
    let idItemSusEsteLote: string | undefined;
    const codigoFila = fila.codigo;
    if (!lineasSusDuplicado.has(fila.linea)) {
      // Fila trajo suscriptor nuevo. Si ya lo encolamos en una fila
      // anterior con el mismo codigo, reutilizamos el id; sino,
      // recuperamos de repo y encolamos.
      const yaEncolado = codigoFila !== undefined ? idItemSusPorCodigo.get(codigoFila) : undefined;
      if (yaEncolado !== undefined) {
        idItemSusEsteLote = yaEncolado;
      } else {
        const codigoBusqueda = codigoFila ?? '';
        const sus = codigoBusqueda !== '' ? await suscriptorRepo.buscarPorCodigo(codigoBusqueda) : null;
        if (sus !== null) {
          const item = construirItem(
            'SUSCRIPTOR',
            sus,
            idGenerator,
            hasher,
          );
          await colaRepo.guardar(item);
          itemsEncolados.push(item);
          if (codigoFila !== undefined) {
            idItemSusPorCodigo.set(codigoFila, item.id);
          }
          idItemSusEsteLote = item.id;
        }
      }
    }

    // --- MEDIDOR ---
    if (lineasMedDuplicado.has(fila.linea)) continue;

    const numeroMedidor = fila.numero_medidor;
    if (numeroMedidor === undefined) continue;
    const med = await medidorRepo.buscarPorNumero(numeroMedidor);
    if (med === null) continue; // defensivo: no deberia pasar si no hubo error.

    // Resolver dependeDe en orden de prioridad:
    //   1. Suscriptor encolado en ESTE lote.
    //   2. Suscriptor PENDIENTE/ENVIANDO en cola de un lote previo.
    //   3. Sin dependencia (suscriptor ya sincronizado limpio).
    let dependeDe: string[] | undefined;
    if (idItemSusEsteLote !== undefined) {
      dependeDe = [idItemSusEsteLote];
    } else {
      const pending = itemSusPendientePorIdSuscriptor.get(
        med.id_suscriptor,
      );
      if (pending !== undefined) {
        dependeDe = [pending];
      }
    }

    const itemMed = construirItem(
      'MEDIDOR',
      med,
      idGenerator,
      hasher,
      dependeDe,
    );
    await colaRepo.guardar(itemMed);
    itemsEncolados.push(itemMed);
  }

  return { reporte, itemsEncolados };
}

/**
 * Helper local para armar un `ItemCola` con los defaults estandar de
 * un item recien encolado (estado PENDIENTE, intentos 0, etc.).
 *
 * `dependeDe` se omite del objeto si es undefined (en vez de
 * setear `dependeDe: undefined`) para no contaminar el JSON al
 * serializarlo en SQLite.
 */
function construirItem(
  tipo: ItemCola['tipo'],
  payload: Suscriptor | Medidor,
  idGenerator: IdGenerator,
  hasher: Hasher,
  dependeDe?: ReadonlyArray<string>,
): ItemCola {
  const base: ItemCola = {
    id: idGenerator.uuid(),
    tipo,
    payload,
    hashLocal: hasher.sha256(JSON.stringify(payload)),
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date(),
  };
  return dependeDe !== undefined && dependeDe.length > 0
    ? { ...base, dependeDe }
    : base;
}
