// mobile/__tests__/mapeadores/lectura-a-backend.test.ts
//
// Test del mapper `mapearLecturaParaBackend`.
//
// Por que existe:
//   El payload `Lectura` del dominio TS (snake_case, congelado D33) no
//   matchea con `LecturaPayload` del backend .NET (camelCase, FK al
//   medidor expresada por `idMedidorCliente` con formato
//   `dispositivo:id_local`, foto en base64+mime+hash).
//
//   Este mapper hace la traduccion de un shape a otro, resolviendo el
//   medidor por id local via el `medidorRepo` y leyendo la foto del
//   filesystem via `leerFotoBase64`. Las dependencias estan inyectadas
//   para mantener el mapper Node-puro y testeable sin expo-sqlite ni
//   expo-file-system.
//
// Corre con jest del root (ts-jest, env node), igual que
// `persistir-y-encolar-lectura.test.ts`.

import {
  mapearLecturaParaBackend,
  type DependenciasMapper,
} from '../../src/sincronizacion/mapeadores/lectura-a-backend';
import type { Lectura } from '@dominio/captura-lecturas/types';
import type { Medidor } from '@dominio/medidores/types';

describe('mapearLecturaParaBackend', () => {
  const medidorFake: Medidor = {
    id_medidor: 7,
    numero_medidor: 'MED-001',
    id_suscriptor: 1,
    fecha_instalacion: '2024-01-15',
    estado: 'activo',
    created_at: '2024-01-15T00:00:00.000Z',
  };

  function deps(overrides: Partial<DependenciasMapper> = {}): DependenciasMapper {
    return {
      medidorRepo: {
        buscarPorId: jest.fn(async (_id: number) => medidorFake),
      },
      hasher: {
        sha256: jest.fn((_input: string | Uint8Array) => 'a'.repeat(64)),
      },
      leerFotoBase64: jest.fn(async (_path: string) => ({
        base64: 'BASE64DATA',
        mime: 'image/jpeg',
      })),
      dispositivoId: 'mobile',
      ...overrides,
    };
  }

  it('mapea una lectura completa con foto al shape camelCase del backend', async () => {
    const lectura: Lectura = {
      id_lectura: 42,
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 1015,
      lectura_anterior: 1000,
      evidencia: { foto_path: '/data/fotos/abc.jpg' },
      estado_validacion: 'pendiente',
      observaciones: 'medidor sucio',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };

    const d = deps();
    const payload = await mapearLecturaParaBackend(lectura, d);

    expect(payload).toEqual({
      idMedidorCliente: 'mobile:7',
      lecturaActual: 1015,
      lecturaAnterior: 1000,
      periodo: '202605',
      idOperario: 3,
      timestampCaptura: '2026-05-06T15:00:00.000Z',
      observaciones: 'medidor sucio',
      evidenciaFotoBase64: 'BASE64DATA',
      evidenciaFotoMime: 'image/jpeg',
      evidenciaFotoHash: 'a'.repeat(64),
      idCliente: 'mobile:42',
    });

    expect(d.medidorRepo.buscarPorId).toHaveBeenCalledWith(7);
    expect(d.leerFotoBase64).toHaveBeenCalledWith('/data/fotos/abc.jpg');
    expect(d.hasher.sha256).toHaveBeenCalledWith('BASE64DATA');
  });

  it('omite los campos de evidencia cuando la lectura no trae foto', async () => {
    const lectura: Lectura = {
      id_lectura: 99,
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 200,
      lectura_anterior: 180,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };

    const d = deps();
    const payload = await mapearLecturaParaBackend(lectura, d);

    expect(payload).not.toHaveProperty('evidenciaFotoBase64');
    expect(payload).not.toHaveProperty('evidenciaFotoMime');
    expect(payload).not.toHaveProperty('evidenciaFotoHash');
    expect(d.leerFotoBase64).not.toHaveBeenCalled();
    expect(d.hasher.sha256).not.toHaveBeenCalled();
    expect(payload.idCliente).toBe('mobile:99');
    expect(payload.idMedidorCliente).toBe('mobile:7');
  });

  it('omite observaciones cuando la lectura no las trae (no propaga undefined)', async () => {
    const lectura: Lectura = {
      id_lectura: 5,
      id_medidor: 7,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 200,
      lectura_anterior: 180,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };

    const payload = await mapearLecturaParaBackend(lectura, deps());

    expect(payload).not.toHaveProperty('observaciones');
  });

  it('lanza error claro cuando el medidor no existe en SQLite local', async () => {
    const lectura: Lectura = {
      id_lectura: 1,
      id_medidor: 999,
      id_periodo: '202605',
      id_operario: 3,
      lectura_actual: 200,
      lectura_anterior: 180,
      estado_validacion: 'pendiente',
      timestamp_captura: '2026-05-06T15:00:00.000Z',
      estado_sync: 'pendiente',
    };

    const d = deps({
      medidorRepo: {
        buscarPorId: jest.fn(async (_id: number) => null),
      },
    });

    await expect(mapearLecturaParaBackend(lectura, d)).rejects.toThrow(
      'Medidor 999 no existe en SQLite local',
    );
  });
});
