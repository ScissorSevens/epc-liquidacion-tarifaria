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
import { crearHasherJs } from '@dominio/shared/adapters/hasher-js';
import { crearIdGeneratorUuid } from '@dominio/shared/adapters/id-generator-uuid';
import type { Hasher, IdGenerator } from '@dominio/shared/ports';
import type { TokenProvider } from '@dominio/cliente-http';
import { procesarCola } from '@dominio/sincronizacion/procesador';
import type { ClienteSincronizacion } from '@dominio/sincronizacion/procesador';
import { obtenerApiBaseUrl } from '../config/api';
import { crearClienteHttpAdapter } from '../sincronizacion/adapter-cliente-http';
import { smokeDominio, type ResultadoSmokeDominio } from './smoke-dominio';

// Token provider stub: el backend del sprint 3 NO requiere JWT todavia.
// Cuando se agregue auth, este stub se reemplaza por uno que lea de
// AsyncStorage / SecureStore. Se exporta como singleton porque es
// stateless y barato.
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

export interface BootstrapApp {
  readonly db: SQLite.SQLiteDatabase;
  readonly facturaRepo: FacturaRepositoryExpoSqlite;
  readonly lecturaRepo: LecturaRepositoryExpoSqlite;
  readonly colaRepo: ColaRepositoryExpoSqlite;
  // Catalogo de suscriptores y sus medidores. Nombres en linea con
  // `bootstrap-completo.ts` del root para coherencia entre Node y mobile.
  readonly suscriptorRepo: SuscriptorRepositoryExpoSqlite;
  readonly medidorRepo: MedidorRepositoryExpoSqlite;
  readonly hasher: Hasher;
  readonly idGenerator: IdGenerator;
  readonly clienteHttp: ClienteSincronizacion;
  readonly apiBaseUrl: string;
  /**
   * Procesa la cola completa una sola vez (no hace polling).
   * Devuelve los contadores del estado final para mostrar feedback.
   */
  readonly procesadorCola: () => Promise<ResultadoSync>;
  readonly smoke: ResultadoSmokeDominio;
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

  // Adapters universales del dominio: js-sha256 y uuid v4 (con polyfill
  // de crypto.getRandomValues importado al tope del archivo). Cualquier
  // caso de uso del dominio que necesite hash o id debe recibir estos
  // mismos singletons via inyeccion de parametros.
  const hasher = crearHasherJs();
  const idGenerator = crearIdGeneratorUuid();

  // Cliente HTTP del backend + procesador de cola.
  //
  // Usamos `crearClienteHttpAdapter` (mobile-only) en vez del
  // `ClienteHTTPSincronizacion` del dominio porque el dominio quedo
  // congelado pre-entrega (D33) con rutas sin /v1 y sin mapear
  // `idCliente`/`forzarSobrescribir` al shape `SyncRequest<T>` del
  // backend. Ver `mobile/src/sincronizacion/adapter-cliente-http.ts`
  // para el detalle. El adapter implementa la misma interface
  // `ClienteSincronizacion`, asi que el procesador lo consume sin
  // diferencias.
  //
  // El adapter usa `fetch` global — Hermes/RN lo expone de fabrica
  // desde RN 0.60+, no inyectamos fetch custom. No hay timeout
  // configurable (limitacion conocida, queda como TODO post-MVP si la
  // red rural lo demanda).
  //
  // El procesador es `procesarCola(cola, cliente)`, una funcion libre
  // del dominio que ya internamente respeta MAX_INTENTOS, delays
  // exponenciales y dependencias entre items. Lo envolvemos en una
  // closure que tras procesar lee la cola y devuelve contadores.
  const apiBaseUrl = obtenerApiBaseUrl();
  const clienteHttp: ClienteSincronizacion = crearClienteHttpAdapter({
    baseUrl: apiBaseUrl,
    tokenProvider: tokenProviderSinAuth,
    dispositivoId: 'mobile', // TODO: sofisticar con expo-application post-entrega
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

  return {
    db,
    facturaRepo,
    lecturaRepo,
    colaRepo,
    suscriptorRepo,
    medidorRepo,
    hasher,
    idGenerator,
    clienteHttp,
    apiBaseUrl,
    procesadorCola,
    smoke,
  };
}
