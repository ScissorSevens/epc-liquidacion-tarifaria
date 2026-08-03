// Composition root real para la app movil.
//
// Cablea las repos SQLite (factura, lectura, cola) sobre `expo-sqlite`,
// aplicando las migraciones idempotentemente al arrancar.
//
// Esta funcion es ASYNC y depende de modulos nativos de RN — solo se
// puede invocar desde el runtime movil. El wiring test del root valida
// `smokeDominio()` por separado en `smoke-dominio.ts`, que NO importa
// expo-sqlite y por eso es Node-importable.

// IMPORTANTE: el polyfill de crypto.getRandomValues debe importarse ANTES
// que cualquier modulo que use uuid v4. RN/Hermes no expone Web Crypto API
// nativamente y `uuid` falla silenciosamente sin esto.
import 'react-native-get-random-values';

import * as SQLite from 'expo-sqlite';
import { aplicarMigracionesAsync } from '../persistencia/expo-sqlite/migraciones';
import {
  crearFacturaRepositoryExpoSqlite,
  type FacturaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/factura-repository-expo-sqlite';
import {
  crearLecturaRepositoryExpoSqlite,
  type LecturaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/lectura-repository-expo-sqlite';
import {
  crearColaRepositoryExpoSqlite,
  type ColaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/cola-repository-expo-sqlite';
import {
  crearSuscriptorRepositoryExpoSqlite,
  type SuscriptorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/suscriptor-repository-expo-sqlite';
import {
  crearMedidorRepositoryExpoSqlite,
  type MedidorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/medidor-repository-expo-sqlite';
import {
  crearPrestadorRepositoryExpoSqlite,
  type PrestadorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/prestador-repository-expo-sqlite';
import {
  crearAcuerdoMunicipalRepositoryExpoSqlite,
  type AcuerdoMunicipalRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/acuerdo-municipal-repository-expo-sqlite';
import {
  crearParametrosTarifaRepositoryExpoSqlite,
  type ParametrosTarifaRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/parametros-tarifa-repository-expo-sqlite';
import {
  crearOperarioRepositoryExpoSqlite,
  type OperarioRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/operario-repository-expo-sqlite';
import {
  crearConceptoOtroValorRepositoryExpoSqlite,
  type ConceptoOtroValorRepositoryExpoSqlite,
} from '../persistencia/expo-sqlite/concepto-otro-valor-repository-expo-sqlite';
import type { Prestador } from '../../dominio/prestadores';
import type { AcuerdoMunicipal } from '../../dominio/acuerdo-municipal';
import type { ParametrosTarifa } from '../../dominio/parametros-tarifa';
import { crearHasherJs } from '@dominio/shared/adapters/hasher-js';
import { crearIdGeneratorUuid } from '@dominio/shared/adapters/id-generator-uuid';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';
import type { TokenProvider } from '@dominio/cliente-http';
import { procesarCola } from '@dominio/sincronizacion/procesador';
import type { ClienteSincronizacion } from '@dominio/sincronizacion/procesador';
import { obtenerApiBaseUrl } from '../config/api';
import { crearClienteHttpAdapter } from '../sincronizacion/adapter-cliente-http';
import { leerFotoBase64 } from '../adapters/leer-foto-base64';
import { smokeDominio, type ResultadoSmokeDominio } from './smoke-dominio';

// Token provider sin autenticación. Cuando se agregue auth, este stub
// se reemplaza por uno que lea de AsyncStorage / SecureStore. Se exporta
// como singleton porque es stateless y barato.
const tokenProviderSinAuth: TokenProvider = {
  async obtenerToken(): Promise<string | null> {
    return null;
  },
};

export const NOMBRE_DB_MOVIL = 'mediapp.db';

/**
 * Resultado de procesar la cola — devuelto por `procesadorCola()`.
 * Calculado a partir del estado final de la cola tras `procesarCola()`,
 * que es void en el dominio puro. Estos contadores los usa la pantalla
 * de Sincronizacion para mostrar el feedback al operario.
 */
export interface ResultadoSync {
  readonly enviados: number;
  readonly conflictos: number;
  readonly fallidos: number;
  readonly pendientes: number;
}

export interface BootstrapRepos {
  readonly facturaRepo: FacturaRepositoryExpoSqlite;
  readonly lecturaRepo: LecturaRepositoryExpoSqlite;
  readonly colaRepo: ColaRepositoryExpoSqlite;
  // Catalogo de suscriptores y sus medidores. Nombres en linea con
  // `bootstrap-completo.ts` del root para coherencia entre Node y mobile.
  readonly suscriptorRepo: SuscriptorRepositoryExpoSqlite;
  readonly medidorRepo: MedidorRepositoryExpoSqlite;
  // Multi-tenant (Fase 4 del change motor-tarifario-cra-825-2017-multitenant):
  readonly prestadorRepo: PrestadorRepositoryExpoSqlite;
  readonly acuerdoMunicipalRepo: AcuerdoMunicipalRepositoryExpoSqlite;
  readonly parametrosTarifaRepo: ParametrosTarifaRepositoryExpoSqlite;
  // Operarios: construido al final para que limpiarDatosLegacyBypass (que
  // lo construye ad-hoc) pueda seguir funcionando. Fase 5 Tarea 5.1 lo
  // expone en el BootstrapApp para que el setup wizard cree el primer
  // operario via bootstrapCompleto() sin tener que re-construir el repo.
  readonly operarioRepo: OperarioRepositoryExpoSqlite;
  // Catalogo regulatorio de otros_valores (Res CRA 1038/2026) — fuente
  // de verdad para la UI `OtrosValoresFactura`. Inyectado via
  // `getBootstrap().conceptoOtroValorRepo.listar(true)` desde la pantalla.
  readonly conceptoOtroValorRepo: ConceptoOtroValorRepositoryExpoSqlite;
}

export interface BootstrapAdapters {
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
  readonly clienteHttp: ClienteSincronizacion;
  readonly apiBaseUrl: string;
}

export interface BootstrapServices {
  /**
   * Procesa la cola completa una sola vez (no hace polling).
   * Devuelve los contadores del estado final para mostrar feedback.
   */
  readonly procesadorCola: () => Promise<ResultadoSync>;
  readonly smoke: ResultadoSmokeDominio;
  /**
   * Resuelve el contexto multi-tenant del prestador en uso:
   * ParametrosTarifa + AcuerdoMunicipal vigentes. Usado por la UI
   * (CapturarLectura, ResultadoCalculo) y por la fase 6 (workspace).
   */
  readonly resolverContextoPrestador: (id_prestador: number) => Promise<{
    prestador: Prestador;
    parametros: ParametrosTarifa | null;
    acuerdo: AcuerdoMunicipal | null;
  }>;
}

export interface BootstrapApp {
  readonly db: SQLite.SQLiteDatabase;
  readonly repos: BootstrapRepos;
  readonly adapters: BootstrapAdapters;
  readonly services: BootstrapServices;
}

/**
 * Abre la DB SQLite local, aplica migraciones pendientes y devuelve los
 * repos cableados con la conexion. Tambien corre el smoke del dominio
 * (motor tarifario puro) por sanidad.
 *
 * Lifecycle: el caller es responsable de cerrar la conexion (a traves
 * de cualquiera de los `*.cerrar()` o `db.closeAsync()`) cuando termina.
 * En la practica el celular cierra la app y la DB queda persistida en
 * disco.
 */
export async function bootstrapApp(): Promise<BootstrapApp> {
  const db = await SQLite.openDatabaseAsync(NOMBRE_DB_MOVIL);
  await aplicarMigracionesAsync(db);

  const facturaRepo = crearFacturaRepositoryExpoSqlite(db);
  const lecturaRepo = crearLecturaRepositoryExpoSqlite(db);
  const colaRepo = crearColaRepositoryExpoSqlite(db);
  const suscriptorRepo = crearSuscriptorRepositoryExpoSqlite(db);
  const medidorRepo = crearMedidorRepositoryExpoSqlite(db);
  const prestadorRepo = crearPrestadorRepositoryExpoSqlite(db);
  const acuerdoMunicipalRepo = crearAcuerdoMunicipalRepositoryExpoSqlite(db);
  const parametrosTarifaRepo = crearParametrosTarifaRepositoryExpoSqlite(db);
  const operarioRepo = crearOperarioRepositoryExpoSqlite(db);
  await operarioRepo.inicializar();
  const conceptoOtroValorRepo = crearConceptoOtroValorRepositoryExpoSqlite(db);

  // Adapters universales del dominio: js-sha256 y uuid v4 (con polyfill
  // de crypto.getRandomValues importado al tope del archivo). Cualquier
  // caso de uso del dominio que necesite hash o id debe recibir estos
  // mismos singletons via inyeccion de parametros.
  const hasher = crearHasherJs();
  const idGenerator = crearIdGeneratorUuid();

  // Cliente HTTP del backend + procesador de cola.
  //
  // Usamos `crearClienteHttpAdapter` (mobile-only) en vez del
  // `ClienteHTTPSincronizacion` del dominio porque este adapter
  // implementa el shape `SyncRequest<T>` que exige el backend.
  // Ver `mobile/src/sincronizacion/adapter-cliente-http.ts`.
  //
  // El adapter usa `fetch` global disponible desde RN 0.60+.
  // El procesador es `procesarCola(cola, cliente)`, una funcion libre
  // del dominio que respeta MAX_INTENTOS, delays exponenciales y
  // dependencias entre items.
  const apiBaseUrl = obtenerApiBaseUrl();
  const clienteHttp: ClienteSincronizacion = crearClienteHttpAdapter({
    baseUrl: apiBaseUrl,
    tokenProvider: tokenProviderSinAuth,
    dispositivoId: 'mobile',
    // Deps para mapear el payload LECTURA snake_case → camelCase del
    // backend (ver `mapeadores/lectura-a-backend.ts`). El medidorRepo
    // resuelve la FK por id local; el hasher calcula sha256 del
    // base64 de la foto; leerFotoBase64 usa expo-file-system.
    medidorRepo,
    suscriptorRepo,
    hasher,
    leerFotoBase64,
  });

  const procesadorCola = async (): Promise<ResultadoSync> => {
    await procesarCola(colaRepo, clienteHttp);
    const items = await colaRepo.listar();
    return {
      enviados: items.filter((i) => i.estado === 'EXITOSO').length,
      conflictos: items.filter((i) => i.estado === 'CONFLICTO').length,
      fallidos: items.filter((i) => i.estado === 'FALLIDO').length,
      pendientes: items.filter((i) => i.estado === 'PENDIENTE').length,
    };
  };

  const smoke = smokeDominio();

  const resolverContextoPrestador = async (id_prestador: number) => {
    const prestador = await prestadorRepo.obtenerPorId(id_prestador);
    if (!prestador) {
      throw new Error(`resolverContextoPrestador: prestador ${id_prestador} no existe`);
    }
    const hoy = new Date().toISOString();
    const [parametros, acuerdo] = await Promise.all([
      parametrosTarifaRepo.buscarVigente(id_prestador, hoy),
      acuerdoMunicipalRepo.buscarVigente(id_prestador, hoy),
    ]);
    return { prestador, parametros, acuerdo };
  };

  return {
    db,
    repos: {
      facturaRepo,
      lecturaRepo,
      colaRepo,
      suscriptorRepo,
      medidorRepo,
      prestadorRepo,
      acuerdoMunicipalRepo,
      parametrosTarifaRepo,
      operarioRepo,
      conceptoOtroValorRepo,
    },
    adapters: {
      hasher,
      idGenerator,
      clienteHttp,
      apiBaseUrl,
    },
    services: {
      procesadorCola,
      smoke,
      resolverContextoPrestador,
    },
  };
}
