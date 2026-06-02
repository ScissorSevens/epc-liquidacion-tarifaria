// mobile/__tests__/mapeadores/suscriptor-a-backend.test.ts
//
// Test del mapper `mapearSuscriptorParaBackend`.
//
// Por que existe:
//   El payload `Suscriptor` del dominio TS (snake_case, congelado D33)
//   no matchea con `SuscriptorPayload` del backend .NET (camelCase, FK
//   logica via `idCliente`). Este mapper traduce el shape y construye
//   el `idCliente` con formato `${dispositivoId}:${id_suscriptor}`
//   (regex backend `^[\w-]+:\d+$`).
//
//   Es funcion PURA (sin I/O) — no necesita repos. Las dependencias
//   son solo `dispositivoId` para inyectar el prefijo del idCliente.
//
// Corre con jest del root (ts-jest, env node).

import {
  mapearSuscriptorParaBackend,
  type DependenciasMapperSuscriptor,
} from '../../src/sincronizacion/mapeadores/suscriptor-a-backend';
import type { Suscriptor } from '@dominio/suscriptores/types';

describe('mapearSuscriptorParaBackend', () => {
  const deps: DependenciasMapperSuscriptor = { dispositivoId: 'mobile' };

  function suscriptorMin(over: Partial<Suscriptor> = {}): Suscriptor {
    return {
      id_suscriptor: 12,
      codigo: '1234567890',
      nombre_apellidos: 'Juan Pérez',
      cedula: '123456789',
      municipio: 'Bogotá',
      direccion: 'Calle 1 # 2-3',
      estrato: 3,
      aplica_subsidio: false,
      estado: 'activo',
      created_at: '2026-05-01T10:00:00.000Z',
      ...over,
    };
  }

  it('mapea_campos_basicos_correctamente', () => {
    const sus = suscriptorMin();
    const payload = mapearSuscriptorParaBackend(sus, deps);

    expect(payload).toEqual({
      codigo: '1234567890',
      nombreApellidos: 'Juan Pérez',
      direccion: 'Calle 1 # 2-3',
      estrato: 3,
      estado: 'activo',
      createdAt: '2026-05-01T10:00:00.000Z',
      idCliente: 'mobile:12',
    });
  });

  it('incluye_matricula_y_catastral_cuando_estan_definidos', () => {
    const sus = suscriptorMin({
      matricula_inmobiliaria: 'MAT-001',
      numero_catastral: 'CAT-99',
    });
    const payload = mapearSuscriptorParaBackend(sus, deps);

    expect(payload.matriculaInmobiliaria).toBe('MAT-001');
    expect(payload.numeroCatastral).toBe('CAT-99');
  });

  it('omite_matricula_y_catastral_cuando_son_undefined', () => {
    const sus = suscriptorMin();
    const payload = mapearSuscriptorParaBackend(sus, deps);

    expect(payload).not.toHaveProperty('matriculaInmobiliaria');
    expect(payload).not.toHaveProperty('numeroCatastral');
    const json = JSON.stringify(payload);
    expect(json).not.toContain('matriculaInmobiliaria');
    expect(json).not.toContain('numeroCatastral');
  });

  it('arma_idCliente_con_formato_dispositivo_id_local', () => {
    const sus = suscriptorMin({ id_suscriptor: 7 });
    const payload = mapearSuscriptorParaBackend(sus, {
      dispositivoId: 'celu-007',
    });
    expect(payload.idCliente).toBe('celu-007:7');
    expect(payload.idCliente).toMatch(/^[\w-]+:\d+$/);
  });
});
