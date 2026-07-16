// mobile/__tests__/mapeadores/medidor-a-backend.test.ts
//
// Test del mapper `mapearMedidorParaBackend`.
//
// Por que existe:
//   El payload `Medidor` del dominio TS (snake_case) no matchea con
//   `MedidorPayload` del backend .NET (camelCase, FK al suscriptor por
//   `idSuscriptorCliente` con formato `${dispositivo}:${id_local}`).
//
//   El mapper hace lookup del suscriptor en el repo local por
//   coherencia: si el medidor referencia un id_suscriptor inexistente,
//   explotamos antes del POST en vez de comer un 400 oscuro del server.

import {
  mapearMedidorParaBackend,
  type DependenciasMapperMedidor,
} from '../../src/sincronizacion/mapeadores/medidor-a-backend';
import type { Medidor } from '@dominio/medidores/types';
import type { Suscriptor } from '@dominio/suscriptores/types';

describe('mapearMedidorParaBackend', () => {
  const suscriptorFake: Suscriptor = {
    id_suscriptor: 5,
    codigo: '999',
    nombre_apellidos: 'Carlos Gómez',
    cedula: '123456789',
    municipio: 'Bogotá',
    direccion: 'Cra 3 # 4-5',
    estrato: 2,
     aplica_subsidio: false,
     id_prestador: 0,
     categoria_uso: 'residencial',
     estado: 'activo',
    created_at: '2026-04-01T00:00:00.000Z',
  };

  function deps(
    over: Partial<DependenciasMapperMedidor> = {},
  ): DependenciasMapperMedidor {
    return {
      suscriptorRepo: {
        buscarPorId: jest.fn(async (_id: number) => suscriptorFake),
      },
      dispositivoId: 'mobile',
      ...over,
    };
  }

  function medidorMin(over: Partial<Medidor> = {}): Medidor {
    return {
      id_medidor: 11,
      numero_medidor: 'MED-007',
      id_suscriptor: 5,
      fecha_instalacion: '2024-06-01',
      estado: 'activo',
      created_at: '2024-06-01T00:00:00.000Z',
      ...over,
    };
  }

  it('mapea_campos_basicos_correctamente', async () => {
    const med = medidorMin();
    const payload = await mapearMedidorParaBackend(med, deps());

    expect(payload).toEqual({
      numeroMedidor: 'MED-007',
      idSuscriptorCliente: 'mobile:5',
      fechaInstalacion: '2024-06-01',
      estado: 'activo',
      idCliente: 'mobile:11',
    });
  });

  it('incluye_observaciones_cuando_esta_definida', async () => {
    const med = medidorMin({ observaciones: 'medidor reemplazado' });
    const payload = await mapearMedidorParaBackend(med, deps());

    expect(payload.observaciones).toBe('medidor reemplazado');
  });

  it('omite_observaciones_cuando_es_undefined', async () => {
    const med = medidorMin();
    const payload = await mapearMedidorParaBackend(med, deps());

    expect(payload).not.toHaveProperty('observaciones');
    expect(JSON.stringify(payload)).not.toContain('observaciones');
  });

  it('lanza_si_suscriptor_no_existe', async () => {
    const med = medidorMin({ id_suscriptor: 999 });
    const d = deps({
      suscriptorRepo: {
        buscarPorId: jest.fn(async (_id: number) => null),
      },
    });

    await expect(mapearMedidorParaBackend(med, d)).rejects.toThrow(
      'Suscriptor 999 no existe en SQLite local',
    );
  });

  it('arma_idSuscriptorCliente_con_formato_correcto', async () => {
    const med = medidorMin({ id_suscriptor: 42 });
    const payload = await mapearMedidorParaBackend(med, {
      suscriptorRepo: {
        buscarPorId: jest.fn(async (_id: number) => ({
          ...suscriptorFake,
          id_suscriptor: 42,
        })),
      },
      dispositivoId: 'celu-007',
    });

    expect(payload.idSuscriptorCliente).toBe('celu-007:42');
    expect(payload.idSuscriptorCliente).toMatch(/^[\w-]+:\d+$/);
    expect(payload.idCliente).toBe('celu-007:11');
  });
});
