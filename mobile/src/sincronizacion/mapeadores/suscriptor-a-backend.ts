// mobile/src/sincronizacion/mapeadores/suscriptor-a-backend.ts
//
// Mapper `Suscriptor` (dominio TS snake_case, congelado D33) →
// `SuscriptorPayload` del backend .NET (camelCase).
//
// Por que existe:
//   El payload del dominio viene en snake_case (`nombre_apellidos`,
//   `matricula_inmobiliaria`, `created_at`). El backend valida con
//   FluentValidation un DTO camelCase y resuelve la FK logica via
//   `idCliente` con formato `${dispositivo}:${id_local}` (regex
//   `^[\w-]+:\d+$`). Sin este mapper, POST /api/v1/suscriptores
//   responde 400 antes de tocar la BD.
//
// Es funcion PURA (no async, no I/O). Mismo patron que
// `lectura-a-backend.ts` para los opcionales: cuando son `undefined`
// se OMITEN del objeto (no se setean) para que JSON.stringify no los
// serialice como `null`.

import type { Suscriptor } from '@dominio/suscriptores/types';

/**
 * Shape exacto que espera `SuscriptorPayload` del backend
 * (`backend/src/MediApp.Api/Features/Suscriptores/SuscriptorPayload.cs`).
 *
 * Reglas FluentValidation aplicadas en el server:
 *   - codigo: regex `^\d{1,10}$`.
 *   - nombreApellidos: NotEmpty, MaxLength 150.
 *   - direccion: NotEmpty, MaxLength 200.
 *   - estrato: 1..6.
 *   - matriculaInmobiliaria: MaxLength 50 (opcional).
 *   - numeroCatastral: MaxLength 50 (opcional).
 *   - estado: ∈ {activo, inactivo, suspendido}.
 *   - createdAt: ISO 8601.
 *   - idCliente: regex `^[\w-]+:\d+$`, MaxLength 120.
 */
export interface SuscriptorPayloadBackend {
  codigo: string;
  nombreApellidos: string;
  direccion: string;
  estrato: number;
  matriculaInmobiliaria?: string;
  numeroCatastral?: string;
  estado: string;
  createdAt: string;
  idCliente: string;
}

/**
 * Dependencias inyectadas para mantener el mapper testeable sin
 * acoplarse al wiring real. Solo necesitamos `dispositivoId` para
 * construir el `idCliente`.
 */
export interface DependenciasMapperSuscriptor {
  readonly dispositivoId: string;
}

/**
 * Traduce un `Suscriptor` del dominio TS al payload que entiende el
 * backend. Funcion pura — no toca repos ni filesystem.
 *
 * Pre-condicion: `sus.id_suscriptor` debe estar definido (ya
 * persistido). El caller lo garantiza al encolar.
 */
export function mapearSuscriptorParaBackend(
  sus: Suscriptor,
  deps: DependenciasMapperSuscriptor,
): SuscriptorPayloadBackend {
  const payload: SuscriptorPayloadBackend = {
    codigo: sus.codigo,
    nombreApellidos: sus.nombre_apellidos,
    direccion: sus.direccion,
    estrato: sus.estrato,
    estado: sus.estado,
    createdAt: sus.created_at,
    idCliente: `${deps.dispositivoId}:${sus.id_suscriptor}`,
  };

  if (sus.matricula_inmobiliaria !== undefined) {
    payload.matriculaInmobiliaria = sus.matricula_inmobiliaria;
  }
  if (sus.numero_catastral !== undefined) {
    payload.numeroCatastral = sus.numero_catastral;
  }

  return payload;
}
