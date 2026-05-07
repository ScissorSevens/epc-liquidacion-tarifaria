/**
 * Adapter HTTP — opcion C de la decision D33.
 *
 * Por que existe:
 *   El dominio TS en `src/` quedo CONGELADO pre-entrega del sprint 3.
 *   El cliente HTTP del dominio (`ClienteHTTPSincronizacion`) tiene
 *   tres desalineaciones con el backend .NET ya desplegado:
 *
 *     1. Rutas sin `/v1` (dominio: `/api/lecturas`, backend: `/api/v1/lecturas`).
 *     2. `ItemCola` no expone `idCliente` ni serializa `forzarSobrescribir`,
 *        ambos exigidos por el `SyncRequest<T>` del backend.
 *     3. `ItemCola` carga campos extra (`estado`, `ultimoError`, `creadoEn`)
 *        que el backend ignora pero ensucian el body.
 *
 *   En vez de tocar el dominio congelado (lo que requeriria re-validar
 *   563 tests), envolvemos el wiring del mobile con este adapter que
 *   implementa la misma interface `ClienteSincronizacion` y traduce
 *   `ItemCola` → shape `SyncRequest<T>` antes de hacer el POST.
 *
 * TODO post-entrega:
 *   - Cuando se libere el congelamiento del dominio, mover este mapeo al
 *     `ClienteHTTPSincronizacion` real y borrar este archivo.
 *   - `dispositivoId` esta hardcoded a `'mobile'`. Sofisticar con
 *     `expo-application.getAndroidId()` o un UUID persistido en SQLite
 *     (tabla `dispositivo`) para distinguir celulares en el backend.
 *   - Tipos no soportados (EVIDENCIA, EVENTO_AUDITORIA, FACTURA): el
 *     backend del sprint NO expone endpoints — se devuelve `ok:false` con
 *     un error explicito para que el procesador los marque FALLIDO sin
 *     bucle infinito ni conflicto fantasma.
 */

import type { ItemCola, TipoItem } from '@dominio/sincronizacion/types';
import type {
  ClienteSincronizacion,
  RespuestaCliente,
} from '@dominio/sincronizacion/procesador';
import type { TokenProvider } from '@dominio/cliente-http';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';
import { mapearLecturaParaBackend } from './mapeadores/lectura-a-backend';
import { mapearSuscriptorParaBackend } from './mapeadores/suscriptor-a-backend';
import { mapearMedidorParaBackend } from './mapeadores/medidor-a-backend';

/**
 * Mapeo tipo → ruta del backend `/api/v1/*`.
 *
 * `null` = no soportado en el sprint actual. El operario solo
 * sincroniza LECTURA y LIQUIDACION; el resto se documenta como deuda
 * en `mobile/README.md`.
 */
const RUTAS_BACKEND_V1: Record<TipoItem, string | null> = {
  LECTURA: '/api/v1/lecturas',
  LIQUIDACION: '/api/v1/liquidaciones',
  SUSCRIPTOR: '/api/v1/suscriptores',
  MEDIDOR: '/api/v1/medidores',
  EVIDENCIA: null, // backend no expone endpoint en sprint actual
  EVENTO_AUDITORIA: null, // idem
  FACTURA: null, // idem
};

export interface OpcionesAdapter {
  readonly baseUrl: string;
  readonly tokenProvider: TokenProvider;
  /** default: 'mobile' — TODO sofisticar post-entrega */
  readonly dispositivoId?: string;
  /**
   * Repos / adapters necesarios para mapear el payload `LECTURA` del
   * dominio (snake_case) al `LecturaPayload` camelCase del backend.
   * Se inyectan desde el bootstrap real. Para tipos != LECTURA no se
   * usan, el payload se reenvia tal cual.
   */
  readonly medidorRepo: { buscarPorId(id: number): Promise<Medidor | null> };
  readonly suscriptorRepo: { buscarPorId(id: number): Promise<Suscriptor | null> };
  readonly hasher: { sha256(input: string | Uint8Array): string };
  readonly leerFotoBase64: (
    path: string,
  ) => Promise<{ base64: string; mime: string }>;
}

/**
 * Body que el backend espera (shape `SyncRequest<T>` del .NET).
 *
 * Notas de serializacion:
 *   - `tipo` va en lowercase singular ('lectura', 'liquidacion'). El
 *     backend usa naming convention snake_case por EFCore.NamingConventions
 *     y el discriminador es case-insensitive en JsonOptions, pero mandamos
 *     lowercase explicito para ser consistentes con la convencion REST.
 *   - `idCliente` = `${dispositivoId}:${item.id}`. Es la PK logica del
 *     unique compuesto `(idCliente, tipo)` en `sync_registros`.
 *   - `ultimoIntento` se serializa ISO-8601 UTC (Date#toISOString) o
 *     null. El backend lo deserializa a `DateTime?` UTC.
 *   - Campos extra de `ItemCola` (estado, ultimoError, creadoEn,
 *     hashServer) se OMITEN — el backend los ignoraria igual pero asi el
 *     body queda limpio.
 */
interface SyncRequestBody {
  readonly id: string;
  readonly tipo: string;
  readonly payload: unknown;
  readonly hashLocal: string;
  readonly forzarSobrescribir: boolean;
  readonly idCliente: string;
  readonly intentos: number;
  readonly ultimoIntento: string | null;
}

/**
 * Shape del ProblemDetails RFC 7807 que devuelve el backend en 409
 * (conflicto de hash). `hashServer` viene como extension property.
 */
interface ProblemDetailsConflicto {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly hashServer?: string;
  readonly mensaje?: string;
}

/**
 * Crea el adapter HTTP. Devuelve un `ClienteSincronizacion` plug-in
 * compatible con `procesarCola(...)` del dominio.
 */
export function crearClienteHttpAdapter(
  opts: OpcionesAdapter,
): ClienteSincronizacion {
  const dispositivoId = opts.dispositivoId ?? 'mobile';

  return {
    async enviar(item: ItemCola): Promise<RespuestaCliente> {
      const ruta = RUTAS_BACKEND_V1[item.tipo];
      if (ruta === null) {
        // No soportado en sprint actual. Devolvemos error normal (NO
        // conflicto, NO excepcion) para que el procesador lo cuente
        // como fallo y termine marcandolo FALLIDO tras MAX_INTENTOS.
        return {
          ok: false,
          error: `tipo ${item.tipo} no soportado en sprint actual`,
        };
      }

      // Para LECTURA: traducimos el payload snake_case del dominio
      // al `LecturaPayload` camelCase del backend (FK por idCliente,
      // foto en base64+mime+hash). Ver
      // `mapeadores/lectura-a-backend.ts` para la justificacion y la
      // decision sobre `idMedidorCliente`.
      //
      // Tambien fijamos el `idCliente` del SOBRE (`SyncRequest`) al
      // formato `dispositivo:id_local` para LECTURA — el `item.id` del
      // dominio es un UUID y NO matchea el regex `^[\w-]+:\d+$` que
      // valida el backend en `SyncRequest.IdCliente`. Para tipos !=
      // LECTURA dejamos el comportamiento previo (UUID) — el backend
      // de LIQUIDACION arrastra el mismo bug pero queda fuera de scope
      // de esta correccion (TODO post-entrega).
      let payloadFinal: unknown = item.payload;
      let idClienteSobre = `${dispositivoId}:${item.id}`;

      if (item.tipo === 'LECTURA') {
        const lectura = item.payload as Lectura;
        payloadFinal = await mapearLecturaParaBackend(lectura, {
          medidorRepo: opts.medidorRepo,
          hasher: opts.hasher,
          leerFotoBase64: opts.leerFotoBase64,
          dispositivoId,
        });
        // Pre-condicion: la lectura ya fue persistida y tiene
        // id_lectura. Si no, reventamos explicito antes del POST en
        // vez de mandar `mobile:undefined` y comer un 400 oscuro.
        if (lectura.id_lectura === undefined) {
          return {
            ok: false,
            error: 'Lectura sin id_lectura: no se puede armar idCliente del sobre',
          };
        }
        idClienteSobre = `${dispositivoId}:${lectura.id_lectura}`;
      }

      // Camino 3 (D33+): SUSCRIPTOR y MEDIDOR se sincronizan ANTES que
      // las LECTURAs para que el backend pueda resolver la FK logica
      // por `idCliente`. Mismo patron de mapping snake_case → camelCase
      // y mismo formato `${dispositivoId}:${id_local}` para el sobre.
      if (item.tipo === 'SUSCRIPTOR') {
        const sus = item.payload as Suscriptor;
        if (sus.id_suscriptor === undefined) {
          return {
            ok: false,
            error: 'Suscriptor sin id_suscriptor: no se puede armar idCliente del sobre',
          };
        }
        payloadFinal = mapearSuscriptorParaBackend(sus, { dispositivoId });
        idClienteSobre = `${dispositivoId}:${sus.id_suscriptor}`;
      }

      if (item.tipo === 'MEDIDOR') {
        const med = item.payload as Medidor;
        if (med.id_medidor === undefined) {
          return {
            ok: false,
            error: 'Medidor sin id_medidor: no se puede armar idCliente del sobre',
          };
        }
        payloadFinal = await mapearMedidorParaBackend(med, {
          suscriptorRepo: opts.suscriptorRepo,
          dispositivoId,
        });
        idClienteSobre = `${dispositivoId}:${med.id_medidor}`;
      }

      const body: SyncRequestBody = {
        id: item.id,
        tipo: item.tipo.toLowerCase(),
        payload: payloadFinal,
        hashLocal: item.hashLocal,
        forzarSobrescribir: item.forzarSobrescribir ?? false,
        idCliente: idClienteSobre,
        intentos: item.intentos,
        ultimoIntento: item.ultimoIntentoEn?.toISOString() ?? null,
      };

      const token = await opts.tokenProvider.obtenerToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Errores de red (fetch rechaza promesa) propagan tal cual: el
      // procesador del dominio los atrapa en su try/catch y los cuenta
      // como reintento normal.
      const response = await fetch(`${opts.baseUrl}${ruta}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return { ok: true };
      }

      // 409 — conflicto por hash divergente. Backend devuelve
      // ProblemDetails con `hashServer` como extension.
      if (response.status === 409) {
        let hashServer: string | undefined;
        try {
          const json = (await response.json()) as ProblemDetailsConflicto;
          hashServer = json.hashServer;
        } catch {
          // body no parseable — seguimos sin hashServer, el operario
          // resolvera manual desde la pantalla de conflictos.
        }
        return { ok: false, conflicto: true, hashServer };
      }

      // Otros 4xx/5xx. Intentamos extraer mensaje legible.
      let mensaje = `HTTP ${response.status}`;
      try {
        const json = (await response.json()) as ProblemDetailsConflicto;
        if (json.detail) mensaje = json.detail;
        else if (json.mensaje) mensaje = json.mensaje;
      } catch {
        // body no JSON o vacio — usamos el HTTP status default.
      }
      return { ok: false, error: mensaje };
    },
  };
}
