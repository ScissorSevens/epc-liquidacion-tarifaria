// mobile/src/sincronizacion/mapeadores/lectura-a-backend.ts
//
// Mapper `Lectura` (dominio TS snake_case) →
// `LecturaPayload` del backend .NET (camelCase, FK por idCliente).
//
// Por que existe:
//   El payload que el dominio encola para el endpoint
//   POST /api/v1/lecturas viene en snake_case (`id_medidor`,
//   `lectura_actual`, `id_periodo`, etc.). El backend espera camelCase
//   y resuelve la FK al medidor por un string `idMedidorCliente` con
//   formato `dispositivo:id_local` (regex `^[\w-]+:\d+$`). Ademas la
//   foto va embebida como `evidenciaFotoBase64 + evidenciaFotoMime +
//   evidenciaFotoHash`. Sin este mapper, el backend devuelve 400 por
//   FluentValidation antes de tocar la BD.
//
// Decision sobre `idMedidorCliente`:
//   El dominio `Medidor` no tiene un campo `id_cliente` —
//   solo `id_medidor` (PK local autoinc) y `numero_medidor` (codigo
//   fisico del aparato).
//
//   Decision tomada: mandar `${dispositivoId}:${medidor.id_medidor}`
//   (default `mobile:7`). Esto satisface el regex del validator y es
//   coherente con como sincronizan `Suscriptor`/`Liquidacion` en el
//   resto del mobile. Implicancia E2E: el backend solo va a aceptar
//   estas lecturas si previamente existe un `sync_registros` con
//   `tipo='medidor'` e `idCliente='mobile:{id}'`.

import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';

/**
 * Shape exacto que espera `LecturaPayload` del backend
 * (`backend/src/MediApp.Api/Features/Lecturas/LecturaPayload.cs`).
 *
 * Reglas FluentValidation aplicadas en el server:
 *   - idMedidorCliente: regex `^[\w-]+:\d+$`, NotEmpty.
 *   - periodo: regex `^\d{6}$`.
 *   - lecturaActual >= lecturaAnterior.
 *   - idOperario > 0.
 *   - observaciones: MaxLength 500 (opcional).
 *   - evidenciaFotoHash: SHA-256 hex 64 lowercase (opcional).
 *   - evidenciaFotoMime: requerido cuando hay base64.
 *   - idCliente: NotEmpty, MaxLength 120.
 *
 * Los campos de evidencia se OMITEN del objeto cuando no hay foto
 * (no se mandan como `undefined`) para que `JSON.stringify` no los
 * incluya y el backend los trate como nullable correctamente.
 */
export interface LecturaPayloadBackend {
  idMedidorCliente: string;
  lecturaActual: number;
  lecturaAnterior: number;
  periodo: string;
  idOperario: number;
  timestampCaptura: string;
  observaciones?: string;
  evidenciaFotoBase64?: string;
  evidenciaFotoMime?: string;
  evidenciaFotoHash?: string;
  idCliente: string;
}

/**
 * Dependencias inyectadas para mantener el mapper Node-puro y
 * testeable sin expo-sqlite ni expo-file-system.
 *
 *  - `medidorRepo.buscarPorId`: lookup local del medidor para validar
 *    que existe y para construir `idMedidorCliente`.
 *  - `hasher.sha256`: calcula el hash SHA-256 hex (64 chars lowercase)
 *    sobre el base64 de la foto.
 *  - `leerFotoBase64`: lee el archivo de la foto y devuelve base64 +
 *    mime. En el wiring real lo provee
 *    `mobile/src/adapters/leer-foto-base64.ts` (expo-file-system).
 *  - `dispositivoId`: prefijo del idCliente offline (default 'mobile').
 */
export interface DependenciasMapper {
  readonly medidorRepo: {
    buscarPorId(id: number): Promise<Medidor | null>;
  };
  readonly hasher: {
    sha256(input: string | Uint8Array): string;
  };
  readonly leerFotoBase64: (
    path: string,
  ) => Promise<{ base64: string; mime: string }>;
  readonly dispositivoId: string;
}

/**
 * Traduce una `Lectura` del dominio TS al payload que entiende el
 * backend. Lanza si el medidor no existe en SQLite local (estado
 * inconsistente: la lectura referencia un id_medidor inexistente,
 * probablemente borrado a mano o bug en captura).
 *
 * Pre-condiciones:
 *   - `lectura.id_lectura` debe estar definido (la lectura ya fue
 *     persistida y tiene PK local). En el flujo real, el adapter
 *     `persistirYEncolarLectura` garantiza esto antes de encolar.
 */
export async function mapearLecturaParaBackend(
  lectura: Lectura,
  deps: DependenciasMapper,
): Promise<LecturaPayloadBackend> {
  const medidor = await deps.medidorRepo.buscarPorId(lectura.id_medidor);
  if (medidor === null) {
    throw new Error(
      `Medidor ${lectura.id_medidor} no existe en SQLite local`,
    );
  }

  // Construimos el objeto base sin las propiedades opcionales para
  // que `JSON.stringify` las omita en vez de mandarlas como `null`.
  const payload: LecturaPayloadBackend = {
    idMedidorCliente: `${deps.dispositivoId}:${medidor.id_medidor}`,
    lecturaActual: lectura.lectura_actual,
    lecturaAnterior: lectura.lectura_anterior,
    periodo: lectura.id_periodo,
    idOperario: lectura.id_operario,
    timestampCaptura: lectura.timestamp_captura,
    idCliente: `${deps.dispositivoId}:${lectura.id_lectura}`,
  };

  if (lectura.observaciones !== undefined) {
    payload.observaciones = lectura.observaciones;
  }

  if (lectura.evidencia?.foto_path !== undefined) {
    const { base64, mime } = await deps.leerFotoBase64(
      lectura.evidencia.foto_path,
    );
    payload.evidenciaFotoBase64 = base64;
    payload.evidenciaFotoMime = mime;
    // Hash sobre el base64 string. El backend valida formato (64 hex
    // lowercase) pero no recalcula — es informativo para integridad
    // cliente-servidor.
    payload.evidenciaFotoHash = deps.hasher.sha256(base64);
  }

  return payload;
}
