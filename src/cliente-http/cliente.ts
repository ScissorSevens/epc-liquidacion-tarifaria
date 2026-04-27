/**
 * Cliente HTTP que implementa ClienteSincronizacion.
 * Postea items al backend .NET mapeando cada tipo a su endpoint REST.
 */

import type { ItemCola } from '../sincronizacion/types';
import type { RespuestaCliente, ClienteSincronizacion } from '../sincronizacion/procesador';
import type { ConfiguracionCliente } from './types';

export class ClienteHTTPSincronizacion implements ClienteSincronizacion {
  constructor(private readonly config: ConfiguracionCliente) {}

  async enviar(_item: ItemCola): Promise<RespuestaCliente> {
    throw new Error('NOT_IMPLEMENTED');
  }
}
