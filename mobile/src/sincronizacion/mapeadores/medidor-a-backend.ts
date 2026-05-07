// mobile/src/sincronizacion/mapeadores/medidor-a-backend.ts
//
// Mapper `Medidor` (dominio TS snake_case, congelado D33) →
// `MedidorPayload` del backend .NET (camelCase, FK al suscriptor por
// `idSuscriptorCliente`).
//
// Por que existe:
//   El payload del dominio viene en snake_case (`numero_medidor`,
//   `id_suscriptor` numerico, `fecha_instalacion`). El backend valida
//   con FluentValidation un DTO camelCase y resuelve la FK al
//   suscriptor por un STRING `idSuscriptorCliente` con formato
//   `${dispositivo}:${id_local}` (mismo regex que el `idCliente`
//   propio del medidor: `^[\w-]+:\d+$`).
//
// Decision: lookup del suscriptor en SQLite local.
//   El payload del backend NO requiere los datos del suscriptor — solo
//   el string `idSuscriptorCliente`. Igual hacemos lookup local para
//   detectar inconsistencias (medidor referenciando un id inexistente)
//   ANTES del POST. Si el suscriptor no existe, lanzamos error claro
//   en vez de mandar un `${dispositivo}:42` huerfano y comer un 400.
//
//   El suscriptor referenciado se sincroniza ANTES del medidor via la
//   feature `dependeDe` de la cola (ver `procesarCola` del dominio).
//
// Async porque tiene I/O (lookup repo). Patron espejado de
// `lectura-a-backend.ts`.

import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';

/**
 * Shape exacto que espera `MedidorPayload` del backend
 * (`backend/src/MediApp.Api/Features/Medidores/MedidorPayload.cs`).
 *
 * Reglas FluentValidation aplicadas en el server:
 *   - numeroMedidor: regex `^[A-Za-z0-9-]{1,50}$`.
 *   - idSuscriptorCliente: regex `^[\w-]+:\d+$`, NotEmpty.
 *   - fechaInstalacion: ISO date YYYY-MM-DD.
 *   - estado: ∈ {activo, inactivo, reemplazado}.
 *   - observaciones: MaxLength 500 (opcional).
 *   - idCliente: regex `^[\w-]+:\d+$`, MaxLength 120.
 */
export interface MedidorPayloadBackend {
  numeroMedidor: string;
  idSuscriptorCliente: string;
  fechaInstalacion: string;
  estado: string;
  observaciones?: string;
  idCliente: string;
}

/**
 * Dependencias inyectadas. `suscriptorRepo` solo se usa para validar
 * coherencia local (no aporta datos al payload).
 */
export interface DependenciasMapperMedidor {
  readonly suscriptorRepo: {
    buscarPorId(id: number): Promise<Suscriptor | null>;
  };
  readonly dispositivoId: string;
}

/**
 * Traduce un `Medidor` del dominio TS al payload que entiende el
 * backend. Lanza si el suscriptor referenciado no existe en SQLite
 * local (estado inconsistente — mejor explotar antes del POST).
 *
 * Pre-condicion: `med.id_medidor` debe estar definido (ya persistido).
 */
export async function mapearMedidorParaBackend(
  med: Medidor,
  deps: DependenciasMapperMedidor,
): Promise<MedidorPayloadBackend> {
  const sus = await deps.suscriptorRepo.buscarPorId(med.id_suscriptor);
  if (sus === null) {
    throw new Error(
      `Suscriptor ${med.id_suscriptor} no existe en SQLite local`,
    );
  }

  const payload: MedidorPayloadBackend = {
    numeroMedidor: med.numero_medidor,
    idSuscriptorCliente: `${deps.dispositivoId}:${med.id_suscriptor}`,
    fechaInstalacion: med.fecha_instalacion,
    estado: med.estado,
    idCliente: `${deps.dispositivoId}:${med.id_medidor}`,
  };

  if (med.observaciones !== undefined) {
    payload.observaciones = med.observaciones;
  }

  return payload;
}
