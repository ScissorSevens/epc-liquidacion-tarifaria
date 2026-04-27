/**
 * Test de integración E2E del núcleo TS.
 *
 * Cubre el flujo crítico completo:
 *   captura lectura → liquidación → auditoría → cola → procesador → cliente HTTP
 *
 * Único mock: `fetch` global. Todo lo demás corre real.
 *
 * Escenarios:
 *   1. Happy path completo — lectura llega al server vía POST
 *   2. Conflicto 409 → resolución SOBRESCRIBIR_LOCAL → reintento → éxito
 */

import { registrarLectura } from '../captura-lecturas';
import { liquidarLectura } from '../captura-lecturas/captura-lecturas';
import { crearLiquidacion } from '../calculo/calculo';
import {
  registrarLecturaCapturada,
  registrarLiquidacionCreada,
  verificarCadena,
} from '../auditoria/auditoria';
import type { EventoAuditoria, Actor } from '../auditoria/types';
import {
  agregarItemACola,
  InMemoryColaSincronizacion,
  procesarCola,
  resolverConflicto,
} from '../sincronizacion';
import { ClienteHTTPSincronizacion } from '../cliente-http';
import type { ParametrosTarifa } from '../motor-tarifario/types';

// Tarifas de referencia (CRA Res. 688/2014, valores estilizados)
const PARAMETROS: ParametrosTarifa = {
  cargoFijo: 5000,
  precioM3: 2000,
  precioM3Excedente: 4000,
  consumoBasico: 16,
};

const ACTOR: Actor = { id: 'op-001', rol: 'OPERARIO' };

describe('E2E: integración del núcleo TS', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Happy path: lectura → liquidación → auditoría → cola → server', () => {
    it('flujo completo: el operario captura lectura y todo llega al server', async () => {
      // 1. Operario captura lectura en campo
      const lectura = registrarLectura({
        id_medidor: 1001,
        id_operario: 42,
        id_periodo: '202601',
        lectura_anterior: 100,
        lectura_actual: 118, // 18 m³ de consumo (2 excedente)
        evidencia: { foto_path: 'med-1001.jpg' },
      });

      expect(lectura.estado_validacion).toBe('pendiente');
      expect(lectura.estado_sync).toBe('pendiente');

      // 2. Liquidamos la lectura con el motor tarifario
      const resultado = liquidarLectura(lectura, PARAMETROS, 3);
      expect(resultado.consumo).toBe(18);
      expect(resultado.consumoExcedente).toBe(2);
      expect(resultado.total).toBeGreaterThan(0);

      // 3. Creamos la Liquidacion inmutable (con hash de integridad)
      const liquidacion = crearLiquidacion({
        suscriptorId: 'med-1001',
        resultado,
      });
      expect(liquidacion.estado).toBe('ACTIVA');
      expect(liquidacion.hash).toMatch(/^[a-f0-9]{64}$/);

      // 4. Encadenamos eventos de auditoría
      const eventoLectura = registrarLecturaCapturada({
        actor: ACTOR,
        payload: {
          suscriptorId: 'med-1001',
          lecturaActual: lectura.lectura_actual,
          fechaLectura: new Date(),
        },
      });

      const eventoLiquidacion = registrarLiquidacionCreada({
        actor: ACTOR,
        hashAnterior: eventoLectura.hash,
        payload: {
          liquidacionId: liquidacion.id,
          total: resultado.total,
        },
      });

      const cadena: EventoAuditoria[] = [eventoLectura, eventoLiquidacion];
      expect(verificarCadena(cadena)).toEqual({ valida: true });

      // 5. Encolamos los items con dependencias
      //    (la liquidación depende de la lectura — la lectura debe llegar primero al server)
      const cola = new InMemoryColaSincronizacion();

      const itemLectura = agregarItemACola({
        tipo: 'LECTURA',
        payload: lectura,
        hashLocal: 'hash-lectura-1001',
      });

      const itemLiquidacion = agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: liquidacion,
        hashLocal: liquidacion.hash,
        dependeDe: [itemLectura.id],
      });

      const itemAuditLectura = agregarItemACola({
        tipo: 'EVENTO_AUDITORIA',
        payload: eventoLectura,
        hashLocal: eventoLectura.hash,
      });

      const itemAuditLiquidacion = agregarItemACola({
        tipo: 'EVENTO_AUDITORIA',
        payload: eventoLiquidacion,
        hashLocal: eventoLiquidacion.hash,
        dependeDe: [itemAuditLectura.id],
      });

      await cola.guardar(itemLectura);
      await cola.guardar(itemLiquidacion);
      await cola.guardar(itemAuditLectura);
      await cola.guardar(itemAuditLiquidacion);

      // 6. Configuramos el cliente HTTP real (solo `fetch` está mockeado)
      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: { obtenerToken: async () => 'jwt-test' },
      });

      // El server responde 200 OK a todo
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      // 7. Procesamos la cola
      await procesarCola(cola, cliente);

      // 8. Verificaciones — todos los items quedaron EXITOSOS
      const finales = await cola.listar();
      const estados = finales.map((i) => ({ tipo: i.tipo, estado: i.estado }));

      expect(estados).toEqual(
        expect.arrayContaining([
          { tipo: 'LECTURA', estado: 'EXITOSO' },
          { tipo: 'LIQUIDACION', estado: 'EXITOSO' },
          { tipo: 'EVENTO_AUDITORIA', estado: 'EXITOSO' },
          { tipo: 'EVENTO_AUDITORIA', estado: 'EXITOSO' },
        ])
      );

      // 9. Verificamos los POSTs al server
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const urls = fetchMock.mock.calls.map((c) => c[0]);
      expect(urls).toEqual(
        expect.arrayContaining([
          'https://api.epc.com/api/lecturas',
          'https://api.epc.com/api/liquidaciones',
          'https://api.epc.com/api/auditoria',
        ])
      );

      // Todos llevan Authorization Bearer
      for (const [, opts] of fetchMock.mock.calls) {
        expect(opts.headers['Authorization']).toBe('Bearer jwt-test');
        expect(opts.headers['Content-Type']).toBe('application/json');
        expect(opts.method).toBe('POST');
      }

      // El body de la liquidación contiene el hash de integridad
      const callLiquidacion = fetchMock.mock.calls.find(
        (c) => c[0] === 'https://api.epc.com/api/liquidaciones'
      );
      const bodyLiquidacion = JSON.parse(callLiquidacion![1].body);
      expect(bodyLiquidacion.hashLocal).toBe(liquidacion.hash);
    });
  });

  describe('Conflicto 409 → SOBRESCRIBIR_LOCAL → reintento exitoso', () => {
    it('el server reporta 409 con su hash, el operario decide sobrescribir, segundo intento funciona', async () => {
      // Setup mínimo: una liquidación encolada
      const resultado = liquidarLectura(
        registrarLectura({
          id_medidor: 2002,
          id_operario: 42,
          id_periodo: '202601',
          lectura_anterior: 50,
          lectura_actual: 60,
        }),
        PARAMETROS,
        2
      );

      const liquidacion = crearLiquidacion({
        suscriptorId: 'med-2002',
        resultado,
      });

      const cola = new InMemoryColaSincronizacion();
      const item = agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: liquidacion,
        hashLocal: liquidacion.hash,
      });
      await cola.guardar(item);

      const cliente = new ClienteHTTPSincronizacion({
        baseUrl: 'https://api.epc.com',
        tokenProvider: { obtenerToken: async () => 'jwt-test' },
      });

      // Primer intento: server responde 409 con su propio hash
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ hashServer: 'hash-del-server-distinto' }),
      });

      await procesarCola(cola, cliente);

      // El item quedó en CONFLICTO con hashServer guardado
      const enConflicto = await cola.buscarPorId(item.id);
      expect(enConflicto?.estado).toBe('CONFLICTO');
      expect(enConflicto?.hashServer).toBe('hash-del-server-distinto');
      expect(enConflicto?.intentos).toBe(0); // conflicto NO incrementa intentos

      // El operario decide: mi versión gana
      await resolverConflicto(cola, item.id, 'SOBRESCRIBIR_LOCAL');

      const trasResolucion = await cola.buscarPorId(item.id);
      expect(trasResolucion?.estado).toBe('PENDIENTE');
      expect(trasResolucion?.forzarSobrescribir).toBe(true);

      // Segundo intento: server acepta (porque forzarSobrescribir va en el body)
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await procesarCola(cola, cliente);

      const exitoso = await cola.buscarPorId(item.id);
      expect(exitoso?.estado).toBe('EXITOSO');

      // Verificamos que el segundo POST llevó forzarSobrescribir:true
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const segundoBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(segundoBody.forzarSobrescribir).toBe(true);
      expect(segundoBody.hashLocal).toBe(liquidacion.hash);
    });
  });
});
