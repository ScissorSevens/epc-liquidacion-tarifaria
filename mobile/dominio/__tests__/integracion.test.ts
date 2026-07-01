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
import type { Suscriptor } from '../suscriptores/types';
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
import type { Hasher, IdGenerator } from '../shared/ports';

function fakeChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
let _seqId = 0;
const hasher: Hasher = { sha256: (input: string) => `hash-fake-${fakeChecksum(input)}` };
const idGen: IdGenerator = { uuid: () => `uuid-fake-${String(++_seqId).padStart(4, '0')}` };
beforeEach(() => { _seqId = 0; });

// Tarifas de referencia (Res CRA 825/2017 + 907/2019, valores estilizados)
const PARAMETROS: ParametrosTarifa = {
  id_parametros: 1,
  id_prestador: 0,
  id_acuerdo: 1,
  periodo: 2026,
  cma: 30_000_000,
  cmo: 1500,
  cmi: 300,
  cmt: 200,
  cmviaa: 0,
  aplica_cmviaa: false,
  agua_suministrada_m3_anio: 500_000,
  ipuf_m3_suscriptor_mes: 6,
  suscriptores_promedio: 3000,
  aplica_minimo_vital: false,
  m3_gratis_minimo_vital: 0,
  vigente_desde: '2026-01-01',
  vigente_hasta: '2026-12-31',
  created_at: '2026-01-01T00:00:00',
};

const SUSCRIPTOR_BASE: Suscriptor = {
  id_suscriptor: 1,
  codigo: 'S001',
  nombre_apellidos: 'Test',
  cedula: '123',
  municipio: 'Bog',
  direccion: 'Calle 1',
  estrato: 3,
  aplica_subsidio: false,
  estado: 'activo',
  created_at: '2026-01-01T00:00:00',
  id_prestador: 0,
  categoria_uso: 'residencial',
};

const CONTEXTO = { parametros: PARAMETROS, acuerdo: null };

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
      const resultado = liquidarLectura(lectura, SUSCRIPTOR_BASE, CONTEXTO);
      expect(resultado.consumo_m3).toBe(18);
      expect(resultado.cc_total).toBeGreaterThan(0);
      expect(resultado.total).toBeGreaterThan(0);

      // 3. Creamos la Liquidacion inmutable (con hash de integridad)
      const liquidacion = crearLiquidacion({
        suscriptorId: 'med-1001',
        resultado,
      }, hasher, idGen);
      expect(liquidacion.estado).toBe('ACTIVA');
      expect(liquidacion.hash).toMatch(/^hash-fake-/);

      // 4. Encadenamos eventos de auditoría
      const eventoLectura = registrarLecturaCapturada({
        actor: ACTOR,
        payload: {
          suscriptorId: 'med-1001',
          lecturaActual: lectura.lectura_actual,
          fechaLectura: new Date(),
        },
      }, hasher, idGen);

      const eventoLiquidacion = registrarLiquidacionCreada({
        actor: ACTOR,
        hashAnterior: eventoLectura.hash,
        payload: {
          liquidacionId: liquidacion.id,
          total: resultado.total,
        },
      }, hasher, idGen);

      const cadena: EventoAuditoria[] = [eventoLectura, eventoLiquidacion];
      expect(verificarCadena(cadena, hasher)).toEqual({ valida: true });

      // 5. Encolamos los items con dependencias
      //    (la liquidación depende de la lectura — la lectura debe llegar primero al server)
      const cola = new InMemoryColaSincronizacion();

      const itemLectura = agregarItemACola({
        tipo: 'LECTURA',
        payload: lectura,
        hashLocal: 'hash-lectura-1001',
      }, idGen);

      const itemLiquidacion = agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: liquidacion,
        hashLocal: liquidacion.hash,
        dependeDe: [itemLectura.id],
      }, idGen);

      const itemAuditLectura = agregarItemACola({
        tipo: 'EVENTO_AUDITORIA',
        payload: eventoLectura,
        hashLocal: eventoLectura.hash,
      }, idGen);

      const itemAuditLiquidacion = agregarItemACola({
        tipo: 'EVENTO_AUDITORIA',
        payload: eventoLiquidacion,
        hashLocal: eventoLiquidacion.hash,
        dependeDe: [itemAuditLectura.id],
      }, idGen);

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
      const suscriptorE2: Suscriptor = { ...SUSCRIPTOR_BASE, estrato: 2 };
      const resultado = liquidarLectura(
        registrarLectura({
          id_medidor: 2002,
          id_operario: 42,
          id_periodo: '202601',
          lectura_anterior: 50,
          lectura_actual: 60,
        }, 0),
        suscriptorE2,
        CONTEXTO
      );

      const liquidacion = crearLiquidacion({
        suscriptorId: 'med-2002',
        resultado,
      }, hasher, idGen);

      const cola = new InMemoryColaSincronizacion();
      const item = agregarItemACola({
        tipo: 'LIQUIDACION',
        payload: liquidacion,
        hashLocal: liquidacion.hash,
      }, idGen);
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
