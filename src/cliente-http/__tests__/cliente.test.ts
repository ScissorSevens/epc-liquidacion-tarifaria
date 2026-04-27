/**
 * Tests del ClienteHTTPSincronizacion.
 * Mockea fetch global para no hacer requests reales.
 */

import { ClienteHTTPSincronizacion } from '../cliente';
import type { TokenProvider } from '../types';
import type { ItemCola } from '../../sincronizacion/types';

// Helper: arma un ItemCola mínimo
function itemFake(overrides: Partial<ItemCola> = {}): ItemCola {
  return {
    id: 'item-1',
    tipo: 'LIQUIDACION',
    payload: { foo: 'bar' },
    hashLocal: 'hash-abc',
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    ultimoIntentoEn: null,
    creadoEn: new Date('2026-01-01'),
    ...overrides,
  };
}

// TokenProvider mockeable
function tokenProviderFake(token: string | null = 'token-fake'): TokenProvider {
  return { obtenerToken: async () => token };
}

describe('ClienteHTTPSincronizacion', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('C43: POST al endpoint correcto con body JSON', () => {
    it('postea LIQUIDACION a /api/liquidaciones', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      await cliente.enviar(itemFake({ tipo: 'LIQUIDACION' }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.epc.com/api/liquidaciones');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('postea LECTURA a /api/lecturas', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      await cliente.enviar(itemFake({ tipo: 'LECTURA' }));

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.epc.com/api/lecturas');
    });

    it('postea EVIDENCIA a /api/evidencias', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      await cliente.enviar(itemFake({ tipo: 'EVIDENCIA' }));

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.epc.com/api/evidencias');
    });

    it('postea EVENTO_AUDITORIA a /api/auditoria', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      await cliente.enviar(itemFake({ tipo: 'EVENTO_AUDITORIA' }));

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.epc.com/api/auditoria');
    });

    it('serializa el item completo en el body como JSON', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const item = itemFake({
        id: 'item-xyz',
        hashLocal: 'hash-123',
        payload: { medidor: 'M-001', valor: 42 },
      });

      await cliente.enviar(item);

      const opts = fetchMock.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body.id).toBe('item-xyz');
      expect(body.hashLocal).toBe('hash-123');
      expect(body.payload).toEqual({ medidor: 'M-001', valor: 42 });
      expect(body.tipo).toBe('LIQUIDACION');
    });
  });

  describe('C44: Authorization Bearer del TokenProvider', () => {
    it('agrega header Authorization Bearer con el token del provider', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake('jwt-abc-123'),
      });

      await cliente.enviar(itemFake());

      const opts = fetchMock.mock.calls[0][1];
      expect(opts.headers['Authorization']).toBe('Bearer jwt-abc-123');
    });

    it('llama a obtenerToken() en cada envio (no cachea)', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const obtenerToken = jest
        .fn<Promise<string | null>, []>()
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2');

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: { obtenerToken },
      });

      await cliente.enviar(itemFake());
      await cliente.enviar(itemFake());

      expect(obtenerToken).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].headers['Authorization']).toBe('Bearer token-1');
      expect(fetchMock.mock.calls[1][1].headers['Authorization']).toBe('Bearer token-2');
    });

    it('omite el header Authorization si el token es null', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(null),
      });

      await cliente.enviar(itemFake());

      const opts = fetchMock.mock.calls[0][1];
      expect(opts.headers['Authorization']).toBeUndefined();
    });
  });

  describe('C45: 2xx -> {ok: true}', () => {
    it('200 OK retorna ok:true', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(true);
      expect(resp.error).toBeUndefined();
      expect(resp.conflicto).toBeUndefined();
    });

    it('201 Created retorna ok:true', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(true);
    });

    it('204 No Content retorna ok:true sin parsear body', async () => {
      // 204 NO tiene body — si intentamos parsear, explota
      const jsonMock = jest.fn();
      fetchMock.mockResolvedValue({ ok: true, status: 204, json: jsonMock });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(true);
      expect(jsonMock).not.toHaveBeenCalled();
    });

    it('status 4xx genérico retorna ok:false (NO devuelve true ciego)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ mensaje: 'Bad Request' }),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
    });
  });

  describe('C46: 409 Conflict -> {ok:false, conflicto:true, hashServer}', () => {
    it('mapea 409 a conflicto con el hashServer del body', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ hashServer: 'hash-del-server-xyz' }),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
      expect(resp.conflicto).toBe(true);
      expect(resp.hashServer).toBe('hash-del-server-xyz');
    });

    it('409 NO marca error (conflicto es estado, no error)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ hashServer: 'hash-xyz' }),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.error).toBeUndefined();
    });

    it('409 sin hashServer en el body retorna conflicto:true con hashServer undefined', async () => {
      // Defensivo: si el server manda 409 mal formado, no debe romper
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({}),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
      expect(resp.conflicto).toBe(true);
      expect(resp.hashServer).toBeUndefined();
    });
  });

  describe('C47: 4xx/5xx no-409 -> {ok:false, error}', () => {
    it('400 con body {mensaje} propaga el mensaje del server', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ mensaje: 'payload inválido: medidor faltante' }),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
      expect(resp.conflicto).toBeUndefined();
      expect(resp.error).toBe('payload inválido: medidor faltante');
    });

    it('500 con body {mensaje} propaga el mensaje del server', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ mensaje: 'internal server error' }),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.error).toBe('internal server error');
    });

    it('401 sin body útil cae a mensaje genérico con el status', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
      expect(resp.error).toBe('HTTP 401');
    });

    it('body que no es JSON parseable cae a mensaje genérico', async () => {
      // Si el server devuelve HTML/texto plano, .json() throwea
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      });

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: tokenProviderFake(),
      });

      const resp = await cliente.enviar(itemFake());

      expect(resp.ok).toBe(false);
      expect(resp.error).toBe('HTTP 502');
    });
  });
});
