/**
 * Cliente HTTP que implementa ClienteSincronizacion.
 * Postea items al backend .NET mapeando cada tipo a su endpoint REST.
 */

import type { ItemCola } from '../sincronizacion/types';
import type { RespuestaCliente, ClienteSincronizacion } from '../sincronizacion/procesador';
import type { ConfiguracionCliente } from './types';
import { RUTAS_POR_TIPO } from './types';

export class ClienteHTTPSincronizacion implements ClienteSincronizacion {
  constructor(private readonly config: ConfiguracionCliente) {}

  async enviar(item: ItemCola): Promise<RespuestaCliente> {
    const url = `${this.config.baseUrl}${RUTAS_POR_TIPO[item.tipo]}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = await this.config.tokenProvider.obtenerToken();
    if (token !== null) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(item),
    });

    if (response.ok) {
      return { ok: true };
    }

    return { ok: false };
  }
}
